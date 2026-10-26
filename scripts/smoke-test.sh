#!/usr/bin/env bash
# Smoke test of a running stack (docker compose up -d): health, web, login, CSRF protection.
# Usage: scripts/smoke-test.sh [base-url] [admin-email] [admin-password]
set -euo pipefail

BASE="${1:-https://localhost}"
EMAIL="${2:-admin@revize.local}"
PASSWORD="${3:-${ADMIN_PASSWORD:-}}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
# -k: Caddy's local CA for "localhost" is not trusted by curl.
CURL=(curl -sS -k --noproxy '*' --retry 10 --retry-delay 3 --retry-all-errors)

check() { printf '%-28s' "$1"; shift; if "$@"; then echo OK; else echo FAIL; exit 1; fi; }

check "API health" bash -c "\"\${@}\" '$BASE/api/health' | grep -q '\"database\":\"ok\"'" _ "${CURL[@]}"
check "web app" bash -c "\"\${@}\" -o /dev/null -w '%{http_code}' '$BASE/' | grep -q 200" _ "${CURL[@]}"
check "OpenAPI docs" bash -c "\"\${@}\" '$BASE/api/docs/json' | grep -q '/api/auth/login'" _ "${CURL[@]}"
if [[ -n "$PASSWORD" ]]; then
  check "login" bash -c "\"\${@}\" -c '$JAR' -H 'content-type: application/json' \
    -d '{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}' '$BASE/api/auth/login' | grep -q '\"token\"'" _ "${CURL[@]}"
  check "session cookie" bash -c "\"\${@}\" -b '$JAR' '$BASE/api/auth/me' | grep -q '\"permissions\"'" _ "${CURL[@]}"
  check "CSRF protection" bash -c "\"\${@}\" -o /dev/null -w '%{http_code}' -b '$JAR' -X POST \
    -H 'origin: https://evil.example' '$BASE/api/auth/logout' | grep -q 403" _ "${CURL[@]}"
fi
echo "Vše v pořádku."
