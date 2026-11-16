# Offline and sync

## Behaviour

- **Android works fully offline.** The question banks, explanations and quoted passages are stored on the device, so exam simulation, learning mode and review all work without a connection.
- You sign in once while online. After that the app stays signed in while offline.
- Answers given offline are kept on the device and synced when it's back online. No answers are lost, even if the same account was used on another device in the meantime.
- Content updates are downloaded when a connection is available. Until then the app keeps working with the content it has.
- The quoted passage and the reference are always available offline. Opening the full source document offline requires downloading it to the device first.

## E2E scenarios

Main paths:
- Progress made on the web is visible on Android, and the other way round.
- Android with no connection: exam simulation, learning mode, review and explanations all work.

Less common paths:
- Answers given offline are synced when the connection returns and appear on the web. Answers made on both devices before a sync are all kept.
- A content update published while the device is offline is picked up on the next connection, and progress on unchanged questions is preserved.
- Opening a full source document offline: it opens if it was downloaded. Otherwise the app says it needs downloading, and the quoted passage is still shown.
- The session expires while offline: offline answers are kept and sync after the next sign-in.
- The backend is unavailable: a clear message, not a blank screen or lost answers.
