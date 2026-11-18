-- +goose Up
-- Accounts are created at the first sign-in through esrp.ro's sign-in service
-- (Authentik). subject is that service's user ID ("sub"); id is the app's own ID,
-- which every other table refers to as identity_id.
CREATE TABLE accounts (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject       text NOT NULL UNIQUE,
    email         text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    signed_in_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounts_email ON accounts (lower(email));

-- The app's own sessions, by the SHA-256 of their token: a cookie on the website,
-- a header in the Android app. They last a year from their last use.
CREATE TABLE sessions (
    token_hash   bytea PRIMARY KEY,
    account_id   uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_account ON sessions (account_id);

-- Sign-ins in progress at the sign-in service, by their OAuth state; short-lived.
CREATE TABLE login_requests (
    state      text PRIMARY KEY,
    nonce      text NOT NULL,
    verifier   text NOT NULL,
    platform   text NOT NULL,
    return_to  text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- One-time codes the Android app exchanges for a session token, by their SHA-256.
CREATE TABLE app_codes (
    code_hash  bytea PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE app_codes;
DROP TABLE login_requests;
DROP TABLE sessions;
DROP TABLE accounts;
