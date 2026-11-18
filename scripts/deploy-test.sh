#!/usr/bin/env bash
# Tests the production setup (deploy/compose.yaml) with images built from this
# commit: it starts, a user signs up and records progress, a backup is taken, the
# data is wiped, and the restored backup brings the account and its progress back.
# Kratos runs as in production (no --dev). Mail and Google aren't contacted.
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"

hash=$(printf '%s' "$root" | sha256sum | cut -c1-8)
prefix="skipper-exam-deploytest-$hash"
work=$(mktemp -d)
port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
compose=(docker compose --project-name "$prefix" --file "$root/deploy/compose.yaml" --env-file "$work/.env")

cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  # The backups were written by root in the container.
  docker run --rm -v "$work:/w" postgres:17.2 rm -rf /w/backups >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

echo "== building images"
docker build -q -t "$prefix-app:test" . >/dev/null
docker build -q -t "$prefix-kratos:test" docker/kratos >/dev/null
docker build -q -t "$prefix-backup:test" docker/backup >/dev/null

secret() { openssl rand -hex 16; }
cat >"$work/.env" <<ENV
APP_URL=http://127.0.0.1:$port
APP_BIND=127.0.0.1:$port
POSTGRES_PASSWORD=$(secret)
COOKIE_SECRET=$(secret)
CIPHER_SECRET=$(secret)
SMTP_URI=smtp://127.0.0.1:1/
MAIL_FROM=no-reply@example.test
GOOGLE_CLIENT_ID=test.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=test-secret
BACKUP_DIR=$work/backups
IMAGE_PREFIX=$prefix
IMAGE_TAG=test
ENV

app="http://127.0.0.1:$port"
echo "== starting at $app"
"${compose[@]}" up --detach --wait --quiet-pull
curl -fsS "$app/api/health" | jq -e '.status == "ok"' >/dev/null

# Kratos runs without --dev: its session cookies are Secure (HTTPS only).
action=$(curl -fsS "$app/.ory/self-service/registration/browser" -H 'Accept: application/json' -D "$work/headers" | jq -r .ui.action)
grep -qi '^set-cookie:.*; secure' "$work/headers" || { echo "Kratos cookies are not Secure"; exit 1; }

echo "== sign up and record progress (session token, as the Android app does)"
email="deploy-test-$(secret)@example.test"
password="o-parola-de-test-123"
action=$(curl -fsS "$app/.ory/self-service/registration/api" | jq -r .ui.action)
token=$(curl -fsS -X POST "$action" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"method\":\"password\",\"traits\":{\"email\":\"$email\"},\"password\":\"$password\"}" | jq -r .session_token)
event=$(cat /proc/sys/kernel/random/uuid)
curl -fsS -X POST "$app/api/events" -H "X-Session-Token: $token" -H 'Content-Type: application/json' \
  -d "{\"events\":[{\"id\":\"$event\",\"type\":\"practice.answered\",\"at\":\"2026-11-18T10:00:00Z\",\"data\":{\"questionId\":\"q\",\"answer\":\"a\",\"correct\":true,\"mode\":\"learn\"}}]}" >/dev/null
curl -fsS "$app/api/account/export" -H "X-Session-Token: $token" | jq -e --arg e "$event" '.events | map(.id) == [$e]' >/dev/null

echo "== backup"
"${compose[@]}" exec -T backup backup.sh now
day=$("${compose[@]}" exec -T backup backup.sh list | tail -1)

echo "== wipe the data, then restore $day"
"${compose[@]}" rm --stop --force app kratos kratos-migrate backup db >/dev/null 2>&1
docker volume rm "${prefix}_db" >/dev/null
"${compose[@]}" up --detach --wait db
"${compose[@]}" run --rm --no-deps backup restore "$day"
"${compose[@]}" up --detach --wait --quiet-pull

echo "== the account and its progress are back"
action=$(curl -fsS "$app/.ory/self-service/login/api" | jq -r .ui.action)
token=$(curl -fsS -X POST "$action" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"method\":\"password\",\"identifier\":\"$email\",\"password\":\"$password\"}" | jq -r .session_token)
curl -fsS "$app/api/events" -H "X-Session-Token: $token" | jq -e --arg e "$event" 'map(.id) == [$e]' >/dev/null

echo "== account deletion"
code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$app/api/account" -H "X-Session-Token: $token")
[[ "$code" == 204 ]] || { echo "delete: $code"; exit 1; }
code=$(curl -s -o /dev/null -w '%{http_code}' "$app/api/me" -H "X-Session-Token: $token")
[[ "$code" == 401 ]] || { echo "after delete, /api/me: $code"; exit 1; }
echo "deploy test passed"
