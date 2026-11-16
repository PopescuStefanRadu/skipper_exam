# Development flow

What the app does and why is in [PRODUCT.md](PRODUCT.md). This document describes how we build and update it.

## Principle: end-to-end tests first

Every user-facing behaviour is described by an end-to-end (e2e) scenario that runs against the full running system: the real database, backend and user interface, driven like a real user would.

The loop for any change:

1. **Describe the behaviour as an e2e scenario first** (or update an existing one). It should fail.
2. **Implement** until the scenario passes.
3. **Run the whole e2e suite** to catch regressions, then the faster lower-level tests.
4. Fix whatever broke and repeat until everything passes. A change is done only when the suite is green.

Lower-level tests (for example the question importer or scoring rules) are added where they give faster or more precise feedback. They support the e2e tests, they don't replace them.

The whole system must be startable and testable with **one command** on a developer machine, and the same command runs in CI. That keeps the feedback loop short.

### Test data
- E2E tests run against a small **fixed test question bank** with fixed sources. That way they're deterministic: random choices use a known seed, and timers can be sped up.
- A separate check validates the **real** content (both question banks, the bibliography and the links). It runs on every content update.

### E2E scenarios

Main paths:
- Take an exam simulation in class C (and D), answer everything correctly, and get a pass.
- Take an exam with some wrong answers, get a fail, and see the list of wrong answers.
- Open the explanation for a wrong answer and see the correct answer, the quoted passage and the reference (document, edition, page, rule), then open the source at that page.
- Learning mode: answer a question and get immediate feedback and the explanation.
- "Practice my mistakes" contains exactly the questions answered wrong before.
- Progress made on the web is visible on Android, and the other way round.

Less common paths:
- The timer runs out mid-exam: the exam is submitted automatically and unanswered questions count as wrong.
- Submitting with unanswered questions: you're asked to confirm, and the result counts them as wrong.
- Leaving an exam halfway (closing the tab or app) and coming back: you can resume or abandon it.
- A question with no *verified* source link shows "explanation not yet verified", not a wrong or empty explanation.
- After a content update that changes or removes a question you answered before, your history is still shown correctly and removed questions leave practice.
- Android with no connection: practice still works and progress syncs when the connection returns (if offline support is confirmed).
- The backend is unavailable: you get a clear error message, not a blank screen or lost answers.

Web scenarios run in a browser. Android scenarios run on an emulator. The core flows are covered on both platforms.

## Updating content

### When RNA publishes a new question bank
1. Download the new PDF and add it as a new version. The old version is kept.
2. Run the importer. It extracts the questions and checks them: 3 answers each, exactly one correct, no gaps, clean text.
3. Review the **change report**: new, changed and removed questions. A changed question's source links become *stale*.
4. Create or review source links for new and *stale* questions.
5. Run the content validation and the full e2e suite, then publish.

### When a bibliography document changes
1. Add the new document version. The old one is kept.
2. Re-locate every linked passage in the new version: same text, possibly a different page. Links whose passage can't be found automatically become *stale*.
3. Review the *stale* links, then validate and publish as above.

### Creating source links
- For each question, candidate passages are proposed automatically, for example by searching the bibliography for the question and answer wording. Every candidate starts as *suggested*.
- A person reviews each suggestion and marks it *verified*, or corrects it. Only *verified* links are shown as explanations.
- If the source seems to contradict the official answer, the question is flagged.

## Technical direction (proposed, to be confirmed)

- **Backend:** Go and PostgreSQL. This repo already uses them.
- **Web and Android from one codebase:** a web front end, also packaged as an Android app. Most behaviour can then be tested once in the browser, and Android e2e tests cover what's specific to the device.
- **E2E tooling:** a browser automation tool for web scenarios and a mobile UI testing tool for the Android emulator, both runnable locally and in CI.
