#!/usr/bin/env bash
# Runs test suites and records the run in test-runs/<date>_<branch>_<commit>/
# (see "Test run records" in docs/DEVELOPMENT.md).
#
#   test-run.sh <suite>...     suites: lint, go, e2e, deploy, android
#
#   lint  gofmt check, go vet, web and e2e type checks
#   go    Go tests (GO_TEST_ARGS: extra arguments, e.g. "-run TestX ./pkg/...")
#   e2e   start this worktree's stack, then the Playwright suite (E2E_ARGS: extra arguments)
#   deploy  the production setup with this commit's images: start, back up, restore (scripts/deploy-test.sh)
#   android  build the Android app and run its Maestro flows on an emulator (scripts/android.sh)
#
# Every run must belong to a commit, so uncommitted changes (other than test
# records) make it refuse to start. Suites run in the given order and the run
# stops at the first failure; later suites are recorded as skipped.
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"

if [[ $# -eq 0 ]]; then
  echo "usage: $0 lint|go|e2e|deploy|android..." >&2
  exit 2
fi

if [[ -n "$(git status --porcelain -- . ':!test-runs')" ]]; then
  echo "uncommitted changes: commit first, so this test run is recorded against a commit" >&2
  git status --short -- . ':!test-runs' >&2
  exit 1
fi

commit=$(git rev-parse --short=12 HEAD)
# In CI the checkout is a detached merge or push commit; use the branch name CI provides.
branch=${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}}
branch_slug=$(printf '%s' "$branch" | tr -c 'A-Za-z0-9._\n-' '-')
started=$(date -u +%Y-%m-%dT%H-%M-%SZ)
dir="test-runs/${started}_${branch_slug}_${commit}"
mkdir -p "$dir"
export TEST_RUN_DIR="$root/$dir"
echo "recording test run in $dir"

run_lint() {
  local unformatted
  unformatted=$(gofmt -l $(git ls-files '*.go'))
  if [[ -n "$unformatted" ]]; then
    echo "not gofmt-formatted (run make fmt):"
    echo "$unformatted"
    return 1
  fi
  go vet ./...
  (cd web && pnpm --silent typecheck)
  (cd e2e && pnpm --silent exec tsc -p .)
}

run_go() {
  local status=0
  # shellcheck disable=SC2086 # GO_TEST_ARGS is a list of arguments
  go test -json ${GO_TEST_ARGS:-./...} >"$TEST_RUN_DIR/go-test.json" || status=$?
  # Human-readable output from the JSON stream: package results and any test output.
  jq -j 'select(.Action == "output") | .Output' "$TEST_RUN_DIR/go-test.json" |
    grep -vE '^(=== (RUN|PAUSE|CONT|NAME)|--- PASS)' || true
  return $status
}

run_e2e() {
  scripts/stack.sh up
  cp .stack.env "$TEST_RUN_DIR/stack.env"
  # shellcheck disable=SC2086 # E2E_ARGS is a list of arguments
  (cd e2e && pnpm --silent exec playwright test ${E2E_ARGS:-})
}

run_deploy() {
  scripts/deploy-test.sh
}

run_android() {
  scripts/android.sh e2e
}

summary_suites=()
overall=passed
for suite in "$@"; do
  if [[ "$overall" == failed ]]; then
    summary_suites+=("{\"name\":\"$suite\",\"status\":\"skipped\",\"ms\":0}")
    continue
  fi
  case "$suite" in
    lint | go | e2e | deploy | android) ;;
    *) echo "unknown suite: $suite" >&2; exit 2 ;;
  esac
  echo "== $suite"
  start=$(date +%s%N)
  status=passed
  # The subshell keeps errexit on inside the suite, so its first failing command fails it.
  set +e
  (set -e; "run_$suite") 2>&1 | tee "$TEST_RUN_DIR/$suite.log"
  rc=${PIPESTATUS[0]}
  set -e
  [[ $rc -eq 0 ]] || status=failed
  ms=$((($(date +%s%N) - start) / 1000000))
  summary_suites+=("{\"name\":\"$suite\",\"status\":\"$status\",\"ms\":$ms}")
  if [[ "$status" == failed ]]; then
    overall=failed
    echo "== $suite failed"
  fi
done

suites_json=$(IFS=,; echo "[${summary_suites[*]}]")
jq -n \
  --arg started "$started" --arg branch "$branch" --arg commit "$(git rev-parse HEAD)" \
  --arg suites_requested "$*" --arg result "$overall" --argjson ci "${CI:-false}" \
  --argjson suites "$suites_json" \
  '{started: $started, branch: $branch, commit: $commit, ci: $ci, suites_requested: ($suites_requested | split(" ")), suites: $suites, result: $result}' \
  >"$TEST_RUN_DIR/summary.json"
echo "test run $overall: $dir"
[[ "$overall" == passed ]]
