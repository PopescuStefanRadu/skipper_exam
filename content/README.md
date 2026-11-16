# Content

The app's content, as described in `docs/app/features/content.md`.

- `sources/`: stored copies of the source documents, exactly as published.
- `sources.json`: one entry per source document, with its URL, publication date, retrieval date and sha256.
- `questions.json`: the shared question pool. Question IDs (`q0001`, …) never change and are never reused.
- `banks/<id>.json`: one RNA question list each (`C`, `D`). It lists the pool questions in RNA order, with RNA's section and number. The lists are made of untitled sections, and the numbering restarts in each one.

Commands:
- `make content-validate`: check everything. The same check runs as a Go test in every test run.
- `make content-import-rna BANK=C [LAST_MODIFIED=2026-07-07]`: after replacing `sources/rna/Lista-intrebari-clasa-C-CAA.pdf` with a new version, re-import it. This prints the change report: new, changed, removed and shared questions.
