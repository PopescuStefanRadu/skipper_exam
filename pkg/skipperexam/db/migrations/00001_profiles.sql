-- +goose Up
-- The app's own data about an account. Accounts themselves live in Kratos;
-- identity_id is the Kratos identity ID.
CREATE TABLE profiles (
    identity_id uuid PRIMARY KEY,
    exam_type   text NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE profiles;
