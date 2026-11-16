-- +goose Up
-- Roles an administrator gave to an account, such as "reviewer".
CREATE TABLE roles (
    identity_id uuid NOT NULL,
    role        text NOT NULL,
    granted_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (identity_id, role)
);

-- Reviewers' decisions about explanations, append-only. The latest decision about
-- a question wins; "reset" undoes the earlier ones.
CREATE TABLE reviews (
    id          uuid PRIMARY KEY,
    question_id text NOT NULL,
    identity_id uuid NOT NULL,
    action      text NOT NULL,
    data        jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_question ON reviews (question_id, created_at);

-- +goose Down
DROP TABLE reviews;
DROP TABLE roles;
