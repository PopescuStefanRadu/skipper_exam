# Explanations

## Behaviour

- For any question, especially one you got wrong, the app shows:
  - the correct answer and the answer you chose;
  - the supporting passage, quoted from the source material;
  - the reference: document, edition or version, page, and rule or article number;
  - a way to open the source document at that page.
- Explanations that aren't *verified* yet (see [Content](content.md)) are still shown, but clearly labelled "unverified". The app never presents an unverified explanation as fact.
- A question with no source link at all says that no explanation is available yet.

### Reviewing explanations in the app
Source links are proposed automatically and then validated while the app is being used. A user with the **reviewer** role sees extra actions on every explanation:
- **Confirm:** the passage supports the answer, and the link becomes *verified*.
- **Reject:** the passage is wrong or irrelevant, so the link is removed and the question goes back to "no explanation yet".
- **Correct:** choose a different passage or page, and optionally add a note.
- **Flag the question:** the official answer seems to contradict the source.

Normal users don't see these actions. Review actions made offline sync like answers do.

## E2E scenarios

Main paths:
- Open the explanation for a wrong answer. It shows the correct answer, the quoted passage and the reference, and opens the source at that page.

Less common paths:
- An explanation that is only *suggested* shows the passage with a clear "unverified" label.
- A question with no source link says "no explanation yet", not an empty or broken screen.
- A reviewer confirms a suggested explanation: the "unverified" label disappears for all users.
- A reviewer rejects a suggested explanation: the question shows "no explanation yet".
- A normal user doesn't see any review actions.
