# Exam simulation

## Behaviour

- The home page shows the chosen [exam type](exam-types.md)'s format (number of questions, time limit, pass mark) and starts an exam. While the format isn't confirmed by an official source, a "format not confirmed" note is shown next to it and on the exam screen.
- An exam is a random set of questions from the exam type's questions, as many as the format says. Two equivalent questions (the same apart from diacritics, punctuation or case) never appear in the same exam, and questions whose source has no single correct answer are left out.
- The order of the answers is shuffled for every exam, so you learn the content, not the position.
- The exam screen shows one question at a time with "Întrebarea 3 din 40", the time left, and the navigation buttons **Previous**, **Next** and **Submit** (in English, see the language rule in the [app overview](../README.md)). An answer can be changed until the exam is submitted.
- The timer counts down from the format's time limit. When it reaches zero the exam is submitted automatically, and unanswered questions count as wrong.
- Submitting with unanswered questions asks for confirmation first, stating how many are unanswered. **Back** returns to the exam.
- The result shows pass or fail ("Admis" or "Respins"), the score and the pass mark, and every question answered wrong or left unanswered, with the answer given and the correct one. Their [explanations](explanations.md) are added there once they exist.
- An exam left halfway (the tab or app closed, or the page reloaded) is offered on the home page to be resumed or abandoned. The timer keeps running while you're away: an exam whose time ran out while you were away is submitted as it was, and its result is shown.
- Exams work offline (see [offline and sync](offline-and-sync.md)). The app downloads the question content once and runs the exam on the device. Every step of an exam (started, answered, submitted, abandoned) is recorded on the device as an event and sent to the server when it's reachable, so an exam started on one device can be resumed on another.

## E2E scenarios

The tests use the real question content, read through the same API as the app, to know the correct answers. The timer is controlled with Playwright's clock.

Main paths:
- Take an exam for the chosen exam type, answer everything correctly, and get a pass.
- Take an exam with some wrong answers, get a fail, and see the list of wrong answers with the answer given and the correct one.
- An exam only contains questions of the chosen exam type (for example, only COLREG questions in the class C difference exam), without repeats or equivalent pairs.

Less common paths:
- The timer runs out mid-exam: the exam is submitted automatically and unanswered questions count as wrong.
- Submitting with unanswered questions: you're asked to confirm, and the result counts them as wrong. **Back** returns to the exam.
- Leaving an exam halfway and coming back: you can resume it where you left off, with your answers kept, or abandon it.
- Leaving an exam and coming back after its time ran out: the result is shown.
- An exam started on one device can be resumed on another.
- The format-not-confirmed note is shown on the home page and on the exam screen.
