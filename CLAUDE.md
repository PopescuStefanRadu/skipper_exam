# Project instructions

## Read first

- `docs/PRODUCT.md`: the app's goal, its features (exam simulation, answer explanations linked to the bibliography, learning mode, progress), and the content and versioning rules for question banks, bibliography and source links.
- `docs/DEVELOPMENT.md`: the development flow, the list of e2e scenarios, and how to update content when RNA changes the questions or the bibliography.

Work **e2e-first**. Write or update the end-to-end scenario before implementing, then iterate until the full e2e suite passes. Keep both docs current when features or the content flow change.

## Project status

Early-stage Go project (module `github.com/PopescuStefanRadu/skipper_exam`, Go 1.23) for an exam/quiz backend. Most code is still stubs:
- `cli/server/main.go` has an empty `main`.
- `pkg/skipperexam/game/service.go` has `NewGame` with no body, so `go build ./...` currently fails until it returns a value.
- There are no tests, linter config, or migrations yet.

## Commands

Use the `Makefile`. Run `make` on its own to list the targets.

```sh
make build                 # build everything
make run                   # run the server entrypoint
make test                  # run all tests
make test RUN=TestName PKG=./pkg/skipperexam/game   # run a single test
make check                 # fmt + vet + test
make db-up / make db-down  # start/stop Postgres 17.2 (user/password: skipper_exam)
```

`docker-compose.yaml` doesn't publish a host port. To connect from the host, add `ports: ["5432:5432"]` or run the server in a container on the same network. No `POSTGRES_DB` is set, so the default database name is `skipper_exam`, the same as the user.

## Architecture

- `cli/<binary>/main.go` holds the executable entrypoints. `pkg/skipperexam/<domain>` holds the domain packages.
- `pkg/skipperexam/game` models a quiz session. A `Game` has an ID, an optional `UserId` (a `*string`, so anonymous games are allowed) and a list of `Question`s. Each `Question` has text, an optional image (`[]byte`), multiple-choice `Answer`s and `CorrectAnswer`, which holds the `Answer.Identifier` of the right choice.
- `game.Service` is the persistence and business layer and depends on a `*sql.DB`. The planned database is Postgres via `github.com/jackc/pgx/v5`, which is in `go.mod` but not imported yet (likely through the `pgx/v5/stdlib` `database/sql` driver). Run `go mod tidy` once it's imported so it moves out of the `// indirect` block.
