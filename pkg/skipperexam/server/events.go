package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"regexp"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/events"
)

// Events stores the events recorded on users' devices.
type Events interface {
	Append(ctx context.Context, identityID string, evs []events.Event) error
	List(ctx context.Context, identityID string) ([]events.Event, error)
}

// eventTypes are the event types the apps record.
var eventTypes = map[string]bool{
	"exam.started":   true,
	"exam.answered":  true,
	"exam.submitted": true,
	"exam.abandoned": true,
}

const (
	maxEventsPerRequest = 500
	maxEventsBody       = 4 << 20
)

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type postEventsBody struct {
	Events []events.Event `json:"events"`
}

func postEvents(store Events) func(http.ResponseWriter, *http.Request, Identity) {
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		var body postEventsBody
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxEventsBody)).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if len(body.Events) > maxEventsPerRequest {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "too many events"})
			return
		}
		for _, e := range body.Events {
			if !uuidPattern.MatchString(e.ID) || !eventTypes[e.Type] || e.At.IsZero() ||
				!bytes.HasPrefix(bytes.TrimSpace(e.Data), []byte("{")) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid event " + e.ID})
				return
			}
		}
		if err := store.Append(r.Context(), id.ID, body.Events); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not store events"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]int{"stored": len(body.Events)})
	}
}

func listEvents(store Events) func(http.ResponseWriter, *http.Request, Identity) {
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		evs, err := store.List(r.Context(), id.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read events"})
			return
		}
		writeJSON(w, http.StatusOK, evs)
	}
}
