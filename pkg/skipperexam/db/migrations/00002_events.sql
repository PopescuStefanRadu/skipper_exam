-- +goose Up
-- What users do in the app (exam started, question answered, ...), as an append-only
-- log. Event IDs are made by the device that recorded the event, so sending the
-- same event twice stores it once.
CREATE TABLE events (
    id          uuid PRIMARY KEY,
    identity_id uuid NOT NULL,
    type        text NOT NULL,
    occurred_at timestamptz NOT NULL,
    data        jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_identity ON events (identity_id, occurred_at, id);

-- +goose Down
DROP TABLE events;
