#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PAYMENT_RETURN_SPEC="cypress/e2e/payment-return.cy.js"
PAYMENT_RETURN_MODE="payment-return"

is_exact_payment_return_selection() {
  [[ "$#" -eq 2 && "$1" == "--spec" && "$2" == "$PAYMENT_RETURN_SPEC" ]]
}

payment_return_requested=false
for ARG in "$@"; do
  case "$ARG" in
    *payment-return.cy.js*|payment-return) payment_return_requested=true ;;
  esac
done

# This isolated fixture is deliberately an exact one-spec invocation. It must
# never share a process with a broader Cypress selection or a caller-selected mode.
if [[ "$payment_return_requested" == "true" ]]; then
  if ! is_exact_payment_return_selection "$@"; then
    echo "[e2e] payment-return isolation requires exactly: --spec $PAYMENT_RETURN_SPEC" >&2
    exit 2
  fi

  if [[ "${E2E_PAYMENT_RETURN_SANITIZED:-}" != "1" ]]; then
    exec env -i \
      PATH="$PATH" \
      HOME="${HOME:-/tmp}" \
      TMPDIR="${TMPDIR:-/tmp}" \
      E2E_PAYMENT_RETURN_SANITIZED=1 \
      E2E_PAYMENT_RETURN_ISOLATED=1 \
      bash "$0" "$@"
  fi

  MODE="$PAYMENT_RETURN_MODE"
