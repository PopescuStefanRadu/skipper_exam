# Exam simulation

## Behaviour

- Get a random set of questions for your chosen [exam type](exam-types.md), in the same format as the real exam.
- A timer runs and you get pass or fail at the end. The question count, time limit and pass mark come from the exam type's format.
- The order of the answers is shuffled so you learn the content, not the position.
- At the end you see your score and every wrong answer, each with its [explanation](explanations.md).
- An exam left halfway can be resumed or abandoned.

## E2E scenarios

Main paths:
- Take an exam for the chosen exam type, answer everything correctly, and get a pass.
- Take an exam with some wrong answers, get a fail, and see the list of wrong answers.

Less common paths:
- The timer runs out mid-exam: the exam is submitted automatically and unanswered questions count as wrong.
- Submitting with unanswered questions: you're asked to confirm, and the result counts them as wrong.
- Leaving an exam halfway (closing the tab or app) and coming back: you can resume or abandon it.
