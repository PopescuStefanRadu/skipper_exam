package server

import (
	"context"
	"encoding/json"
	"net/http"
	"path/filepath"
	"slices"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/review"
)

// RoleReviewer may review explanations.
const RoleReviewer = "reviewer"

// Reviews stores reviewers' decisions and accounts' roles.
type Reviews interface {
	Append(ctx context.Context, r review.Review) error
	List(ctx context.Context) ([]review.Review, error)
	Roles(ctx context.Context, identityID string) ([]string, error)
}

// Library is the content behind explanations: the questions, the explanations,
// the bibliography sources and their text.
type Library struct {
	Content *content.Content
	// Dir is the content directory, where the source PDFs are.
	Dir   string
	Texts map[string]*content.SourceText
}

func (l *Library) effective(ctx context.Context, reviews Reviews) ([]review.Explanation, error) {
	rs, err := reviews.List(ctx)
	if err != nil {
		return nil, err
	}
	return review.Effective(l.Content, rs), nil
}

func isReviewer(ctx context.Context, reviews Reviews, id Identity) (bool, error) {
	roles, err := reviews.Roles(ctx, id.ID)
	return slices.Contains(roles, RoleReviewer), err
}

func listExplanations(lib *Library, reviews Reviews) func(http.ResponseWriter, *http.Request, Identity) {
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		es, err := lib.effective(r.Context(), reviews)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read reviews"})
			return
		}
		reviewer, err := isReviewer(r.Context(), reviews, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read roles"})
			return
		}
		if !reviewer {
			for i := range es {
				es[i].Concern, es[i].Note = "", ""
			}
		}
		writeJSON(w, http.StatusOK, es)
	}
}

type reviewBody struct {
	ID         string          `json:"id"`
	QuestionID string          `json:"questionId"`
	Action     string          `json:"action"`
	Note       string          `json:"note"`
	Correction *review.Passage `json:"correction"`
}

func postReview(lib *Library, reviews Reviews) func(http.ResponseWriter, *http.Request, Identity) {
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		ctx := r.Context()
		reviewer, err := isReviewer(ctx, reviews, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read roles"})
			return
		}
		if !reviewer {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "only reviewers can review explanations"})
			return
		}
		var body reviewBody
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil || !uuidPattern.MatchString(body.ID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		q := lib.Content.Question(body.QuestionID)
		if q == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown question"})
			return
		}
		rv := review.Review{ID: body.ID, QuestionID: q.ID, IdentityID: id.ID, Action: body.Action, Data: review.Data{Revision: q.Revision}}
		bad := func(msg string) { writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg}) }
		switch body.Action {
		case review.Confirm, review.Reject:
			base := explanationOf(lib.Content, q.ID)
			if base == nil {
				bad("the question has no proposed explanation")
				return
			}
			p := review.PassageOf(*base)
			rv.Reviewed = &p
		case review.Correct:
			c := body.Correction
			if c == nil || c.Reference == "" || c.Quote == "" {
				bad("a correction needs a document, a page, a reference and a quote")
				return
			}
			text := lib.Texts[c.Source]
			if text == nil {
				bad("unknown document")
				return
			}
			if !text.QuoteOnPage(c.Quote, c.Page) {
				writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "the quote isn't on that page"})
				return
			}
			c.Quote, c.Reference = content.Normalize(c.Quote), content.Normalize(c.Reference)
			rv.Correction = c
		case review.Flag:
			if body.Note == "" {
				bad("a flag needs a note")
				return
			}
			rv.Note = content.Normalize(body.Note)
		case review.Reset:
		default:
			bad("unknown action")
			return
		}
		if err := reviews.Append(ctx, rv); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save the review"})
			return
		}
		es, err := lib.effective(ctx, reviews)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read reviews"})
			return
		}
		for _, e := range es {
			if e.QuestionID == q.ID {
				writeJSON(w, http.StatusOK, e)
				return
			}
		}
		writeJSON(w, http.StatusOK, review.Explanation{QuestionID: q.ID, Status: review.StatusRejected})
	}
}

func explanationOf(c *content.Content, questionID string) *content.Explanation {
	for i := range c.Explanations {
		if c.Explanations[i].QuestionID == questionID {
			return &c.Explanations[i]
		}
	}
	return nil
}

// sourceDocument serves a bibliography source's PDF.
func sourceDocument(lib *Library) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s := lib.Content.Source(r.PathValue("id"))
		if s == nil || s.Kind != content.KindBibliography {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown document"})
			return
		}
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		http.ServeFile(w, r, filepath.Join(lib.Dir, s.File))
	}
}
