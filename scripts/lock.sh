#!/usr/bin/env bash
# Runs a command while holding a named lock shared by all worktrees of this repo.
#
#   lock.sh <name> <command...>
#
# Locks live in the repository's common git directory, so every worktree sees the
# same lock. The lock is released when the command exits, even if it fails.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 <name> <command...>" >&2
  exit 2
fi
name=$1
shift

dir="$(git rev-parse --path-format=absolute --git-common-dir)/locks"
mkdir -p "$dir"
exec 9>"$dir/$name.lock"
if ! flock --nonblock 9; then
  echo "waiting for lock '$name'..." >&2
  flock 9
fi
"$@"
