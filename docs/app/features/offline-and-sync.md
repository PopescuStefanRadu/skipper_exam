# Offline and sync

## Behaviour

- **The app runs on the device, on the web too.** It keeps the content package and the user's events (exam started, question answered, exam submitted or abandoned, practice question answered) on the device, and works from them. Each event gets its ID on the device, so sending it twice stores it once. Events are sent to the server as soon as it's reachable, and the server's events are merged in, so what was done on another device shows up. Events are ordered by the time they happened, and an exam's events apply even when they share its start time to the millisecond. On the web, the device storage is the browser's local storage.

- **What's waiting is visible.** Signed-in screens end with a line saying whether everything is saved on the server, or how many changes wait for the connection. Waiting changes are retried every 15 seconds, as well as on new activity, when the browser reports it's back online, and when the app starts.
- **The app starts without a connection.** The signed-in account and its exam type are kept on the device, so the app opens signed in offline. Only the server saying the session ended signs it out.
- **Android works fully offline.** The question banks, explanations and quoted passages are stored on the device, so exam simulation, learning mode and review all work without a connection.
- You sign in once while online. After that the app stays signed in while offline.
- Answers given offline are kept on the device and synced when it's back online. No answers are lost, even if the same account was used on another device in the meantime.
- Content updates are downloaded when a connection is available. Until then the app keeps working with the content it has.
- The quoted passage and the reference are always available offline. Opening the full source document offline requires downloading it to the device first.

## E2E scenarios

The Android scenarios run on an emulator (`make android-e2e`, see [Development](../../DEVELOPMENT.md)). "Offline" there means the app can't reach the server at all.

Android (emulator):
- Sign in with "Continuă cu Google": the app opens the sign-in page in the browser and is signed in when the browser returns to it. Choose the exam type, reach the home screen.
- With the server unreachable, restart the app: it opens signed in, an exam can be started and answered, and the screen shows the changes waiting. The exam is submitted and its result shown.
- Back online, restart the app: the waiting changes reach the server (checked through the API), and the exam counts on the learning page.
- Sign out.

Web:
- Answers made while the server is unreachable wait on the device ("2 modificări așteaptă conexiunea cu serverul."), then reach the server once it's back, without any new activity.
- A signed-in user's app opens and starts an exam while the server is unreachable.

Still to cover:
- Progress made on the web is visible on Android, and the other way round.
- Android with no connection: learning mode, review and explanations work too.
- Answers given offline are synced when the connection returns and appear on the web. Answers made on both devices before a sync are all kept.
- A content update published while the device is offline is picked up on the next connection, and progress on unchanged questions is preserved.
- Opening a full source document offline: it opens if it was downloaded. Otherwise the app says it needs downloading, and the quoted passage is still shown.
- The session expires while offline: offline answers are kept and sync after the next sign-in.
- The backend is unavailable: a clear message, not a blank screen or lost answers.
