# Exam types

The user chooses the exam they're preparing for. That choice decides which questions they practise in every mode: [exam simulation](exam-simulation.md), [learning and review](learning-and-review.md), and coverage.

## Exam types defined by the regulation

Source: OMTI 427/2026, *Regulament privind cerințele minime de pregătire și condițiile de obținere a certificatelor internaționale de conducător de ambarcațiune de agrement*. Classes are defined by navigation zone (Art. 2). The ways to obtain each class are listed in Annex 1.

| Exam type | Who takes it | Navigation zone | Question material |
|---|---|---|---|
| **Class C** | After an approved class C course | Sea, up to 6 Mm from shore | RNA class C list (mainly COLREG) |
| **Class D** | After an approved class D course | Inland waterways only | RNA class D list (mainly R.N.D.) |
| **Class C, difference exam** | Holders of class D | as class C | The class C list's COLREG questions (Annex 1, III.1(b)) |
| **Class D, difference exam** | Holders of class C | as class D | The class D list's R.N.D. questions (Annex 1, IV.1(b)) |
| **Class B** | Class C or D for at least 2 years, plus a course | Sea, up to 24 Mm | No official list published |
| **Class A** | Class B for at least 2 years, plus a course | All waters | No official list published |

Not exam types:
- **Class S** (sailing, Art. 4) is added after an approved sailing course, without an exam.
- **Ex officio issue** to holders of professional certificates involves no exam.

## Behaviour

- Right after signing up, or after the first sign-in of an account that has none yet, the user picks the exam types they're preparing for: one or several, for example Class C and Class D at the same time. Nothing else in the app is reachable until at least one is chosen. The choice can be changed at any time later. The app remembers it per account, so it follows the user across devices.
- With several exam types, each keeps its own simulated exam (the real exams are separate), while learning covers all their questions together: a question shared between them, or two equivalent ones, counts once (see [learning and review](learning-and-review.md)).
- An exam type is defined by:
  - which questions it draws from: question banks, filtered by subject for the difference exams;
  - the exam format: number of questions, time limit and pass mark.
- Every question is tagged with its subject (for example COLREG or R.N.D.), so the difference exams can be put together from the full lists.
- Class A and B are shown as "not available yet" until official question material exists.
- Progress is kept per question. Questions shared between exam types (for example a COLREG question used by both Class C and the C difference exam) count toward both.
- The exam types and their formats are content, in `content/exam-types.json`, not code. Each format records whether it's confirmed by an official source or still an assumption, and the user sees when the format is unconfirmed. Until official values are found, full exams assume 40 questions in 45 minutes and difference exams 20 questions in 30 minutes, both with an 80% pass mark. Validation checks that every available exam type has enough questions for one exam.
- The server accepts only available exam types, and at least one.

## Unknowns

- The regulation doesn't give the number of questions, the time limit, the pass mark or any practical part. Art. 9 delegates these to an ANR methodology that isn't published on the RNA portal. Possible sources: the methodology itself (on request from ANR, rna@rna.ro), approved training schools, or people who have taken the exam recently.
- RNA says the published lists are "only a part" of the exam questions. The app should state this clearly.

## E2E scenarios

Main paths:
- A new user picks "Class D" right after signing up. The choice is kept after a reload and on another device.
- A user changes from "Class D" to "Class C, difference exam".
- A user preparing for Class C and Class D at the same time chooses both. The home page offers one simulated exam per class, each with only that class's questions, and the learning page covers the subjects of both lists.
- Once practice exists: exams and learning mode use only the chosen exam type's questions, and changing the exam type keeps the user's history.

Less common paths:
- Class A and B are listed as not available and can't be selected. The server refuses them too.
- Saving needs at least one exam type; the server refuses an empty choice.
- A signed-in user without an exam type is sent to choose one before anything else.
- An exam type whose format is unconfirmed shows a visible "format not confirmed" note on the exam screen.
- The exam types chosen on the web are the ones used on Android, including offline after the next sync.
