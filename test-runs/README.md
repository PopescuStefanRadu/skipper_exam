# Test run records

Every test run (`make test`, `make e2e`, `make check`, `make test-all`) is recorded here, in a folder named `<UTC start time>_<branch>_<commit>`. The commit is the exact one that was tested. Branches are squashed before they're merged, so the commit may no longer exist. The squashed commit's message lists the original commits, so a record can still be traced to the change it belongs to.

Each folder contains:
- `summary.json`: branch, commit, whether it ran in CI, and each suite's result and duration in milliseconds;
- `<suite>.log`: the readable output of each suite (`lint`, `go`, `e2e`);
- `go-test.json`: the Go test events (`go test -json`), including per-test timings;
- `e2e.json`: the Playwright results, including per-test timings and retries;
- `stack.env`: the ports the e2e stack used;
- `screenshots/<platform>/`: the screenshot tour's images, when the tour ran. They aren't committed.

CI runs aren't committed. They're uploaded as the `test-runs` artifact of each workflow run.
