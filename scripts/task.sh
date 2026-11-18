#!/usr/bin/env bash
# One worktree and branch per task (see docs/DEVELOPMENT.md).
#
#   task.sh new <name>    create .worktrees/<name> on branch task/<name> from the latest origin/main
#   task.sh integrate     (inside a task worktree) get the branch into main through a pull request:
#                         squash the branch into one commit, rebase on origin/main, run the full
#                         suite, commit its test record, push, open the pull request, merge, then
#                         publish the images (scripts/publish.sh). If main moves at any point, the
#                         whole loop starts again. TITLE sets the commit title, NOTES a file with
#                         text for the pull request's description.
#   task.sh done <name>   stop the task's stack, remove its worktree and its merged branch
#
# main is protected on GitHub: changes reach it only through pull requests. There is no
# CI; the full suite runs here, on the exact commit that is merged, on top of the
# current main, and its record is committed with it.
set -euo pipefail

scripts=$(cd "$(dirname "$0")" && pwd)

# The main checkout is the first entry of the worktree list.
main_root=$(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')

# Keeps the main checkout equal to origin/main, when it's safe to update it.
sync_main_checkout() {
  git -C "$main_root" fetch --quiet origin
  if [[ "$(git -C "$main_root" rev-parse --abbrev-ref HEAD)" == main && -z "$(git -C "$main_root" status --porcelain)" ]]; then
    git -C "$main_root" merge --quiet --ff-only origin/main
  else
    echo "note: main checkout not updated (not on main, or has local changes)" >&2
  fi
}

new() {
  local name=$1 dir="$main_root/.worktrees/$1"
  sync_main_checkout
  git -C "$main_root" worktree add -b "task/$name" "$dir" origin/main
  git -C "$dir" branch --quiet --unset-upstream 2>/dev/null || true
  make -C "$dir" setup
  echo "worktree ready: $dir"
}

# Squashes the branch's commits (since it left main) into one. The message lists
# every original commit, keeping the lists of earlier squashes, so test records
# named after those commits can still be traced. The title is $TITLE, or else the
# first commit subject that isn't a work-in-progress or test-record commit.
squash_branch() {
  local branch=$1 base title msg c commits=()
  base=$(git merge-base HEAD origin/main)
  mapfile -t commits < <(git rev-list --reverse "$base..HEAD")
  if [[ ${#commits[@]} -eq 0 ]]; then
    echo "nothing to integrate: $branch has no commits beyond main" >&2
    exit 1
  fi
  title=${TITLE:-}
  if [[ -z "$title" ]]; then
    title=$(for c in "${commits[@]}"; do git log -1 --format=%s "$c"; done |
      grep -viE '^(wip|test: record|fixup|squash|throwaway)' | head -1 || true)
  fi
  title=${title:-${branch#task/}}
  msg=$(
    echo "$title"
    echo
    # Notes for the pull request, e.g. .env changes the hosting project must make.
    if [[ -n "${NOTES:-}" ]]; then
      cat "$NOTES"
      echo
    fi
    echo "Original commits:"
    {
      for c in "${commits[@]}"; do
        git log -1 --format=%b "$c" | grep -E '^- [0-9a-f]{12} ' || true
        git log -1 --format='- %h %s' --abbrev=12 "$c"
      done
    } | awk '!seen[$2]++'
  )
  git reset --quiet --soft "$base"
  git commit --quiet --message "$msg"
  echo "squashed ${#commits[@]} commit(s) into $(git rev-parse --short=12 HEAD): $title"
}

# Commits the record of the test run of $1. The commit must add test records only,
# so the code that is merged is exactly the code that was tested.
record_test_run() {
  local tested=$1
  git add test-runs
  if git diff --cached --quiet; then
    return
  fi
  git commit --quiet --message "test: record test run of $(git rev-parse --short=12 "$tested")"
  if git diff --name-only "$tested" HEAD | grep -qv '^test-runs/'; then
    echo "the test-record commit changes files outside test-runs/" >&2
    exit 1
  fi
}

integrate() {
  local root branch base head tested
  root=$(git rev-parse --show-toplevel)
  branch=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$root" == "$main_root" || "$branch" != task/* ]]; then
    echo "run this inside a task worktree (branch task/<name>)" >&2
    exit 1
  fi
  if [[ -n "$(git status --porcelain -- . ':!test-runs')" ]]; then
    echo "commit or discard your changes first" >&2
    exit 1
  fi

  while true; do
    git fetch --quiet origin
    base=$(git rev-parse origin/main)
    squash_branch "$branch"
    git rebase origin/main
    make -C "$root" test-all
    tested=$(git rev-parse HEAD)
    record_test_run "$tested"
    head=$(git rev-parse HEAD)

    git push --quiet --force-with-lease origin "HEAD:refs/heads/$branch"
    git log -1 --format=%b "$tested" >"$root/.pr-body"
    if gh pr view "$branch" --json number >/dev/null 2>&1; then
      gh pr edit "$branch" --title "$(git log -1 --format=%s "$tested")" --body-file "$root/.pr-body" >/dev/null
    else
      gh pr create --base main --head "$branch" --title "$(git log -1 --format=%s "$tested")" --body-file "$root/.pr-body"
    fi
    rm -f "$root/.pr-body"

    git fetch --quiet origin
    if [[ "$(git rev-parse origin/main)" != "$base" ]]; then
      echo "main moved while testing; starting again"
      continue
    fi
    # --match-head-commit: merge only the exact commit that was tested.
    if gh pr merge "$branch" --rebase --match-head-commit "$head"; then
      break
    fi
    echo "merge refused (main probably moved); starting again"
  done

  sync_main_checkout
  echo "merged; main is now at $(git -C "$main_root" rev-parse --short origin/main)"
  "$scripts/publish.sh"
}

done_task() {
  local name=$1 dir="$main_root/.worktrees/$1" state
  # GitHub's rebase merge rewrites commits, so "merged" is decided by the pull request.
  state=$(gh pr view "task/$name" --json state --jq .state 2>/dev/null || echo NONE)
  if [[ "$state" != MERGED && "${FORCE:-}" != 1 ]]; then
    echo "task/$name has no merged pull request (state: $state); use FORCE=1 to discard it" >&2
    exit 1
  fi
  if [[ -d "$dir" ]]; then
    "$dir/scripts/stack.sh" down || echo "warning: could not stop the stack of $name; check docker ps" >&2
    git -C "$main_root" worktree remove ${FORCE:+--force} "$dir"
  fi
  git -C "$main_root" branch -D "task/$name"
  sync_main_checkout
}

case "${1:-}" in
  new) [[ $# -eq 2 ]] || { echo "usage: $0 new <name>" >&2; exit 2; }; new "$2" ;;
  integrate) "$scripts/lock.sh" integrate "$0" _integrate ;;
  _integrate) integrate ;;
  done) [[ $# -eq 2 ]] || { echo "usage: $0 done <name>" >&2; exit 2; }; done_task "$2" ;;
  *) echo "usage: $0 new <name> | integrate | done <name>" >&2; exit 2 ;;
esac
