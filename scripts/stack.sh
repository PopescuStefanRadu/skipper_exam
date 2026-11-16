#!/usr/bin/env bash
# Manages this worktree's own copy of the full stack (see docs/DEVELOPMENT.md).
#
#   stack.sh up      build and start the stack, wait until healthy, write .stack.env
#   stack.sh down    stop the stack and delete its data
#   stack.sh name    print the stack's project name
#   stack.sh status  show the stack's containers
#
# Each worktree gets its own Docker Compose project name, so parallel stacks never
# share containers, networks or volumes. Host ports are assigned by Docker, and the
# ports actually in use are written to .stack.env for tests and dev tools to read.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
cd "$root"

# Name: directory name plus a hash of the full path, so two worktrees with the same
# directory name in different places still get different stacks.
slug=$(basename "$root" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-' | cut -c1-30)
hash=$(printf '%s' "$root" | sha256sum | cut -c1-8)
project="skipper-${slug}-${hash}"
compose=(docker compose --project-name "$project" --file "$root/compose.yaml")

host_port() {
  "${compose[@]}" port "$1" "$2" | sed 's/.*://'
}

case "${1:-}" in
  up)
    "${compose[@]}" up --detach --build --wait --quiet-pull
    app_port=$(host_port app 8080)
    db_port=$(host_port db 5432)
    cat >.stack.env <<EOF
STACK_PROJECT=$project
APP_URL=http://127.0.0.1:$app_port
DATABASE_URL=postgres://skipper_exam:skipper_exam@127.0.0.1:$db_port/skipper_exam
EOF
    cat .stack.env
    ;;
  down)
    "${compose[@]}" down --volumes --remove-orphans
    rm -f .stack.env
    ;;
  name)
    echo "$project"
    ;;
  status)
    "${compose[@]}" ps
    ;;
  *)
    echo "usage: $0 up|down|name|status" >&2
    exit 2
    ;;
esac
