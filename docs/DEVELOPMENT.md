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

## Keeping docs current

- A feature document is the specification: if behaviour changes, the document changes in the same commit.
- A new feature gets its own file in `docs/app/features/` and a row in the overview's feature table.
