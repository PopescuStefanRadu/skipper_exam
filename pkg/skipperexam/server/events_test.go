package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/events"
)

type fakeEvents struct {
	mu sync.Mutex
	m  map[string][]events.Event
}

func (f *fakeEvents) Append(_ context.Context, id string, evs []events.Event) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.m[id] = append(f.m[id], evs...)
	return nil
}

func (f *fakeEvents) List(_ context.Context, id string) ([]events.Event, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]events.Event{}, f.m[id]...), nil
}

func TestPostEvents(t *testing.T) {
	t.Parallel()
	store := &fakeEvents{m: map[string][]events.Event{}}
	h := New(Config{DB: fakeDB{}, Sessions: fakeKratos(t), Events: store})
	post := func(body string, signedIn bool) int {
		req := httptest.NewRequest(http.MethodPost, "/api/events", strings.NewReader(body))
		if signedIn {
			req.AddCookie(&http.Cookie{Name: "session", Value: "valid"})
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	const valid = `{"id":"0b8f2f9e-3d0c-4c47-9d55-6d6c3a0e4f11","type":"exam.started","at":"2026-11-16T10:00:00Z","data":{"examId":"x"}}`
	if code := post(`{"events":[`+valid+`]}`, true); code != http.StatusOK || len(store.m["id-1"]) != 1 {
		t.Fatalf("valid event: status %d, stored %d", code, len(store.m["id-1"]))
	}
	for name, ev := range map[string]string{
		"bad id":       strings.Replace(valid, "0b8f2f9e", "nope", 1),
		"unknown type": strings.Replace(valid, "exam.started", "admin.grant", 1),
		"no time":      strings.Replace(valid, `"at":"2026-11-16T10:00:00Z",`, "", 1),
		"data array":   strings.Replace(valid, `{"examId":"x"}`, `[1]`, 1),
	} {
		if code := post(`{"events":[`+ev+`]}`, true); code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", name, code)
		}
	}
	if code := post(`{"events":[`+valid+`]}`, false); code != http.StatusUnauthorized {
		t.Errorf("signed out: status %d, want 401", code)
	}
	if len(store.m["id-1"]) != 1 {
		t.Errorf("refused requests stored events: %d", len(store.m["id-1"]))
	}
}
