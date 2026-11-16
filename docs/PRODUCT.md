# Skipper Exam: product overview

## Goal

Help a candidate prepare for and pass the Romanian Naval Authority (RNA) exam for the recreational craft operator certificate (*conducător ambarcațiune de agrement*, CAA). The app works on the web and on Android.

The app does more than tell you whether an answer was right. For every question it can show **why** the correct answer is correct: the relevant passage from the official bibliography, with a precise reference (document, edition, page, rule or article).

Official exam page: https://portal.rna.ro/personal-navigant/conducator-ambarcatiune-de-agrement/examinare-caa/

## Main functionality

### Exam simulation
- Pick a class (C or D) and get a random set of questions in the same format as the real exam.
- A timer runs and you get pass or fail at the end. The question count, time limit and pass mark are settings that should match the official rules (see "Open points").
- The order of the answers is shuffled so you learn the content, not the position.
- At the end you see your score and every wrong answer, each with its explanation.

### Explanation of each answer
- For any question, especially one you got wrong, the app shows:
  - the correct answer and the answer you chose;
  - the supporting passage, quoted from the source material;
  - the reference: document, edition or version, page, and rule or article number;
  - a way to open the source document at that page.
- A question whose source link hasn't been verified yet is clearly marked as such. The app never shows an unverified explanation as fact.

### Learning mode
- Go through questions by topic or in order, with immediate feedback and the explanation after each answer.

### Progress and review
- The app remembers your answers across sessions and devices.
- "Practice my mistakes": a mode built from questions you've answered wrong, prioritising recent and repeated mistakes.
- Coverage and weak topics: how much of each question list you've seen, and where you fail most.

## Content

The app has three kinds of content. Each one can change independently and must be easy to update.

| Content | Source | Changes when |
|---|---|---|
| **Question banks** | RNA question lists for Class C and Class D, published as PDFs | RNA publishes a new list |
| **Bibliography** | The official study material listed on the RNA page: COLREG, the Danube navigation rules (R.N.D.), the treaties document, the motorboat operator's manual, and others | RNA updates a document or the list changes |
| **Question → source links** | Created and reviewed by us | Either of the above changes |

Rules for content:
- **Every version is recorded.** Each question bank and bibliography document is stored with its publication date and a fingerprint, so we always know which version a question or a link refers to.
- **Questions keep a stable identity** across new versions of the bank, so your history and the source links survive an update. New, changed and removed questions are detected and reported. Removed questions stay in your history but leave practice.
- **Every link has a status:** *suggested* (proposed, not yet checked), *verified* (a person confirmed the passage supports the answer), or *stale* (the question or the source changed since it was verified). Only *verified* links count as explanations.
- **Conflicts are flagged, not hidden.** If the official answer seems to contradict the source material, the question is flagged for review.

## Platforms

- **Web:** works in desktop and mobile browsers.
- **Android:** an installable app with the same features. Your progress is shared with the web version.

## Quality

- End-to-end tests are the main safety net and drive development (see [DEVELOPMENT.md](DEVELOPMENT.md)).
- A content update must not break existing users' history and must pass automated checks before it's published.

## Open points

- The official exam format (questions per exam, time limit, pass mark) still needs confirming from OMTI 427/2026 and the related regulations.
- Which class to prepare first: C, D or both.
- Whether Android should work offline (useful on the water). The current assumption is "yes, for practice", with progress syncing when the device is back online.
- Whether there are multiple users or accounts, or a single personal user at first.
