# Development practices

The app itself is documented in [app/](app/README.md).

## E2E-first

Every user-facing behaviour is proven by an end-to-end (e2e) scenario. Each scenario runs against the full system (real database, backend and user interface) and drives the app the way a user would. The scenarios are listed in each feature document under `docs/app/features/`.

The loop for any change:
1. Update the feature document: its behaviour and its scenarios.
2. Write or update the e2e test. It should fail.
3. Implement until it passes.
4. Run the whole e2e suite, then the lower-level tests. A change is done only when everything is green.

Rules:
- **One command** starts the whole system and runs the tests, both locally and in CI.
- **Lower-level tests** are added where they give faster or more precise feedback (parsing, scoring, sync rules). They support the e2e tests, they don't replace them.
- **Cover main paths and the relevant less common ones.** Edge cases that a user can actually hit belong in e2e tests. Pure internal edge cases belong in lower-level tests.
- **Both platforms:** web scenarios run in a browser, Android scenarios on an emulator. Shared behaviour is tested mostly on the web, and Android tests focus on what's specific to the device (offline use, sync, installation).

## Test data

- E2E tests use a small, **fixed test content set** (questions, sources and links), not the real banks. That keeps them deterministic: random choices take a known seed, timers can be sped up, email goes to a fake inbox, and Google sign-in goes to a fake provider.
- A separate **content validation** checks the real question banks, the bibliography and the links. It runs on every content update.

## Parallel work: one worktree per task

Several tasks can be developed at the same time, by people or by parallel agents. Each task lives in its own git worktree on its own branch.

1. **Start:** create a worktree and a branch from the latest `main`, one per task.
2. **Work:** use the normal e2e-first loop inside the worktree, against that worktree's own environment (see below).
3. **Integrate:** rebase onto the latest `main`, run the full suite again, then fast-forward `main`. Integration happens **one branch at a time**, under a shared lock, so `main` is always a rebased, tested state. If `main` moves while a branch is being tested, rebase and test again.
4. **Clean up:** stop the worktree's environment, remove its data, then remove the worktree and the branch.

Tasks run in parallel only when they're independent, for example separate features or separate content batches. Work that touches the same area is done in sequence.

## Isolated environments

Every worktree runs its own complete stack (database, backend, accounts, fake mail, fake Google sign-in, web app), so parallel branches never share state.

- **Separate names:** each stack's containers, networks and volumes are named after its worktree, so stacks can't collide.
- **No fixed ports:** services take free ports assigned by the system at start-up, and the actual ports are written to the worktree's environment file for the tests to read. Nothing assumes a well-known port.
- **Locks only where needed:** when a tool needs its port, or another scarce resource, known before it starts, the allocation goes through a lock shared by all worktrees. Android emulators are limited to a fixed number of slots, because they're too heavy to run without a limit.
- **Reuse within a worktree:** the stack starts once and stays up between test runs. The test command starts it if it isn't running.

## Parallel tests within a branch

The suite is built to run with many workers at once:

- **No shared mutable state:** every test creates its own user, with a unique email, and its own data. Tests never depend on each other's order and never reset the whole database.
- **Read-only shared content:** the fixed test content set is loaded once per stack and never modified by tests. A test that needs different content uses its own copy.
- **Per-test control of time and randomness:** timers and random seeds are controlled inside each test, never globally.
- **Isolated helpers:** each test reads only its own messages from the fake inbox (filtered by its unique email address) and uses its own fake Google identity.
- **Lower-level tests** run in parallel too. Database tests each get their own fresh database, cloned quickly from a prepared template.
- A test that can't follow these rules is fixed, not serialised. Slow or flaky tests are treated as bugs.

## Keeping docs current

- A feature document is the specification: if behaviour changes, the document changes in the same commit.
- A new feature gets its own file in `docs/app/features/` and a row in the overview's feature table.
