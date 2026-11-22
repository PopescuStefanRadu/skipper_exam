# Skipper Exam

## Goal

Help a candidate prepare for and pass the Romanian Naval Authority (RNA) exam for the recreational craft operator certificate (*conducător ambarcațiune de agrement*, CAA).

The app does more than tell you whether an answer was right. For every question it can show **why** the correct answer is correct: the relevant passage from the official bibliography, with a precise reference (document, edition, page, rule or article).

Official exam page: https://portal.rna.ro/personal-navigant/conducator-ambarcatiune-de-agrement/examinare-caa/

## Platforms

- **Web:** works in desktop and mobile browsers.
- **Android:** an installable app with the same features, which works fully offline.

Progress belongs to the user's account and is shared across both platforms.

## Language

The interface is in Romanian, like the questions and the source material. The exception is short navigation words such as *Next*, *Previous*, *Back* and *Submit*, which stay in English because the Romanian versions read awkwardly. Interface text is kept in one place so wording can be changed without touching features.

## Visual design

One calm, nautical look on every screen, in light and dark mode (following the device's setting): a navy top bar with the app's name and the account, content in cards, one primary action per screen, and answers as large tappable cards. Pass and right answers are green, fail and wrong answers red, unverified and warnings amber. Colours are defined once as tokens in `web/src/index.css`, and fonts are the device's own, so nothing is downloaded and the app looks the same offline. On phones, every control is at least 44px high and nothing is wider than the screen. The screenshot tour covers light and dark mode.

## Features

Each feature has its own document. It describes the expected behaviour and the end-to-end scenarios that prove it.

| Feature | Summary |
|---|---|
| [Exam types](features/exam-types.md) | The exam the user is preparing for (Class C, D, difference exams); decides which questions are practised |
| [Exam simulation](features/exam-simulation.md) | A timed, random set of questions in the real exam format, with pass or fail |
| [Explanations](features/explanations.md) | Why an answer is correct: the quoted source passage and a precise reference |
| [Learning and review](features/learning-and-review.md) | Learning mode, "practice my mistakes", coverage and weak topics |
| [Accounts](features/accounts.md) | Sign-in with Google through esrp.ro's sign-in service, data export and account deletion |
| [Offline and sync](features/offline-and-sync.md) | Android works without a connection and syncs later |
| [Privacy policy and terms](features/legal.md) | The operator, what data is kept and why, the user's rights, and the terms of use |
| [Content](features/content.md) | Question banks, bibliography, question → source links, and how to update them |

## Technical direction

- **Backend:** Go and PostgreSQL. The backend distributes content and syncs progress.
- **Web and Android from one codebase (decided):** a web front end that is also packaged as an Android app, rather than a separate native Android app. This keeps one implementation of every feature, and most e2e tests can run in a browser. If a native capability is ever needed, it's added as a native piece inside the packaged app. Because Android must work offline, the app logic (choosing questions, scoring, explanations) runs on the device against local content.
- **Accounts:** one way to sign in, shared with esrp.ro's other apps: Google, through esrp.ro's sign-in service (Authentik), with OpenID Connect. The app never handles passwords. After sign-in it keeps its own long-lived session (a cookie on the website, a token in the Android app), so the app works offline and the sign-in service only needs to be up when someone signs in.
- **Hosting:** the backend runs on a home server at https://skipperexam.esrp.ro, deployed by the esrp.ro hosting project, which also provides HTTPS. This repository publishes the images and the production setup (`deploy/`), with nightly database backups; see [Deployment](../DEPLOYMENT.md). It's packaged so it runs the same way anywhere, and can move to a hosted server later. Because Android works offline, short outages at home only delay syncing.
- **Android distribution:** development builds installed directly on the device at first (`make android-build SERVER_URL=https://...`, then install the APK), then Google Play. The app is built for one server address. It allows plain HTTP only to the device itself (the test setup); everything else must be HTTPS.
- **E2E tooling:** browser automation for web scenarios and a mobile UI testing tool for the Android emulator.
- **Progress as an append-only record:** answers are stored as a growing list, never overwritten. Offline use and syncing between devices then come down to merging lists.

### Chosen tools

| Area | Tool |
|---|---|
| Backend | Go, PostgreSQL |
| App (web and Android) | TypeScript and React, installable in the browser and usable offline |
| Android packaging | Capacitor, with on-device storage for offline content and progress |
| Accounts | Authentik at auth.esrp.ro (OpenID Connect, Google only); the app's own sessions in PostgreSQL |
| Web e2e tests | Playwright |
| Android e2e tests | Maestro, on an emulator |
| Fake sign-in in tests | A mock OpenID Connect server standing in for Authentik and Google |
| Content tools | Command-line importer for the RNA PDFs; Tesseract OCR (Romanian) for scanned documents |
| Full stack and all tests | Docker Compose, started through `make`, on the development machine (no CI for now) |

## Open points

- The official exam format (questions per exam, time limit, pass mark) isn't in OMTI 427/2026. It's delegated to an unpublished ANR methodology (see [Exam types](features/exam-types.md)).
