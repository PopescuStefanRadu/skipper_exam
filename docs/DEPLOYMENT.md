# Deployment

The app runs in production at **https://skipperexam.esrp.ro**. The server, the DNS name and HTTPS are managed by the esrp.ro hosting project, which runs several projects on their own subdomains. This repository provides what that project runs:

- three images, published by CI after every merge to `main`:
  - `ghcr.io/popescustefanradu/skipper-exam-app`: the backend and the web app;
  - `ghcr.io/popescustefanradu/skipper-exam-kratos`: Kratos (accounts) with this app's configuration;
  - `ghcr.io/popescustefanradu/skipper-exam-backup`: nightly database backups and restore.

  Each is tagged `latest` and with the commit sha.
- [`deploy/compose.yaml`](../deploy/compose.yaml): the whole service (Postgres, Kratos, the app, backups), configured by a `.env` file ([`deploy/env.example`](../deploy/env.example)).

`make deploy-test` (part of `make test-all` and CI) runs this setup with the images built from the current commit. It starts the service with Kratos in production mode, signs up a user through the API, records progress and takes a backup. Then it wipes the data, restores the backup and checks that the account and its progress are back. Finally, it deletes the account.

## What the hosting project provides

- **HTTPS on `skipperexam.esrp.ro`.** A reverse proxy forwards every path, including `/.ory/`, to the app at `APP_BIND` (default `127.0.0.1:8080`). Sign-in cookies are marked Secure, so the site only works over HTTPS. The proxy needs nothing special: no WebSockets, and requests are small.
- **The `.env` file**, made from `deploy/env.example`. It is described below.
- **A copy of the backups somewhere else.** The backup service writes to `BACKUP_DIR` on the same machine, which doesn't survive a dead disk.

Nothing else is exposed: Postgres and Kratos are reachable only inside the Compose network.

## Settings (`.env`)

| Setting | What it is |
| --- | --- |
| `APP_URL` | `https://skipperexam.esrp.ro`. Kratos builds its links and cookies from it. |
| `APP_BIND` | Where the app listens for the proxy (`127.0.0.1:8080`). |
| `POSTGRES_PASSWORD`, `COOKIE_SECRET`, `CIPHER_SECRET` | Generate each with `openssl rand -hex 16`. `CIPHER_SECRET` must be exactly 32 characters. Changing `COOKIE_SECRET` signs everyone out. Keep `CIPHER_SECRET`, because it encrypts the stored Google sign-in tokens. |
| `SMTP_URI` | The mail server for password reset codes, for example `smtps://user:password@smtp.example.com:465`. URL-encode special characters in the user name and password. |
| `MAIL_FROM` | The sender address, for example `no-reply@esrp.ro`. Its domain should allow the mail server to send for it (SPF/DKIM), or the emails land in spam. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in, set up as described below. |
| `BACKUP_DIR`, `BACKUP_KEEP_DAYS`, `BACKUP_HOUR`, `TZ` | Where backups go, how many daily backups to keep (14), and when to take them (3:00, Europe/Bucharest). |
| `IMAGE_TAG` | `latest`, or a commit sha to pin a version. |

The values Kratos reads from the template (`APP_URL`, the secrets, `MAIL_FROM` and the Google settings) may only contain letters, digits and `. _ : / @ + = -`. Kratos refuses to start otherwise and says which setting is wrong.

## Google sign-in

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Set up the OAuth consent screen. The app's name is "Examen CAA" and the only scopes are `openid` and `email`.
2. Create an OAuth client ID of type **Web application**:
   - **Authorized JavaScript origins:** `https://skipperexam.esrp.ro`
   - **Authorized redirect URIs:** `https://skipperexam.esrp.ro/.ory/self-service/methods/oidc/callback/google`
3. Put the client ID and secret in `.env`.

The Android app uses the same client. It signs in with Google in the phone's browser on the website's address, then returns to the app.

## Running and updating

```sh
cd deploy
cp env.example .env       # fill it in
docker compose up -d
curl -fsS http://127.0.0.1:8080/api/health    # {"status":"ok","database":"ok"}
```

To update, run `docker compose pull && docker compose up -d`. Database migrations, for both the app and Kratos, run by themselves at start-up.

To give an account the reviewer role, run `docker compose exec app /server grant-role -email EMAIL -role reviewer`.

## Backups and restore

The `backup` service takes a backup when it starts, unless one already exists for that day, and then once a day at `BACKUP_HOUR`. Each backup is one folder, `BACKUP_DIR/YYYY-MM-DD/`, with dumps of the app's database (`skipper_exam.dump`) and of Kratos's (`kratos.dump`, the accounts). The two databases are always backed up and restored together. The newest `BACKUP_KEEP_DAYS` backups are kept.

```sh
docker compose exec backup backup.sh now          # back up now
docker compose exec backup backup.sh list         # list backups
docker compose stop app kratos                    # restore: stop what writes to the databases first
docker compose run --rm --no-deps backup restore 2026-11-18
docker compose up -d
```

The restore replaces both databases with the backup's contents. Progress and accounts created after that backup are lost, except answers that were still waiting to sync on a device when the restore happened.

## Android

To build an APK for the production server, run `make android-build SERVER_URL=https://skipperexam.esrp.ro`, then install `web/android/app/build/outputs/apk/debug/app-debug.apk` on the phone. It is a debug build, so Android asks you to allow installing it. Google Play needs a release build with its own signing key, which isn't set up yet.
