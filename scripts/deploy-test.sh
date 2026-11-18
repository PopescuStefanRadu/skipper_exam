#!/usr/bin/env bash
# Tests the production setup (deploy/compose.yaml) with images built from this
# commit: it starts, a user signs in (through a fake sign-in service standing in for
# Authentik) and records progress, a backup is taken, the data is wiped, and the
# restored backup brings the account and its progress back. Then the account is
# deleted.
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"

hash=$(printf '%s' "$root" | sha256sum | cut -c1-8)
prefix="skipper-exam-deploytest-$hash"
work=$(mktemp -d)
free_port() { python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'; }
port=$(free_port)
mock_port=$(free_port)
compose=(docker compose --project-name "$prefix" --file "$root/deploy/compose.yaml" --file "$root/scripts/deploy-test.compose.yaml" --env-file "$work/.env")

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  # The backups were written by root in the container.
  docker run --rm -v "$work:/w" postgres:17.2 rm -rf /w/backups >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

echo "== building images"
docker build -q -t "$prefix-app:test" . >/dev/null
docker build -q -t "$prefix-backup:test" docker/backup >/dev/null

secret() { openssl rand -hex 16; }
cat >"$work/.env" <<ENV
APP_URL=http://127.0.0.1:$port
APP_BIND=127.0.0.1:$port
POSTGRES_PASSWORD=$(secret)
OIDC_ISSUER_URL=http://127.0.0.1:$mock_port/default
OIDC_CLIENT_ID=skipper-exam
OIDC_CLIENT_SECRET=test-secret
MOCK_OIDC_PORT=$mock_port
BACKUP_DIR=$work/backups
IMAGE_PREFIX=$prefix
IMAGE_TAG=test
ENV

app="http://127.0.0.1:$port"
echo "== starting at $app"
"${compose[@]}" up --detach --wait --quiet-pull
curl -fsS "$app/api/health" | jq -e '.status == "ok"' >/dev/null

echo "== sign in and record progress (session token, as the Android app does)"
email="deploy-test-$(secret)@example.test"
token=$(e2e/sign-in.sh "$app" "$email")
event=$(cat /proc/sys/kernel/random/uuid)
curl -fsS -X POST "$app/api/events" -H "X-Session-Token: $token" -H 'Content-Type: application/json' \
  -d "{\"events\":[{\"id\":\"$event\",\"type\":\"practice.answered\",\"at\":\"2026-11-18T10:00:00Z\",\"data\":{\"questionId\":\"q\",\"answer\":\"a\",\"correct\":true,\"mode\":\"learn\"}}]}" >/dev/null
curl -fsS "$app/api/account/export" -H "X-Session-Token: $token" | jq -e --arg e "$event" '.events | map(.id) == [$e]' >/dev/null

echo "== backup"
"${compose[@]}" exec -T backup backup.sh now
day=$("${compose[@]}" exec -T backup backup.sh list | tail -1)

echo "== wipe the data, then restore $day"
"${compose[@]}" rm --stop --force mock-oidc app backup db >/dev/null 2>&1
docker volume rm "${prefix}_db" >/dev/null
"${compose[@]}" up --detach --wait db
"${compose[@]}" run --rm --no-deps backup restore "$day"
"${compose[@]}" up --detach --wait --quiet-pull

echo "== the account and its progress are back"
curl -fsS "$app/api/events" -H "X-Session-Token: $token" | jq -e --arg e "$event" 'map(.id) == [$e]' >/dev/null
token=$(e2e/sign-in.sh "$app" "$email")
curl -fsS "$app/api/events" -H "X-Session-Token: $token" | jq -e --arg e "$event" 'map(.id) == [$e]' >/dev/null

echo "== account deletion"
code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$app/api/account" -H "X-Session-Token: $token")
[[ "$code" == 204 ]] || { echo "delete: $code"; exit 1; }
code=$(curl -s -o /dev/null -w '%{http_code}' "$app/api/me" -H "X-Session-Token: $token")
[[ "$code" == 401 ]] || { echo "after delete, /api/me: $code"; exit 1; }
echo "deploy test passed"
