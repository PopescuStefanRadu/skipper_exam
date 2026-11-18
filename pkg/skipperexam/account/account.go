// Package account exports and deletes everything the app keeps about an account
// (see docs/app/features/accounts.md).
package account

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/events"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/profile"
)

// Export is the app's data about one account, as the user downloads it.
type Export struct {
	ExportedAt time.Time        `json:"exportedAt"`
	Account    Info             `json:"account"`
	Profile    profile.Profile  `json:"profile"`
	Roles      []string         `json:"roles"`
	Events     []events.Event   `json:"events"`
	Reviews    []ExportedReview `json:"reviews"`
}

// Info identifies the account.
type Info struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// ExportedReview is a review decision made by the account.
type ExportedReview struct {
	ID         string          `json:"id"`
	QuestionID string          `json:"questionId"`
	Action     string          `json:"action"`
	Data       json.RawMessage `json:"data"`
	CreatedAt  time.Time       `json:"createdAt"`
}

// Store reads and deletes the account's data in Postgres.
type Store struct {
	Pool *pgxpool.Pool
}

// Export collects the account's data.
func (s *Store) Export(ctx context.Context, info Info) (Export, error) {
	out := Export{ExportedAt: time.Now().UTC(), Account: info, Roles: []string{}, Reviews: []ExportedReview{}}
	var err error
	if out.Profile, err = (&profile.Store{Pool: s.Pool}).Get(ctx, info.ID); err != nil {
		return Export{}, err
	}
	if out.Events, err = (&events.Store{Pool: s.Pool}).List(ctx, info.ID); err != nil {
		return Export{}, err
	}
	rows, err := s.Pool.Query(ctx, `SELECT role FROM roles WHERE identity_id = $1 ORDER BY role`, info.ID)
	if err != nil {
		return Export{}, err
	}
	if out.Roles, err = pgx.CollectRows(rows, pgx.RowTo[string]); err != nil {
		return Export{}, err
	}
	rows, err = s.Pool.Query(ctx, `SELECT id::text, question_id, action, data, created_at FROM reviews
		WHERE identity_id = $1 ORDER BY created_at, id`, info.ID)
	if err != nil {
		return Export{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var r ExportedReview
		var data []byte
		if err := rows.Scan(&r.ID, &r.QuestionID, &r.Action, &data, &r.CreatedAt); err != nil {
			return Export{}, err
		}
		r.Data = data
		out.Reviews = append(out.Reviews, r)
	}
	if out.Roles == nil {
		out.Roles = []string{}
	}
	return out, rows.Err()
}

// Anonymous stands in for deleted accounts in the review decisions they made.
const Anonymous = "00000000-0000-0000-0000-000000000000"

// Delete removes the account with its progress, profile, roles and sessions, and
// detaches its review decisions, which explanations everyone sees depend on.
// deleteIdentity removes the user from the sign-in service where appropriate; it
// runs inside the transaction, so if it fails nothing is deleted.
func (s *Store) Delete(ctx context.Context, identityID string, deleteIdentity func(context.Context) error) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		for _, q := range []string{
			`DELETE FROM events WHERE identity_id = $1`,
			`DELETE FROM profiles WHERE identity_id = $1`,
			`DELETE FROM roles WHERE identity_id = $1`,
			`UPDATE reviews SET identity_id = '` + Anonymous + `' WHERE identity_id = $1`,
			// Its sessions and pending app codes go with it.
			`DELETE FROM accounts WHERE id = $1`,
		} {
			if _, err := tx.Exec(ctx, q, identityID); err != nil {
				return err
			}
		}
		return deleteIdentity(ctx)
	})
}
