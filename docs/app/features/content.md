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
- **Questions keep a stable identity** across new versions of the bank, so user history and source links survive an update. New, changed and removed questions are detected and reported. Removed questions stay in history but leave practice.
- **Every link has a status:** *suggested* (proposed, not yet checked), *verified* (a person confirmed the passage supports the answer), or *stale* (the question or the source changed since it was verified). Only *verified* links count as explanations.
- **Conflicts are flagged, not hidden.** If the official answer seems to contradict the source material, the question is flagged for review.
- Every content update passes automated validation and the full e2e suite before it's published.

## Updating content

### When RNA publishes a new question bank
1. Download the new PDF and add it as a new version. The old version is kept.
2. Run the importer. It extracts the questions and checks them: 3 answers each, exactly one correct, no gaps, clean text.
3. Review the **change report**: new, changed and removed questions. A changed question's source links become *stale*.
4. Create or review source links for new and *stale* questions.
5. Run the content validation and the full e2e suite, then publish.

### When a bibliography document changes
1. Add the new document version. The old one is kept.
2. Re-locate every linked passage in the new version: same text, possibly a different page. Links whose passage can't be found automatically become *stale*.
3. Review the *stale* links, then validate and publish as above.

### Creating source links
- Candidate passages are proposed automatically, for example by searching the bibliography for the question and answer wording. Every candidate starts as *suggested*.
- A person reviews each suggestion and marks it *verified*, or corrects it.
- If the source seems to contradict the official answer, the question is flagged.

## E2E scenarios

Less common paths:
- After a content update that changes or removes a question you answered before, your history is still shown correctly and removed questions leave practice.
