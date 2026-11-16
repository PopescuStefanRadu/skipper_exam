# Accounts

## Behaviour

- Every user has an account from the start. Progress, history and settings belong to the account and follow you across web and Android.
- Sign up, sign in, sign out, and reset a forgotten password.
- Users are in the EU, so you can export your data and delete your account along with all your progress.
- For signing in on Android and working offline, see [Offline and sync](offline-and-sync.md).

## E2E scenarios

Main paths:
- Sign up, sign in, sign out. Signing in on another device shows the same progress.
- Reset a forgotten password and sign in with the new one. The e2e environment uses a fake mail inbox.

Less common paths:
- Sign-in with a wrong password or an unknown email fails with a clear message and reveals no account details.
- Signing up with an email that's already used is refused.
- One user never sees another user's progress.
- Deleting an account removes all its progress, and the account can no longer sign in.
- A data export contains all the user's progress.
