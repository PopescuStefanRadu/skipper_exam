// Package auth signs users in through esrp.ro's sign-in service (Authentik, an
// OpenID Connect provider) and keeps the app's own accounts and sessions (see
// docs/app/features/accounts.md).
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Account is a user of the app.
type Account struct {
	ID string
	// Subject is the sign-in service's user ID.
	Subject string
	Email   string
}

// LoginRequest is a sign-in in progress at the sign-in service.
type LoginRequest struct {
	State    string
	Nonce    string
	Verifier string
	// Platform is "web" or "app" (the Android app).
	Platform string
	// ReturnTo is the website path to open after signing in.
	ReturnTo string
}

// ErrNotFound means an unknown, expired or already used token, code or request.
var ErrNotFound = errors.New("not found")

const (
	// SessionLifetime is how long a session lasts after its last use.
	SessionLifetime = 365 * 24 * time.Hour
	loginLifetime   = 15 * time.Minute
	appCodeLifetime = 5 * time.Minute
)

// Store keeps accounts, sessions and sign-ins in progress in Postgres.
type Store struct {
	Pool *pgxpool.Pool
}

// RandomToken returns 32 random bytes, base64url-encoded.
func RandomToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func hash(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}

// SaveLoginRequest stores a sign-in that is starting.
func (s *Store) SaveLoginRequest(ctx context.Context, r LoginRequest) error {
	// Abandoned sign-ins are cleaned up as new ones start.
	if _, err := s.Pool.Exec(ctx, `DELETE FROM login_requests WHERE created_at < $1`, time.Now().Add(-loginLifetime)); err != nil {
		return err
	}
	_, err := s.Pool.Exec(ctx, `INSERT INTO login_requests (state, nonce, verifier, platform, return_to) VALUES ($1, $2, $3, $4, $5)`,
		r.State, r.Nonce, r.Verifier, r.Platform, r.ReturnTo)
	return err
}

// TakeLoginRequest returns and removes the sign-in with the given state, if it's recent.
func (s *Store) TakeLoginRequest(ctx context.Context, state string) (LoginRequest, error) {
	r := LoginRequest{State: state}
	err := s.Pool.QueryRow(ctx, `DELETE FROM login_requests WHERE state = $1 AND created_at > $2
		RETURNING nonce, verifier, platform, return_to`, state, time.Now().Add(-loginLifetime)).
		Scan(&r.Nonce, &r.Verifier, &r.Platform, &r.ReturnTo)
	if errors.Is(err, pgx.ErrNoRows) {
		return LoginRequest{}, ErrNotFound
	}
	return r, err
}

// SignedIn returns the account of the sign-in service's user, creating it at the
// first sign-in, and records the user's current email.
func (s *Store) SignedIn(ctx context.Context, subject, email string) (Account, error) {
	a := Account{Subject: subject, Email: email}
	err := s.Pool.QueryRow(ctx, `INSERT INTO accounts (subject, email) VALUES ($1, $2)
		ON CONFLICT (subject) DO UPDATE SET email = excluded.email, signed_in_at = now()
		RETURNING id::text`, subject, email).Scan(&a.ID)
	return a, err
}

// NewSession starts a session for an account and returns its token.
func (s *Store) NewSession(ctx context.Context, accountID string) (string, error) {
	token := RandomToken()
	_, err := s.Pool.Exec(ctx, `INSERT INTO sessions (token_hash, account_id) VALUES ($1, $2)`, hash(token), accountID)
	return token, err
}

// SessionAccount returns the account a session token belongs to, and keeps the
// session alive.
func (s *Store) SessionAccount(ctx context.Context, token string) (Account, error) {
	var a Account
	var lastUsed time.Time
	err := s.Pool.QueryRow(ctx, `SELECT a.id::text, a.subject, a.email, s.last_used_at FROM sessions s
		JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = $1`, hash(token)).
		Scan(&a.ID, &a.Subject, &a.Email, &lastUsed)
	if errors.Is(err, pgx.ErrNoRows) {
		return Account{}, ErrNotFound
	}
	if err != nil {
		return Account{}, err
	}
	if time.Since(lastUsed) > SessionLifetime {
		_ = s.DeleteSession(ctx, token)
		return Account{}, ErrNotFound
	}
	// Recording every use would write on every request; once an hour is enough.
	if time.Since(lastUsed) > time.Hour {
		_, _ = s.Pool.Exec(ctx, `UPDATE sessions SET last_used_at = now() WHERE token_hash = $1`, hash(token))
	}
	return a, nil
}

// DeleteSession ends a session.
func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, hash(token))
	return err
}

// NewAppCode returns a one-time code the Android app exchanges for a session token.
func (s *Store) NewAppCode(ctx context.Context, accountID string) (string, error) {
	if _, err := s.Pool.Exec(ctx, `DELETE FROM app_codes WHERE created_at < $1`, time.Now().Add(-appCodeLifetime)); err != nil {
		return "", err
	}
	code := RandomToken()
	_, err := s.Pool.Exec(ctx, `INSERT INTO app_codes (code_hash, account_id) VALUES ($1, $2)`, hash(code), accountID)
	return code, err
}

// TakeAppCode uses up a one-time code and returns its account's ID.
func (s *Store) TakeAppCode(ctx context.Context, code string) (string, error) {
	var id string
	err := s.Pool.QueryRow(ctx, `DELETE FROM app_codes WHERE code_hash = $1 AND created_at > $2 RETURNING account_id::text`,
		hash(code), time.Now().Add(-appCodeLifetime)).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return id, err
}

// ByEmail finds the accounts with an email, ignoring case.
func (s *Store) ByEmail(ctx context.Context, email string) ([]Account, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text, subject, email FROM accounts WHERE lower(email) = lower($1)`, email)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Account, error) {
		var a Account
		err := row.Scan(&a.ID, &a.Subject, &a.Email)
		return a, err
	})
}
