# Content

## Kinds of content

The app has three kinds of content. Each one can change independently and must be easy to update.

| Content | Source | Changes when |
|---|---|---|
| **Question banks** | RNA question lists for Class C and Class D, published as PDFs | RNA publishes a new list |
| **Bibliography** | The official study material listed on the RNA page: COLREG, the Danube navigation rules (R.N.D.), the treaties document, the motorboat operator's manual, and others | RNA updates a document or the list changes |
| **Question → source links** | Created and reviewed by us | Either of the above changes |

## Rules

- **Every version is recorded.** Each question bank and bibliography document is stored with its publication date and a fingerprint, so we always know which version a question or a link refers to.
- **One shared question pool.** Both RNA lists contain many of the same questions, especially on general seamanship. A question that appears in both lists, with the same wording, answers and correct answer, is one question in the pool. Progress on it counts for every exam type that uses it. Each bank lists which pool questions it contains and under which RNA number.
- **Questions keep a stable identity** across new versions of the bank, so user history and source links survive an update. On re-import:
  - questions whose text is unchanged keep their identity;
  - questions that changed slightly (a corrected typo, a reworded answer) keep their identity and are reported as *changed*;
  - everything else is reported as *new* or *removed*.
  
  Removed questions stay in history but leave practice.
- **Text is normalised on import:** Romanian letters are written with a comma below (ș, ț) rather than the cedilla look-alikes (ş, ţ), whitespace is cleaned up, and wrapped lines are joined. The question's wording isn't otherwise changed, even where it contains mistakes, because it must match what the candidate sees at the exam.
- **Equivalent questions share progress.** The lists often repeat a question with only cosmetic differences: missing diacritics, punctuation, capitals. This happens across the two lists and sometimes within one list. Such questions form an *equivalence group*: they keep their own wording, so each exam type shows exactly what RNA published, but answering one counts as answering all of them. The groups are computed from the text, never maintained by hand. Two questions are equivalent when their question and answers match, in the same order and with the same correct answer, once diacritics, punctuation and case are ignored.
- **Every question is tagged with exactly one subject.** The tags are used to put together difference exams (see [Exam types](exam-types.md)) and to show weak topics. The subjects are:

  | Subject | Covers |
  |---|---|
  | COLREG | International collision regulations, including lights, sound signals and distress signals |
  | R.N.D. | Danube navigation regulation |
  | Navigație și balizaj | Charts, coordinates, compass, courses and bearings, buoyage, lighthouses, wind |
  | Marinărie și construcția navei | Ropes and knots, anchors, deck gear, hull structure, boat equipment |
  | Manevra ambarcațiunii | Steering, propellers and engines, berthing, anchoring, locks, towing, personal watercraft |
  | Prim ajutor | First aid |
  | Legislație | Offences and penalties |

  Tags are assigned by RNA number ranges, because the lists group their questions by subject. The ranges are kept in `content/subject-ranges.json`. Equivalent questions must have the same subject.
- **Every link has a status:** *suggested* (proposed, not yet checked), *verified* (a reviewer confirmed the passage supports the answer), or *stale* (the question or the source changed since it was verified). Unverified links are shown with a clear label, see [Explanations](explanations.md).
- **Conflicts are flagged, not hidden.** If the official answer seems to contradict the source material, the question is flagged for review.
- **The bibliography is stored as text, page by page** (`content/bibliography/<source>.json`), extracted from the PDFs with `make content-extract`. Documents printed in Romanian and English side by side (COLREG) keep only the Romanian column. Scanned documents (the motorboat manual) are recognised with OCR in a Docker image (`docker/ocr`): the scans are low-resolution photos of two-page spreads, some rotated, so each page is upscaled, turned upright and split before recognition. OCR text has some errors; quotes come from it word for word, and reviewers can correct them.
- **Explanations** (`content/explanations.json`) link a question to a passage: the source, the PDF page, the rule or article, the quote, and a status (*suggested*, *verified* or *stale*). Validation checks that every quote is really on its page (ignoring diacritics, punctuation and line breaks), so a proposed passage can't be invented. A proposal can carry a *concern* (the source seems to contradict the official answer) and a *note* for the reviewer.
- Every content update passes automated validation and the full e2e suite before it's published.
- **The apps get the content as one package**, built by the server at start-up from the files in `content/`: the questions used by the available exam types, their subjects and equivalence groups, and each exam type with its question IDs. The package has a version derived from its content, so devices download it again only when it changed. Publishing a content update means deploying it and restarting the server. Exams already in progress keep their questions, since question IDs are stable.
- **Exams only use questions with exactly one correct answer.** A question whose source marks no answer, or several, as correct stays in the pool with an issue, but no exam includes it. Validation checks that every available exam type has enough distinct questions for one exam, counting each equivalence group once.

## Updating content

### When RNA publishes a new question bank
1. Download the new PDF and add it as a new version. The old version is kept.
2. Run the importer. It extracts the questions and checks them: 3 answers each, exactly one correct, numbering without gaps, no empty text.
3. Update the subject ranges if the numbering changed, then re-apply them. New questions without a subject fail validation.
4. Review the **change report**: new, changed and removed questions. A changed question's source links become *stale*.
5. Create or review source links for new and *stale* questions.
6. Run the content validation and the full e2e suite, then publish.

### When a bibliography document changes
1. Add the new document version. The old one is kept.
2. Re-locate every linked passage in the new version: same text, possibly a different page. Links whose passage can't be found automatically become *stale*.
3. Review the *stale* links, then validate and publish as above.

### Creating explanations
1. **Add the document** to `content/sources.json` (kind `bibliography`, with `column: "left"` for side-by-side translations or `ocr: true` for scans) and run `make content-extract`. Check a few pages of the result by eye. Documents that aren't published online (for example *Rutiera Dunării*, available only at the port captaincies, or the textbooks in RNA's "Tratate" list) are added when we get a copy.
2. **Propose passages** for the questions without one. Agents search the text (`go run ./cli/content search`), pick the shortest passage that justifies the official answer, and check it with `go run ./cli/content check-quote`. A second, independent agent checks each proposal: is the quote on the page, does it support the answer, is the reference right. Its findings become the proposal's note. Every proposal starts as *suggested*.
3. **Validate** (`make content-validate`), then publish.
4. **Review in use.** The reviewer confirms, corrects or rejects explanations directly in the app while practising, see [Explanations](explanations.md). There's no separate review campaign before the app can be used. Questions with a concern are the first to look at.

## E2E scenarios

Less common paths:
- After a content update that changes or removes a question you answered before, your history is still shown correctly and removed questions leave practice.
