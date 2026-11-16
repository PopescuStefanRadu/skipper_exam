// Package events stores what users do in the app as an append-only log of events
// recorded on their devices (see docs/app/features/offline-and-sync.md).
package events

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Event is one thing a user did. ID is chosen by the device that recorded it.
type Event struct {
	ID   string          `json:"id"`
	Type string          `json:"type"`
	At   time.Time       `json:"at"`
	Data json.RawMessage `json:"data"`
}

// Store keeps events in Postgres.
type Store struct {
	Pool *pgxpool.Pool
}

// Append stores events of one account. Events already stored are skipped, so a
// device can send the same events again after a failed sync.
func (s *Store) Append(ctx context.Context, identityID string, evs []Event) error {
	batch := &pgx.Batch{}
	for _, e := range evs {
		batch.Queue(`INSERT INTO events (id, identity_id, type, occurred_at, data) VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO NOTHING`, e.ID, identityID, e.Type, e.At, []byte(e.Data))
	}
	return s.Pool.SendBatch(ctx, batch).Close()
}

// List returns all events of one account, oldest first.
func (s *Store) List(ctx context.Context, identityID string) ([]Event, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text, type, occurred_at, data FROM events
		WHERE identity_id = $1 ORDER BY occurred_at, id`, identityID)
	if err != nil {
		return nil, err
	}
	evs := []Event{}
	for rows.Next() {
		var e Event
		var data []byte
		if err := rows.Scan(&e.ID, &e.Type, &e.At, &data); err != nil {
			return nil, err
		}
		e.Data = data
		evs = append(evs, e)
	}
	return evs, rows.Err()
}
