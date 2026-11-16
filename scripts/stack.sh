#!/usr/bin/env bash
# Manages this worktree's own copy of the full stack (see docs/DEVELOPMENT.md).
#
#   stack.sh up      build and start the stack, wait until healthy, write .stack.env
#   stack.sh down    stop the stack and delete its data
#   stack.sh name    print the stack's project name
#   stack.sh status  show the stack's containers
#
# Each worktree gets its own Docker Compose project name, so parallel stacks never
# share containers, networks or volumes. Host ports are assigned by Docker, except
# the app's and the mock Google server's: Kratos needs both addresses in its
# configuration before it starts, so free ports are reserved under the "ports"
# lock (shared by all worktrees), which is held until Docker has bound them. The ports in use are written to .stack.env for
# tests and dev tools to read. Generated files (Kratos configuration, secrets)
# live in .stack/.
set -euo pipefail

# The worktree is the one this script belongs to, wherever it is called from.
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"

# Name: directory name plus a hash of the full path, so two worktrees with the same
# directory name in different places still get different stacks.
slug=$(basename "$root" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-' | cut -c1-30)
hash=$(printf '%s' "$root" | sha256sum | cut -c1-8)
project="skipper-${slug}-${hash}"
compose=(docker compose --project-name "$project" --file "$root/compose.yaml")

# The reserved ports only matter when starting; other commands just need them set.
host_port() {
  APP_PORT=65535 MOCK_OIDC_PORT=65535 "${compose[@]}" port "$1" "$2" 2>/dev/null | sed 's/.*://'
}

# The port a running service already uses, or a new free one.
reserve_port() {
  local port
  port=$(host_port "$1" "$2" || true)
  if [[ -z "$port" ]]; then
    port=$(free_port)
  fi
  echo "$port"
}

free_port() {
  python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])'
}

up() {
  mkdir -p .stack
  if [[ ! -f .stack/secrets ]]; then
    printf 'COOKIE_SECRET=%s\nCIPHER_SECRET=%s\n' "$(openssl rand -hex 16)" "$(openssl rand -hex 16)" >.stack/secrets
  fi
  # shellcheck source=/dev/null
  . .stack/secrets

  local app_port mock_port previous="" recreate=()
  app_port=$(reserve_port app 8080)
  mock_port=""
  if [[ -f .stack/ports && -n "$(host_port app 8080 || true)" ]]; then
    mock_port=$(cut -d' ' -f2 .stack/ports)
  fi
  mock_port=${mock_port:-$(free_port)}
  while [[ "$mock_port" == "$app_port" ]]; do
    mock_port=$(free_port)
  done
  if [[ -f .stack/ports ]]; then
    previous=$(cat .stack/ports)
  fi
  local app_url="http://127.0.0.1:$app_port" mock_url="http://127.0.0.1:$mock_port"
  sed -e "s|__APP_URL__|$app_url|g" -e "s|__MOCK_OIDC_URL__|$mock_url|g" \
    -e "s|__COOKIE_SECRET__|$COOKIE_SECRET|" -e "s|__CIPHER_SECRET__|$CIPHER_SECRET|" \
    docker/kratos/kratos.yml.tmpl >.stack/kratos.yml

  # Kratos reads its configuration at start-up, so new addresses need new containers.
  if [[ "$previous" != "$app_port $mock_port" ]]; then
    recreate=(--force-recreate)
  fi
  APP_PORT=$app_port MOCK_OIDC_PORT=$mock_port "${compose[@]}" up --detach --build --wait --quiet-pull "${recreate[@]}"
  echo "$app_port $mock_port" >.stack/ports

  {
    echo "STACK_PROJECT=$project"
    echo "APP_URL=$app_url"
    echo "DATABASE_URL=postgres://skipper_exam:skipper_exam@127.0.0.1:$(host_port db 5432)/skipper_exam"
    echo "KRATOS_ADMIN_URL=http://127.0.0.1:$(host_port kratos 4434)"
    echo "MAILPIT_URL=http://127.0.0.1:$(host_port mailpit 8025)"
    echo "MOCK_OIDC_URL=$mock_url"
  } >.stack.env
  cat .stack.env
}

case "${1:-}" in
  up)
    "$root/scripts/lock.sh" ports "$0" _up
    ;;
  _up)
    up
    ;;
  down)
    APP_PORT=65535 MOCK_OIDC_PORT=65535 "${compose[@]}" down --volumes --remove-orphans
    rm -rf .stack.env .stack
    ;;
  name)
    echo "$project"
    ;;
  status)
    APP_PORT=65535 MOCK_OIDC_PORT=65535 "${compose[@]}" ps
    ;;
  *)
    echo "usage: $0 up|down|name|status" >&2
    exit 2
    ;;
esac
