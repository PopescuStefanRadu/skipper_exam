# History and statistics

## Behaviour

- The **progress page** (`/progres`, "Istoric și statistici", linked from the home page) shows how your preparation is going. Like the rest of the app, it's computed on the device from your events, so it works offline and is the same on every device after syncing.
- **Exam summary**, over the submitted simulated exams:
  - exams taken, and how many passed (with the pass rate);
  - the average score of the last 5 exams, the number that best says whether you're ready;
  - the best score.
- **Score trend**: a bar chart of the last 20 submitted exams' scores, oldest on the left, with the pass mark drawn as a line. Each bar names its exam (date, type, score) on hover and to screen readers.
- **Exam history**: every exam you finished, newest first: when it was taken, its exam type, the score (correct answers out of the total, and the percentage), passed or failed, how long it took, and whether the time ran out. Each submitted exam links to its result page. Abandoned exams are listed as abandoned, without a score.
- With several exam types (for example Class C and Class D), a filter above the page shows all of them or one type; the summary, the chart and the history follow it.
- **Practice activity**, from learning mode and "practice my mistakes":
  - answers given and how many were right;
  - **days in a row** you've studied (an exam or practice answer counts), counting today or, if you haven't studied yet today, up to yesterday;
  - a bar chart of the answers per day over the last 14 days.
- Coverage and weak subjects stay on the [learning page](learning-and-review.md), which the progress page links to.
- With no exams yet, the page says so and offers to start one instead of showing empty figures.

## E2E scenarios

Main paths:
- After a passed and a failed exam, the history lists both, newest first, with their scores and passed/failed, and links to their results; the summary shows 2 exams, 1 passed (50%), the average and the best score.
- Practice answers show up in the practice activity: the number of answers, how many were right, and 1 day in a row.

Less common paths:
- With no exams, the page says there are none yet and offers to start one.
- An abandoned exam is listed as abandoned, without a score, and doesn't count in the summary.
- With Class C and Class D chosen, filtering by Class D shows only the Class D exams.
