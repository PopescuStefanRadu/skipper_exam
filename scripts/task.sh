#!/usr/bin/env bash
# One worktree and branch per task (see docs/DEVELOPMENT.md).
#
#   task.sh new <name>    create .worktrees/<name> on branch task/<name> from the latest main
#   task.sh integrate     (inside a task worktree) rebase onto main, run the full suite,
#                         then fast-forward main; one integration at a time
#   task.sh done <name>   stop the task's stack, remove its worktree and its (merged) branch
#
# Set PUSH=1 to also push main to origin after a successful integration.
set -euo pipefail

scripts=$(cd "$(dirname "$0")" && pwd)

# The main checkout is the first entry of the worktree list.
main_root=$(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')

new() {
  local name=$1 dir="$main_root/.worktrees/$1"
  git -C "$main_root" worktree add -b "task/$name" "$dir" main
  make -C "$dir" setup
  echo "worktree ready: $dir"
}

integrate() {
  local root branch
  root=$(git rev-parse --show-toplevel)
  branch=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$root" == "$main_root" || "$branch" != task/* ]]; then
    echo "run this inside a task worktree (branch task/<name>)" >&2
    exit 1
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "commit or discard your changes first" >&2
    exit 1
  fi
  if [[ "$(git -C "$main_root" rev-parse --abbrev-ref HEAD)" != main || -n "$(git -C "$main_root" status --porcelain)" ]]; then
    echo "the main checkout must be on main with no uncommitted changes" >&2
    exit 1
  fi

  while true; do
    local base
    base=$(git rev-parse main)
    git rebase main
    make -C "$root" test-all
    # If main moved while the suite was running, rebase and test again.
    if [[ "$(git rev-parse main)" == "$base" ]]; then
      break
    fi
    echo "main moved during testing; rebasing again"
  done
  git -C "$main_root" merge --ff-only "$branch"
  echo "main is now at $(git rev-parse --short main)"
  if [[ "${PUSH:-}" == 1 ]]; then
    git -C "$main_root" push origin main
  fi
}

done_task() {
  local name=$1 dir="$main_root/.worktrees/$1"
  if [[ -d "$dir" ]]; then
    "$dir/scripts/stack.sh" down || true
    git -C "$main_root" worktree remove "$dir"
  fi
  # -d refuses to delete a branch that isn't merged into main.
  git -C "$main_root" branch -d "task/$name"
}

case "${1:-}" in
  new) [[ $# -eq 2 ]] || { echo "usage: $0 new <name>" >&2; exit 2; }; new "$2" ;;
  integrate) "$scripts/lock.sh" integrate "$0" _integrate ;;
  _integrate) integrate ;;
  done) [[ $# -eq 2 ]] || { echo "usage: $0 done <name>" >&2; exit 2; }; done_task "$2" ;;
  *) echo "usage: $0 new <name> | integrate | done <name>" >&2; exit 2 ;;
esac
