#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

export PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:3000}"

FRONTEND_LOG="${ROOT_DIR}/.e2e-frontend.log"
BACKEND_LOG="${ROOT_DIR}/.e2e-backend.log"

cleanup() {
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

npm start >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

node server/index.js >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

npx wait-on http://localhost:3000 http://localhost:4000

npx cypress run "$@"
