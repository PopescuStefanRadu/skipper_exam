# Accounts

## Behaviour

- Every user has an account from the start. Progress, history and settings belong to the account and follow you across web and Android. There is no guest mode: you need an account to use the app.
- **There is one way to sign in: "Continuă cu Google"**, through esrp.ro's sign-in service ([Authentik](https://auth.esrp.ro)). The same service signs people in to esrp.ro's other apps. Anyone with a Google account can use this app: the first sign-in creates the account, both on the website and on Android. Nobody is asked for a password by the app, so there is no password to forget or reset.
- Accounts are identified by the sign-in service's user ID, not by email. If someone's Google email changes, the app shows the new one at the next sign-in and keeps the progress.
- After the sign-in service confirms who you are, the app keeps its own session for you. It lasts a year from the last time you used the app, so the Android app stays signed in and opens offline for months. The sign-in service only needs to be reachable when you sign in.
- If the sign-in is cancelled or fails, you're back on the sign-in page with "Autentificarea nu a reușit. Încearcă din nou."
- **Sign out** ends the session on the server, on the website and in the app.
- **Roles:** everyone starts as a regular user. Some accounts have the **reviewer** role, which unlocks reviewing explanations (see [Explanations](explanations.md)). Roles are assigned by an administrator, not chosen by the user: `make grant-reviewer EMAIL=...` in a stack, or the server's `grant-role` command in production. More benefits for subscribers will come later, as further roles.
- At sign-up you choose your [exam type](exam-types.md).
- Users are in the EU, so you can export your data and delete your account along with all your progress. Both are on the **Contul meu** page, linked from your email in the top bar:
  - **Export** downloads one JSON file with everything the app keeps about you: your account (ID and email), your profile (exam type), your roles, every recorded event (exam and practice answers) and, for reviewers, your review decisions. On Android the export opens that page on the website, since the app's web view can't save files.
  - **Delete** asks you to type your email to confirm, since it can't be undone. It removes your progress, profile, roles and sessions, and the account itself. If your esrp.ro account exists only for this app, it's deleted from the sign-in service too; an esrp.ro account that also opens other esrp.ro apps stays, and only this app's data goes. Review decisions stay, because the explanations everyone sees depend on them, but they no longer point to the account. Then you're signed out with the message "Contul tău a fost șters.", and the device forgets the account and its progress. Signing in again with the same Google account starts from nothing.
- **On Android**, "Continuă cu Google" opens the sign-in in the phone's browser. When it's done, the browser returns to the app through the `ro.skipperexam.app://auth` link, with a one-time code that the app exchanges for its own session token. The app keeps the token on the device and sends it with every request, since it can't share the website's cookies.
- For working offline, see [Offline and sync](offline-and-sync.md).

## E2E scenarios

The e2e environment uses a fake sign-in service in place of Authentik and Google: a mock OpenID Connect server where a test chooses who signs in.

Main paths:
- The first sign-in creates the account. The user stays signed in after a reload, then signs out.
- Signing in on another device opens the same account.
- Deleting an account removes all its progress, and the next sign-in with the same identity starts with no progress.
- A data export contains the account, the profile and all the user's progress.

Less common paths:
- A cancelled or failed sign-in returns to the sign-in page with a clear message.
- Opening the app while signed out leads to sign-in; no practice is possible without an account.
- The old sign-up, password reset and settings addresses lead to sign-in.
- One user never sees another user's progress.
- Deleting stays disabled until the typed email matches the account's; going back keeps the account.
- A session that was signed out no longer works, for the website's cookie and for the app's token.
