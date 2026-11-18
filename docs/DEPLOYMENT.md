# Deployment

The app runs in production at **https://skipperexam.esrp.ro**, on the esrp.ro NAS. The esrp.ro hosting project manages the server, the DNS name, HTTPS and the sign-in service ([Authentik](https://auth.esrp.ro)). This repository provides what that project runs:

- two images, published to ghcr.io by `make integrate` after every merge to `main` (or by `make publish`):
  - `ghcr.io/popescustefanradu/skipper-exam-app`: the backend and the web app;
  - `ghcr.io/popescustefanradu/skipper-exam-backup`: nightly database backups and restore.

  Each is tagged `latest` and with the commit sha. Production pins the sha (`IMAGE_TAG`); changes that need a new or changed `.env` setting are called out in their pull request.
- [`deploy/compose.yaml`](../deploy/compose.yaml): the whole service (Postgres, the app and backups), configured by a `.env` file ([`deploy/env.example`](../deploy/env.example)). The hosting project may add networks to the `app` service; the file doesn't set any.

`make deploy-test` (part of `make test-all`) runs this setup with the images built from the current commit, plus a fake sign-in service in place of Authentik. A user signs in and records progress, and a backup is taken. Then the test wipes the data and restores the backup. The account and its progress must be back, both for the old session and for a new sign-in. Finally, the test deletes the account.

## What the hosting project provides

- **HTTPS on `skipperexam.esrp.ro`.** A reverse proxy forwards every path to the app's port 8080, through `APP_BIND` or over a Docker network. The session cookie is marked Secure when `APP_URL` starts with `https://`. Nothing else is exposed: Postgres is reachable only inside the Compose network.
- **The sign-in service.** The app needs these in Authentik:
  - its own OAuth2/OpenID provider and application;
  - Google-only sign-in for everyone;
  - an API token, used for account deletion.

  The details are below. The app's container must reach `https://auth.esrp.ro` at its public address: for discovery, the token exchange and the API.
- **The `.env` file**, made from `deploy/env.example`.
- **Copies of the backups** on other disks.

## Authentik

**Provider and application.** Create an OAuth2/OpenID provider and an application with the slug `skipper-exam`:

- **Client type:** Confidential.
- **Redirect URI** (strict): `https://skipperexam.esrp.ro/auth/callback`
- **Signing key:** a certificate, for RS256. The app only accepts asymmetrically signed ID tokens.
- **Scopes:** `openid`, `email` and `profile`, with the default mappings. **Include claims in id_token** must be on, because the app reads the email from the ID token.
- **Subject mode:** "Based on the User's UUID". The app stores this ID, and account deletion uses it to find the user through the API.
- **Issuer:** `https://auth.esrp.ro/application/o/skipper-exam/`. This is `OIDC_ISSUER_URL`; the client ID and secret go in `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`.
- **Access:** no policy, so anyone with an account may use it.

**Sign-in for everyone, with Google only.** The provider's authentication flow must:

- **Offer only Google.** Use an identification stage with no user fields and the Google source as its only source. Authentik then goes straight to Google.
- **Enroll people it doesn't know yet.** The Google source used there needs an enrollment flow. It creates the user from Google's email and name and adds them to the group **`skipper-exam`** (`AUTHENTIK_APP_GROUP`).
- **Keep the other apps closed.** If the existing Google source is invite-only, create a second Google source for this app with enrollment enabled, and use it only in this flow. Users enrolled through it have only the `skipper-exam` group, so Jellyfin, Komga and the other private apps stay closed to them. Their policies require their own groups.

People who already have an esrp.ro account sign in with it as usual.

**The API token, for account deletion.** Create a service account and an API token (`AUTHENTIK_API_TOKEN`) allowed to view and delete users.

When someone deletes their account in the app:

- the app looks up their Authentik user by UUID;
- it deletes that user only if they are in the `skipper-exam` group and in no other group, and aren't an administrator;
- shared esrp.ro accounts stay, and only the app's data goes.

If `AUTHENTIK_URL` is left empty, deletion removes only the app's data.

**Signing out** of the app ends the app's session only. The Authentik session stays, so the next "Continuă cu Google" on the same browser may sign in without asking.

## Settings (`.env`)

| Setting | What it is |
| --- | --- |
| `APP_URL` | `https://skipperexam.esrp.ro`. Sign-in redirects and the cookie depend on it. |
| `APP_BIND` | Where the app listens on the host, `127.0.0.1:8080` by default. |
| `POSTGRES_PASSWORD` | Generate it with `openssl rand -hex 16`. |
| `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | The Authentik provider, set up as described above. |
| `AUTHENTIK_URL`, `AUTHENTIK_API_TOKEN`, `AUTHENTIK_APP_GROUP` | For account deletion: `https://auth.esrp.ro`, the token, and `skipper-exam`. |
| `BACKUP_DIR`, `BACKUP_KEEP_DAYS`, `BACKUP_HOUR`, `TZ` | Where backups go, how many daily backups to keep (14), and when to take them (3:00, Europe/Bucharest). |
| `IMAGE_TAG` | A commit sha (pinned) or `latest`. |

The app needs no mail server, because there are no passwords and no emails.

## Running and updating

```sh
cd deploy
cp env.example .env       # fill it in
docker compose up -d
curl -fsS http://127.0.0.1:8080/api/health    # {"status":"ok","database":"ok"}
```

To update, set the new `IMAGE_TAG`, then run `docker compose pull && docker compose up -d`. Database migrations run by themselves at start-up.

To give an account the reviewer role, run `docker compose exec app /server grant-role -email EMAIL -role reviewer`. The account must have signed in once.

## Backups and restore

The `backup` service takes a backup when it starts, unless one already exists for that day, and then once a day at `BACKUP_HOUR`. Each backup is one folder, `BACKUP_DIR/YYYY-MM-DD/`, holding a dump of the database (`skipper_exam.dump`), accounts and sessions included. The newest `BACKUP_KEEP_DAYS` backups are kept.

```sh
docker compose exec backup backup.sh now          # back up now
docker compose exec backup backup.sh list         # list backups
docker compose stop app                           # restore: stop what writes to the database first
docker compose run --rm --no-deps backup restore 2026-11-18
docker compose up -d
```

A restore replaces the database with the backup's contents. Progress and accounts created after that backup are lost, except answers that were still waiting to sync on a device when the restore happened. Users exist in Authentik independently of this database; restoring doesn't change them.

## Android

To build an APK for the production server, run `make android-build SERVER_URL=https://skipperexam.esrp.ro`, then install `web/android/app/build/outputs/apk/debug/app-debug.apk` on the phone. It is a debug build, so Android asks you to allow installing it. Google Play needs a release build with its own signing key, which isn't set up yet. The app signs in through the same provider: the phone's browser opens `https://skipperexam.esrp.ro/auth/login?platform=app`, and the app gets its session back through the `ro.skipperexam.app://auth` link.
