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
	SetExamTypes(ctx context.Context, identityID string, examTypes []string) error
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
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		var body profile.Profile
		chosen, ok := []string(nil), false
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			chosen, ok = chosenTypes(types, body.ExamTypes)
		}
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "choose at least one available exam type"})
			return
		}
		body.ExamTypes = chosen
		if err := profiles.SetExamTypes(r.Context(), id.ID, chosen); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save profile"})
			return
		}
		writeJSON(w, http.StatusOK, body)
	}
}

// chosenTypes checks a choice of exam types: at least one, each available. It
// returns them once each, in the content's order.
func chosenTypes(types []content.ExamType, ids []string) ([]string, bool) {
	want := map[string]bool{}
	for _, id := range ids {
		want[id] = true
	}
	out := []string{}
	for _, t := range types {
		if want[t.ID] {
			if !t.Available {
				return nil, false
			}
			out = append(out, t.ID)
			delete(want, t.ID)
		}
	}
	return out, len(want) == 0 && len(out) > 0
}
