# Explanations

## Behaviour

- Every question has an explanation page, opened from a wrong answer on the exam result ("Vezi explicația"). It shows:
  - the question, the correct answer and, when you came from an exam, the answer you chose;
  - the supporting passage, quoted word for word from the source material;
  - the reference: the document, the rule or article, and the page;
  - a link that opens the source document at that page.
- Explanations that aren't *verified* yet (see [Content](content.md)) are still shown, but clearly labelled "Neverificată" (unverified). The app never presents an unverified explanation as fact.
- A question with no explanation says that no explanation is available yet.
- A question flagged by a reviewer (the official answer seems to contradict the source) shows a note saying it's being checked.
- Explanations are part of what the app keeps on the device, so they work offline. Opening the full source document needs a connection on the web.

### Reviewing explanations in the app
Explanations are proposed automatically and then validated while the app is being used. A user with the **reviewer** role sees extra actions on every explanation, together with the notes left when it was proposed (for example "the passage only partly supports the answer"):
- **Confirmă (confirm):** the passage supports the answer, and the explanation becomes *verified* for everyone.
- **Respinge (reject):** the passage is wrong or irrelevant, so the question goes back to "no explanation yet".
- **Corectează (correct):** give a different passage: document, page, reference and the quote. The quote must be word for word on that page, or it's refused. A corrected explanation is *verified*.
- **Semnalează (flag):** the official answer seems to contradict the source, with a note. Everyone sees that the question is being checked.
- **Anulează (undo):** go back to the proposed explanation, removing the reviewer's decision.

Normal users don't see these actions, and the server refuses them from accounts without the role.

A review applies to the exact explanation it was made on. When a content update changes that explanation or the question, the review no longer applies: the new explanation is shown as unverified until it's reviewed again. Reviews are stored on the server, not in `content/`. Review actions need a connection; the reviewer is told when they couldn't be saved.

## E2E scenarios

Main paths:
- Open the explanation for a wrong answer from the exam result. It shows the question, the answer you chose, the correct answer, the quoted passage, the reference, and a link to the source document at that page, which opens the PDF.

Less common paths:
- An explanation that is only *suggested* shows the passage with a clear "Neverificată" label.
- A question with no explanation says "no explanation yet", not an empty or broken screen.
- A reviewer confirms a suggested explanation: the label disappears, also for other users.
- A reviewer rejects a suggested explanation: the question shows "no explanation yet" for everyone. Undo brings the proposed explanation back.
- A reviewer corrects an explanation with a quote from another page: it's shown as verified. A quote that isn't on the given page is refused.
- A reviewer flags a question: everyone sees that it's being checked.
- A normal user doesn't see any review actions, and the server refuses review actions from them.
