# Accounts

## Behaviour

- Every user has an account from the start. Progress, history and settings belong to the account and follow you across web and Android.
- Sign up and sign in with **email and password** or with **Google**. Only Google accounts with a verified email are accepted.
- Signing in with Google using an email that already has a password account never creates a second account. Instead the app asks for that account's password once, then links Google to it. From then on, Google alone opens the account. Asking for the password stops anyone from taking over an account by presenting a Google profile with the same email. If the password is mistyped at that step, the link isn't made; signing in with Google again offers it again.
- Sign out, and reset a forgotten password (for email and password accounts). The reset sends a 6-digit code by email. Entering it lets you set a new password and signs you in. The confirmation after asking for a code is the same whether or not the email has an account, so the page reveals nothing about which accounts exist.
- There is no guest mode: you need an account to use the app.
- Some accounts have the **reviewer** role, which unlocks reviewing explanations (see [Explanations](explanations.md)). Roles are assigned by an administrator, not chosen by the user: `make grant-reviewer EMAIL=...` in a stack, or the server's `grant-role` command in production.
- At sign-up you choose your [exam type](exam-types.md).
- Users are in the EU, so you can export your data and delete your account along with all your progress.
- **On Android** the app signs in the way Kratos recommends for native apps: it keeps a session token on the device and sends it with every request, since it can't share the website's cookies. Email and password work in the app. Google opens in the phone's browser and returns to the app when done (through the `ro.skipperexam.app://auth` link). A forgotten password is reset on the website, opened in the browser; then you sign in to the app with the new password. Signing out ends the session on the server too.
- For working offline, see [Offline and sync](offline-and-sync.md).

## E2E scenarios

Main paths:
- Sign up, sign in, sign out. Signing in on another device shows the same progress.
- Sign up with Google, then sign in with Google on another device. The e2e environment uses a fake Google sign-in provider.
- Reset a forgotten password and sign in with the new one. The old password no longer works. The e2e environment uses a fake mail inbox.

Less common paths:
- Sign-in with a wrong password or an unknown email fails with a clear message and reveals no account details.
- Signing up with an email that's already used is refused.
- A wrong recovery code is refused.
- Asking for a reset code for an unknown email shows the same confirmation as for a real account.
- Signing in with Google using the email of an existing password account asks for that account's password once, then links Google to it. Afterwards Google alone opens the same account.
- Opening the app while signed out leads to sign-in; no practice is possible without an account.
- One user never sees another user's progress.
- Deleting an account removes all its progress, and the account can no longer sign in.
- A data export contains all the user's progress.
