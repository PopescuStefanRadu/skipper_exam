package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/profile"
)

// Profiles stores the app's data about each account.
type Profiles interface {
	Get(ctx context.Context, identityID string) (profile.Profile, error)
	SetExamType(ctx context.Context, identityID, examType string) error
}

func examTypes(types []content.ExamType) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, types)
	}
}

// withIdentity runs h for signed-in requests and answers 401 otherwise.
func withIdentity(sessions Sessions, h func(w http.ResponseWriter, r *http.Request, id Identity)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := sessions.Identity(r.Context(), r)
		switch {
		case errors.Is(err, ErrNoSession):
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not signed in"})
		case err != nil:
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "account service unavailable"})
		default:
			h(w, r, id)
		}
	}
}

func getProfile(profiles Profiles) func(http.ResponseWriter, *http.Request, Identity) {
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		p, err := profiles.Get(r.Context(), id.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read profile"})
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func putProfile(profiles Profiles, types []content.ExamType) func(http.ResponseWriter, *http.Request, Identity) {
	available := map[string]bool{}
	for _, t := range types {
		available[t.ID] = t.Available
	}
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		var body profile.Profile
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || !available[body.ExamType] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unknown or unavailable exam type"})
			return
		}
		if err := profiles.SetExamType(r.Context(), id.ID, body.ExamType); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save profile"})
			return
		}
		writeJSON(w, http.StatusOK, body)
	}
}
