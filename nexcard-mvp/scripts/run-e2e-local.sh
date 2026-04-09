#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

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
pkill -f "node server/index.js" >/dev/null 2>&1 || true

rm -f "$FRONTEND_LOG" "$BACKEND_LOG"

node ./scripts/e2e-env-check.js "$MODE"

echo "[e2e] Starting frontend on http://localhost:${FRONTEND_PORT}"
PORT="$FRONTEND_PORT" npm start >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

echo "[e2e] Starting backend on http://localhost:${BACKEND_PORT}"
PORT="$BACKEND_PORT" node server/index.js >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

echo "[e2e] Waiting for frontend/backend readiness..."
npx wait-on --timeout "$WAIT_TIMEOUT_MS" "http://localhost:${FRONTEND_PORT}" "http://localhost:${BACKEND_PORT}"

echo "[e2e] Running Cypress (mode: $MODE)"
npx cypress run "$@"