else
  MODE="local"
  PREV_ARG=""
  for ARG in "$@"; do
    case "$ARG" in
      *nfc-bridge.cy.js) MODE="nfc" ;;
      *profile-soft-delete-guard.cy.js) MODE="soft-delete" ;;
      *admin-cards.cy.js|*nfc-invalid-card-states.cy.js) MODE="cards-lifecycle" ;;
      *admin-profiles.cy.js|*admin-profiles-e2e.cy.js) MODE="admin-profiles" ;;
    esac

    if [[ "$PREV_ARG" == "--mode" ]]; then
      MODE="$ARG"
    fi
    PREV_ARG="$ARG"
  done

  if [[ -f .env.e2e.local ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env.e2e.local
    set +a
  elif [[ -f .env.local ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env.local
    set +a
  fi
fi

FRONTEND_PORT="${E2E_FRONTEND_PORT:-3000}"
BACKEND_PORT="${E2E_BACKEND_PORT:-4000}"
WAIT_TIMEOUT_MS="${E2E_WAIT_ON_TIMEOUT_MS:-120000}"
export PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:${FRONTEND_PORT}}"

FRONTEND_LOG="${ROOT_DIR}/.e2e-frontend.log"
BACKEND_LOG="${ROOT_DIR}/.e2e-backend.log"
FAILED=0

cleanup() {
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" >/dev/null 2>&1 || true

  if [[ "$FAILED" -ne 0 ]]; then
    echo "\n[e2e] Failure detected. Tail of frontend log:"
    tail -n 40 "$FRONTEND_LOG" 2>/dev/null || true
    echo "\n[e2e] Tail of backend log:"
    tail -n 40 "$BACKEND_LOG" 2>/dev/null || true
  fi
}
trap 'FAILED=$?; cleanup; exit $FAILED' EXIT

# Kill stale local dev processes that commonly block the runner.
pkill -f "react-scripts start" >/dev/null 2>&1 || true
pkill -f "vite --host" >/dev/null 2>&1 || true
pkill -f "node server/index.js" >/dev/null 2>&1 || true
lsof -ti tcp:"${FRONTEND_PORT}" | xargs kill >/dev/null 2>&1 || true
lsof -ti tcp:"${BACKEND_PORT}" | xargs kill >/dev/null 2>&1 || true

rm -f "$FRONTEND_LOG" "$BACKEND_LOG"

if [[ "$MODE" == "$PAYMENT_RETURN_MODE" ]]; then
  echo "[e2e] payment-return mode: sanitized synthetic Supabase fixture"
  export REACT_APP_DISABLE_SUPABASE="false"
  export REACT_APP_SUPABASE_URL="http://127.0.0.1:54321"
  export REACT_APP_SUPABASE_ANON_KEY="e2e-synthetic-anon-key"
  export SUPABASE_URL="$REACT_APP_SUPABASE_URL"
  export SUPABASE_ANON_KEY="$REACT_APP_SUPABASE_ANON_KEY"
  export REACT_APP_GA4_ID=""
  export REACT_APP_SENTRY_DSN=""
  unset E2E_USE_REAL_SUPABASE RUNNER_MODE
elif [[ "$MODE" == "cards-lifecycle" ]]; then
  echo "[e2e] cards-lifecycle mode: forcing local auth/API fixtures"
  export CYPRESS_login_email="admin@nexcard.local"
  export CYPRESS_login_password="nexcard-local-admin"
  export REACT_APP_DISABLE_SUPABASE="true"
  unset REACT_APP_SUPABASE_URL
  unset REACT_APP_SUPABASE_ANON_KEY
  unset SUPABASE_URL
  unset SUPABASE_ANON_KEY
else
  if [[ "${E2E_USE_REAL_SUPABASE:-false}" == "true" || "${RUNNER_MODE:-local}" == "real" ]]; then
    echo "[e2e] local smoke mode: real Supabase enabled by explicit flag"
    unset REACT_APP_DISABLE_SUPABASE
  else
    echo "[e2e] local smoke mode: using deterministic local fixtures"
    export REACT_APP_DISABLE_SUPABASE="true"
    unset REACT_APP_SUPABASE_URL
    unset REACT_APP_SUPABASE_ANON_KEY
    unset SUPABASE_URL
    unset SUPABASE_ANON_KEY
  fi
fi

node ./scripts/e2e-env-check.js "$MODE"

if [[ "$MODE" == "$PAYMENT_RETURN_MODE" ]]; then
  # Keep all three subprocesses under an explicit allowlist even after this
  # runner was re-execed with env -i. No caller env, .env value, GA, Sentry or
  # telemetry variable can reach the frontend, backend, or Cypress process.
  SANITIZED_ENV=(
    "PATH=$PATH"
    "HOME=${HOME:-/tmp}"
    "TMPDIR=${TMPDIR:-/tmp}"
    "E2E_PAYMENT_RETURN_SANITIZED=1"
    "E2E_PAYMENT_RETURN_ISOLATED=1"
    "REACT_APP_DISABLE_SUPABASE=false"
    "REACT_APP_SUPABASE_URL=http://127.0.0.1:54321"
    "REACT_APP_SUPABASE_ANON_KEY=e2e-synthetic-anon-key"
    "REACT_APP_GA4_ID="
    "REACT_APP_SENTRY_DSN="
    "SUPABASE_URL=http://127.0.0.1:54321"
    "SUPABASE_ANON_KEY=e2e-synthetic-anon-key"
    "PUBLIC_APP_URL=http://localhost:${FRONTEND_PORT}"
  )

  echo "[e2e] Starting frontend on http://localhost:${FRONTEND_PORT}"
  env -i "${SANITIZED_ENV[@]}" PORT="$FRONTEND_PORT" npm start >"$FRONTEND_LOG" 2>&1 &
  FRONTEND_PID=$!

  echo "[e2e] Starting backend on http://localhost:${BACKEND_PORT}"
  env -i "${SANITIZED_ENV[@]}" PORT="$BACKEND_PORT" node server/index.js >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
else
  echo "[e2e] Starting frontend on http://localhost:${FRONTEND_PORT}"
  PORT="$FRONTEND_PORT" npm start >"$FRONTEND_LOG" 2>&1 &
  FRONTEND_PID=$!

  echo "[e2e] Starting backend on http://localhost:${BACKEND_PORT}"
  PORT="$BACKEND_PORT" node server/index.js >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
fi

echo "[e2e] Waiting for frontend/backend readiness..."
npx wait-on --timeout "$WAIT_TIMEOUT_MS" "http://localhost:${FRONTEND_PORT}" "http://localhost:${BACKEND_PORT}/api/health"

echo "[e2e] Running Cypress (mode: $MODE)"
if [[ "$MODE" == "$PAYMENT_RETURN_MODE" ]]; then
  env -i "${SANITIZED_ENV[@]}" npx cypress run "$@"
else
  npx cypress run "$@"
fi
