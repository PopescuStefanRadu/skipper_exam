# Project instructions

## Read first

- `docs/DEVELOPMENT.md`: the development practices, especially the e2e-first loop.
- `docs/app/README.md`: the app overview (goal, platforms, technical direction, open points) and the index of feature documents. Each feature document in `docs/app/features/` holds that feature's behaviour and its e2e scenarios. `docs/app/features/content.md` describes how to update the question banks, the bibliography and the source links.

Work **e2e-first**. Update the feature document and its e2e scenario before implementing, then iterate until the full e2e suite passes. Parallel tasks use one git worktree and branch each, with an isolated stack on free ports. Every test target records its run in `test-runs/<date>_<branch>_<sha>/` and refuses to run with uncommitted changes, so commit (a `wip:` commit is fine) before running tests. Commit the records along with your work. Changes reach `main` only through a pull request, using `make integrate`, which squashes the branch into one commit listing the original commit shas. Never push to `main` directly; GitHub blocks it. Pull-request descriptions and commit messages must not mention any AI tool. See `docs/DEVELOPMENT.md`.

## Project status

Milestone 0 (foundations) is in place: the backend, the web app shell, the full stack on free ports, parallel e2e tests, the worktree tooling and CI. Milestone 1 imported both RNA question lists into `content/` (737 unique questions). No user-facing product features exist yet.

## Commands

Use the `Makefile`. Run `make` on its own to list the targets.

```sh
make setup                 # install web/e2e dependencies and the Playwright browser (once per worktree)
make up / make down        # start/stop this worktree's stack; `up` writes the actual ports to .stack.env
make e2e                   # start the stack if needed, then run the e2e suite in parallel (all test targets need a clean, committed tree)
make e2e ARGS="-g 'deep link'"                        # run matching e2e tests only
make test                  # Go tests
make test RUN=TestName PKG=./pkg/skipperexam/server   # a single Go test
make fmt                   # format Go code
make check                 # lint (gofmt check, vet, type checks) + Go tests
make test-all              # check + e2e: what integration and CI run
make dev                   # web app with hot reload, using this worktree's backend
make task-new NAME=x       # new worktree .worktrees/x on branch task/x, from the latest origin/main
make integrate TITLE="..." # inside a task worktree: squash, rebase, test-all, record, push, PR, wait for CI, merge; repeats if main moves
make task-done NAME=x      # after the PR is merged: stop the stack, remove the worktree and the branch
```

## Architecture

- **Backend** (Go): `cli/server` is the entrypoint. It reads `DATABASE_URL`, `KRATOS_PUBLIC_URL`, `CONTENT_DIR` (default `content`; `/content` in the image), `LISTEN_ADDR` (default `:8080`) and optionally `WEB_DIR` from the environment. At start-up it applies the database migrations (`pkg/skipperexam/db`, goose, SQL files embedded from `pkg/skipperexam/db/migrations/`) and loads the content. `pkg/skipperexam/server` holds the HTTP handlers: `/api/*` is the JSON API, and every other path serves the built web app, falling back to `index.html` for client-side routes. Postgres is accessed through `pgx/v5` (`pgxpool`). The app's own data about an account (its exam type) is in `profiles`, keyed by the Kratos identity ID (`pkg/skipperexam/profile`); `GET/PUT /api/profile` read and change it, and `GET /api/exam-types` lists `content/exam-types.json`.
- **Accounts** (Ory Kratos): the backend proxies Kratos's public API under `/.ory/` on the app's own origin, so the web app, the API and the session cookies share one origin. `/api/me` resolves the session through Kratos's `whoami`. Kratos's configuration is generated from `docker/kratos/kratos.yml.tmpl` (with the stack's app URL and per-stack secrets) into `.stack/kratos.yml`; the identity schema is `docker/kratos/identity.schema.json`. The web app draws its own Romanian forms on top of Kratos's browser flows (`web/src/kratos.ts`) and maps Kratos message IDs to Romanian texts. In the stack, Kratos sends email to Mailpit, and "Google" is a mock OpenID Connect server (`mock-oidc`) that runs in Kratos's network on a reserved port, so Kratos and the browser reach it at the same address. Google claims are mapped to traits by `docker/kratos/oidc.google.jsonnet`, which requires a verified email. E2E tests sign in through it with `continueWithGoogle()`.
- **Content** (`content/`, see `content/README.md`): stored source PDFs, `sources.json`, the shared question pool `questions.json`, and one file per RNA bank in `banks/`. `cli/content` imports and validates it. `pkg/skipperexam/content` holds the model and the import rules that keep question IDs stable (identical questions are shared across banks, slightly changed ones keep their ID). `pkg/skipperexam/content/rnapdf` rebuilds the RNA PDFs' Excel tables from their drawn cell borders, dropping hidden narrow columns. Each question has one subject, assigned by RNA number ranges in `content/subject-ranges.json` (`make content-tag`). Equivalent questions (same apart from diacritics, punctuation or case) are grouped by `EquivalenceGroups()` and share progress. `TestRealContentIsValid` validates the real content in every test run.
- **Web app** (`web/`, React + TypeScript + Vite, pnpm): it calls the backend on the same origin under `/api`. All interface text is in `web/src/strings.ts`.
- **E2E tests** (`e2e/`, Playwright): they read the stack's addresses from `.stack.env` (`APP_URL`, `KRATOS_ADMIN_URL`, `MAILPIT_URL`) and run fully parallel. Each test must create its own data (see "Parallel tests within a branch" in `docs/DEVELOPMENT.md`). Use the helpers in `e2e/tests/helpers.ts`: a unique email per test, and `createAccount()` (through the Kratos admin API) when a test only needs an existing account.
- **Stack**: `compose.yaml` and `Dockerfile` build one app image (Go binary + built web app on distroless) and run it next to Postgres 17.2 (with a separate `kratos` database), Kratos and Mailpit. `scripts/stack.sh` names the Compose project after the worktree and lets Docker assign host ports, so stacks in different worktrees run side by side. The app's port and the mock Google server's port are the exceptions: Kratos must know both addresses before it starts, so `stack.sh` reserves free ports under the `ports` lock and holds the lock until Docker has bound them. `scripts/lock.sh` provides named locks shared by all worktrees; integration runs under the `integrate` lock.
- **Test runs**: `scripts/test-run.sh` runs the suites (`lint`, `go`, `e2e`) and writes the record of the run; every test target in the Makefile goes through it.
- CI (`.github/workflows/ci.yml`) runs `make setup` and `make test-all`, and uploads `test-runs/` as an artifact.
