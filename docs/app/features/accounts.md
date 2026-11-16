# Accounts

## Behaviour

- Every user has an account from the start. Progress, history and settings belong to the account and follow you across web and Android.
- Sign up and sign in with **email and password** or with **Google**. Signing in with Google using an email that already has a password account opens that same account, and doesn't create a second one.
- Sign out, and reset a forgotten password (for email and password accounts).
- There is no guest mode: you need an account to use the app.
- Some accounts have the **reviewer** role, which unlocks reviewing explanations (see [Explanations](explanations.md)). Roles are assigned by an administrator, not chosen by the user.
- At sign-up you choose your [exam type](exam-types.md).
- Users are in the EU, so you can export your data and delete your account along with all your progress.
- For signing in on Android and working offline, see [Offline and sync](offline-and-sync.md).

## E2E scenarios

Main paths:
- Sign up, sign in, sign out. Signing in on another device shows the same progress.
- Sign up and sign in with Google. The e2e environment uses a fake Google sign-in provider.
- Reset a forgotten password and sign in with the new one. The e2e environment uses a fake mail inbox.

Less common paths:
- Sign-in with a wrong password or an unknown email fails with a clear message and reveals no account details.
- Signing up with an email that's already used is refused.
- Signing in with Google using the email of an existing password account opens the same account.
- Opening the app while signed out leads to sign-in; no practice is possible without an account.
- One user never sees another user's progress.
- Deleting an account removes all its progress, and the account can no longer sign in.
- A data export contains all the user's progress.
