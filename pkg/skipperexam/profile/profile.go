// Package profile stores the app's data about each account, such as the exams the
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
	// ExamTypes are the exam types the user prepares for, in the content's order;
	// empty until the user has chosen.
	ExamTypes []string `json:"examTypes"`
}

// Store keeps profiles in Postgres.
type Store struct {
	Pool *pgxpool.Pool
}

// Get returns the profile of an account; a new account has an empty profile.
func (s *Store) Get(ctx context.Context, identityID string) (Profile, error) {
	p := Profile{ExamTypes: []string{}}
	err := s.Pool.QueryRow(ctx, `SELECT exam_types FROM profiles WHERE identity_id = $1`, identityID).Scan(&p.ExamTypes)
	if errors.Is(err, pgx.ErrNoRows) {
		return Profile{ExamTypes: []string{}}, nil
	}
	return p, err
}

// SetExamTypes records the exam types the user is preparing for.
func (s *Store) SetExamTypes(ctx context.Context, identityID string, examTypes []string) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO profiles (identity_id, exam_types) VALUES ($1, $2)
		ON CONFLICT (identity_id) DO UPDATE SET exam_types = excluded.exam_types, updated_at = now()`,
		identityID, examTypes)
	return err
}
