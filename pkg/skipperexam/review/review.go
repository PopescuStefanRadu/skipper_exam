// Package review stores reviewers' decisions about explanations and works out the
// explanations users see (see docs/app/features/explanations.md).
package review

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
)

// Actions a reviewer can take on a question's explanation.
const (
	Confirm = "confirm"
	Reject  = "reject"
	Correct = "correct"
	Flag    = "flag"
	Reset   = "reset"
)

// Statuses an explanation can have once reviews are applied, besides the content's
// own (suggested, verified, stale).
const StatusRejected = "rejected"

// Review is one reviewer decision.
type Review struct {
	ID         string    `json:"id"`
	QuestionID string    `json:"questionId"`
	IdentityID string    `json:"-"`
	Action     string    `json:"action"`
	CreatedAt  time.Time `json:"createdAt"`
	Data
}

// Data is what a review records besides who and when.
type Data struct {
	// Revision is the question revision the review was made on.
	Revision int `json:"revision"`
	// Reviewed is the explanation the reviewer confirmed or rejected; the decision
	// only applies while the content still has that explanation.
	Reviewed *Passage `json:"reviewed,omitempty"`
	// Correction is the passage a "correct" review puts in place.
	Correction *Passage `json:"correction,omitempty"`
	Note       string   `json:"note,omitempty"`
}

// Passage is the part of an explanation a reviewer looks at.
type Passage struct {
	Source    string `json:"source"`
	Page      int    `json:"page"`
	Reference string `json:"reference"`
	Quote     string `json:"quote"`
}

// PassageOf returns the passage of an explanation.
func PassageOf(e content.Explanation) Passage {
	return Passage{Source: e.Source, Page: e.Page, Reference: e.Reference, Quote: e.Quote}
}

// Explanation is an explanation as users see it, with reviews applied.
type Explanation struct {
	QuestionID  string `json:"questionId"`
	Status      string `json:"status"`
	SourceTitle string `json:"sourceTitle"`
	Passage
	Flagged  bool   `json:"flagged,omitempty"`
	FlagNote string `json:"flagNote,omitempty"`
	// Concern and Note come from the proposal, for reviewers only.
	Concern string `json:"concern,omitempty"`
	Note    string `json:"note,omitempty"`
}

// Effective applies the reviews, oldest first, to the content's explanations. It
// returns one explanation per question that has one, a correction, or a flag.
func Effective(c *content.Content, reviews []Review) []Explanation {
	titles := map[string]string{}
	for _, s := range c.Sources {
		titles[s.ID] = s.Title
	}
	byQuestion := map[string]*Explanation{}
	var order []string
	base := map[string]content.Explanation{}
	for _, e := range c.Explanations {
		base[e.QuestionID] = e
		byQuestion[e.QuestionID] = &Explanation{
			QuestionID: e.QuestionID, Status: e.Status, Passage: PassageOf(e), Concern: e.Concern, Note: e.Note,
		}
		order = append(order, e.QuestionID)
	}
	for _, r := range reviews {
		q := c.Question(r.QuestionID)
		if q == nil || r.Revision != q.Revision {
			continue // made on an older question: no longer applies
		}
		e := byQuestion[r.QuestionID]
		b, hasBase := base[r.QuestionID]
		matches := hasBase && r.Reviewed != nil && *r.Reviewed == PassageOf(b)
		switch r.Action {
		case Confirm:
			if matches {
				e.Status, e.Passage = content.StatusVerified, PassageOf(b)
			}
		case Reject:
			if matches {
				e.Status, e.Passage = StatusRejected, PassageOf(b)
			}
		case Correct:
			if r.Correction == nil {
				continue
			}
			if e == nil {
				e = &Explanation{QuestionID: r.QuestionID}
				byQuestion[r.QuestionID] = e
				order = append(order, r.QuestionID)
			}
			e.Status, e.Passage = content.StatusVerified, *r.Correction
		case Flag:
			if e == nil {
				e = &Explanation{QuestionID: r.QuestionID, Status: StatusRejected}
				byQuestion[r.QuestionID] = e
				order = append(order, r.QuestionID)
			}
			e.Flagged, e.FlagNote = true, r.Note
		case Reset:
			if hasBase {
				*e = Explanation{QuestionID: b.QuestionID, Status: b.Status, Passage: PassageOf(b), Concern: b.Concern, Note: b.Note}
			} else if e != nil {
				*e = Explanation{QuestionID: r.QuestionID, Status: StatusRejected}
			}
		}
	}
	out := make([]Explanation, 0, len(order))
	for _, id := range order {
		e := byQuestion[id]
		e.SourceTitle = titles[e.Source]
		out = append(out, *e)
	}
	return out
}

// Store keeps reviews and roles in Postgres.
type Store struct {
	Pool *pgxpool.Pool
}

// Append stores a review. Sending the same review twice stores it once.
func (s *Store) Append(ctx context.Context, r Review) error {
	data, err := json.Marshal(r.Data)
	if err != nil {
		return err
	}
	_, err = s.Pool.Exec(ctx, `INSERT INTO reviews (id, question_id, identity_id, action, data) VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO NOTHING`, r.ID, r.QuestionID, r.IdentityID, r.Action, data)
	return err
}

// List returns all reviews, oldest first.
func (s *Store) List(ctx context.Context) ([]Review, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text, question_id, identity_id::text, action, data, created_at FROM reviews ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Review
	for rows.Next() {
		var r Review
		var data []byte
		if err := rows.Scan(&r.ID, &r.QuestionID, &r.IdentityID, &r.Action, &data, &r.CreatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(data, &r.Data); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// Roles returns the roles of an account.
func (s *Store) Roles(ctx context.Context, identityID string) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT role FROM roles WHERE identity_id = $1 ORDER BY role`, identityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	roles := []string{}
	for rows.Next() {
		var r string
		if err := rows.Scan(&r); err != nil {
			return nil, err
		}
		roles = append(roles, r)
	}
	return roles, rows.Err()
}

// Grant gives an account a role.
func (s *Store) Grant(ctx context.Context, identityID, role string) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO roles (identity_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING`, identityID, role)
	return err
}
