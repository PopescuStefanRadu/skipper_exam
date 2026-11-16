// Package profile stores the app's data about each account, such as the exam the
// user is preparing for.
package profile

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Profile is the app's data about one account.
type Profile struct {
	// ExamType is empty until the user has chosen one.
	ExamType string `json:"examType"`
}

// Store keeps profiles in Postgres.
type Store struct {
	Pool *pgxpool.Pool
}

// Get returns the profile of an account; a new account has an empty profile.
func (s *Store) Get(ctx context.Context, identityID string) (Profile, error) {
	var p Profile
	err := s.Pool.QueryRow(ctx, `SELECT exam_type FROM profiles WHERE identity_id = $1`, identityID).Scan(&p.ExamType)
	if errors.Is(err, pgx.ErrNoRows) {
		return Profile{}, nil
	}
	return p, err
}

// SetExamType records the exam the user is preparing for.
func (s *Store) SetExamType(ctx context.Context, identityID, examType string) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO profiles (identity_id, exam_type) VALUES ($1, $2)
		ON CONFLICT (identity_id) DO UPDATE SET exam_type = excluded.exam_type, updated_at = now()`,
		identityID, examType)
	return err
}
