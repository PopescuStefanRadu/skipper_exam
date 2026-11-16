# Skipper Exam

## Goal

Help a candidate prepare for and pass the Romanian Naval Authority (RNA) exam for the recreational craft operator certificate (*conducător ambarcațiune de agrement*, CAA).

The app does more than tell you whether an answer was right. For every question it can show **why** the correct answer is correct: the relevant passage from the official bibliography, with a precise reference (document, edition, page, rule or article).

Official exam page: https://portal.rna.ro/personal-navigant/conducator-ambarcatiune-de-agrement/examinare-caa/

## Platforms

- **Web:** works in desktop and mobile browsers.
- **Android:** an installable app with the same features, which works fully offline.

Progress belongs to the user's account and is shared across both platforms.

## Features

Each feature has its own document. It describes the expected behaviour and the end-to-end scenarios that prove it.

| Feature | Summary |
|---|---|
| [Exam simulation](features/exam-simulation.md) | A timed, random set of questions in the real exam format, with pass or fail |
| [Explanations](features/explanations.md) | Why an answer is correct: the quoted source passage and a precise reference |
| [Learning and review](features/learning-and-review.md) | Learning mode, "practice my mistakes", coverage and weak topics |
| [Accounts](features/accounts.md) | Sign-up and sign-in, password reset, data export and account deletion |
| [Offline and sync](features/offline-and-sync.md) | Android works without a connection and syncs later |
| [Content](features/content.md) | Question banks, bibliography, question → source links, and how to update them |

## Technical direction (proposed, to be confirmed)

- **Backend:** Go and PostgreSQL. The backend distributes content and syncs progress.
- **Web and Android from one codebase:** a web front end that is also packaged as an Android app. Because Android must work offline, the app logic (choosing questions, scoring, explanations) runs on the device against local content.
- **Accounts:** standard, well-tested authentication, with nothing home-made for password handling.
- **E2E tooling:** browser automation for web scenarios and a mobile UI testing tool for the Android emulator.

## Open points

- The official exam format (questions per exam, time limit, pass mark) still needs confirming from OMTI 427/2026 and the related regulations.
- Which class to prepare first: C, D or both.
- Sign-in method: email and password, Google sign-in, or both.
- Whether to offer a guest mode before sign-up.
