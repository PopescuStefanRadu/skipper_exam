# Explanations

## Behaviour

- For any question, especially one you got wrong, the app shows:
  - the correct answer and the answer you chose;
  - the supporting passage, quoted from the source material;
  - the reference: document, edition or version, page, and rule or article number;
  - a way to open the source document at that page.
- A question whose source link isn't *verified* yet (see [Content](content.md)) is clearly marked as such. The app never shows an unverified explanation as fact.

## E2E scenarios

Main paths:
- Open the explanation for a wrong answer. It shows the correct answer, the quoted passage and the reference, and opens the source at that page.

Less common paths:
- A question with no *verified* source link shows "explanation not yet verified", not a wrong or empty explanation.
