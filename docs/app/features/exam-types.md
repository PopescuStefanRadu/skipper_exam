# Exam types

The user chooses the exam they're preparing for. That choice decides which questions they practise in every mode: [exam simulation](exam-simulation.md), [learning and review](learning-and-review.md), and coverage.

## Exam types defined by the regulation

Source: OMTI 427/2026, *Regulament privind cerințele minime de pregătire și condițiile de obținere a certificatelor internaționale de conducător de ambarcațiune de agrement*. Classes are defined by navigation zone (Art. 2). The ways to obtain each class are listed in Annex 1.

| Exam type | Who takes it | Navigation zone | Question material |
|---|---|---|---|
| **Class C** | After an approved class C course | Sea, up to 6 Mm from shore | RNA class C list (mainly COLREG) |
| **Class D** | After an approved class D course | Inland waterways only | RNA class D list (mainly R.N.D.) |
| **Class C, difference exam** | Holders of class D | as class C | COLREG only (Annex 1, III.1(b)) |
| **Class D, difference exam** | Holders of class C | as class D | R.N.D. only (Annex 1, IV.1(b)) |
| **Class B** | Class C or D for at least 2 years, plus a course | Sea, up to 24 Mm | No official list published |
| **Class A** | Class B for at least 2 years, plus a course | All waters | No official list published |

Not exam types:
- **Class S** (sailing, Art. 4) is added after an approved sailing course, without an exam.
- **Ex officio issue** to holders of professional certificates involves no exam.

## Behaviour

- At sign-up, and at any time later, the user picks the exam type they're preparing for. The app remembers it per account, so it follows the user across devices.
- An exam type is defined by:
  - which questions it draws from: question banks, filtered by subject for the difference exams;
  - the exam format: number of questions, time limit and pass mark.
- Every question is tagged with its subject (for example COLREG or R.N.D.), so the difference exams can be put together from the full lists.
- Class A and B are shown as "not available yet" until official question material exists.
- Progress is kept per question. Questions shared between exam types (for example a COLREG question used by both Class C and the C difference exam) count toward both.
- The exam format for each type is configuration, not code. Every value records whether it's confirmed by an official source or still an assumption, and the user sees when the format is unconfirmed.

## Unknowns

- The regulation doesn't give the number of questions, the time limit, the pass mark or any practical part. Art. 9 delegates these to an ANR methodology that isn't published on the RNA portal. Possible sources: the methodology itself (on request from ANR, rna@rna.ro), approved training schools, or people who have taken the exam recently.
- RNA says the published lists are "only a part" of the exam questions. The app should state this clearly.

## E2E scenarios

Main paths:
- A new user picks "Class D" at sign-up. Exams and learning mode use only class D questions.
- A user changes from "Class D" to "Class C, difference exam". Exams now contain only COLREG questions, and their existing history is kept.

Less common paths:
- Class A and B are listed as not available and can't be selected.
- An exam type whose format is unconfirmed shows a visible "format not confirmed" note on the exam screen.
- The exam type chosen on the web is the one used on Android, including offline after the next sync.
