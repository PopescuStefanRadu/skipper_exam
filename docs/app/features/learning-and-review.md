# Learning and review

## Behaviour

- The **learning page** (`/invatare`, linked from the home page) covers the chosen [exam type](exam-types.md)'s questions, subject by subject. For each subject it shows:
  - **seen**: how many of the subject's questions you've answered at least once;
  - **mastered**: how many you answered correctly the last time;
  - **mistakes**: how many you answered wrong the last time.
  Equivalent questions (see [content](content.md)) count as one question and share their history.
- A subject is marked **weak** once you've answered at least 5 of its questions and fewer of them are mastered than the exam's pass mark (for example, under 80%).
- **Learning mode** (`/invatare/<subject>`, or every subject in order): one question at a time, with the answers in shuffled order. After an answer you see at once whether it was right, the correct answer and the [explanation](explanations.md), then **Next** moves on. A session goes through the subject's questions in order, starting with the first one you haven't seen yet; once you've seen them all, it starts again from the beginning.
- **Practice my mistakes** (`/invatare/greseli`): a session of the questions whose last answer was wrong. Questions answered wrong more often come first, and among those the most recent mistakes come first. The list is fixed when the session starts. A question answered correctly leaves the list for the next session. At the end the session shows how many you got right this time.
- With no mistakes, "practice my mistakes" says there's nothing to review instead of starting an empty session.
- All answers count toward your history, whatever the mode. An exam's answers count once the exam is submitted. Questions left unanswered don't count as seen. Practice answers are events, like exam steps, so they work offline and sync between devices (see [offline and sync](offline-and-sync.md)).

## E2E scenarios

Main paths:
- Learning mode: answer a question and get immediate feedback (right or wrong, the correct answer) and the explanation, then move on to the next question.
- "Practice my mistakes" contains exactly the questions answered wrong before, in exams and in learning mode, and a question answered right in that session no longer appears in the next one.
- The learning page shows each subject's seen, mastered and mistakes counts after an exam and some practice, and marks a subject as weak.

Less common paths:
- With no mistakes yet, "practice my mistakes" says there's nothing to review instead of starting an empty session.
- A learning session continues from the first question not seen yet.
- An unfinished exam's answers don't count yet.
