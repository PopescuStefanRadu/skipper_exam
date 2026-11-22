package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/profile"
)

type fakeProfiles struct {
	mu sync.Mutex
	m  map[string][]string
}

func (f *fakeProfiles) Get(_ context.Context, id string) (profile.Profile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return profile.Profile{ExamTypes: f.m[id]}, nil
}

func (f *fakeProfiles) SetExamTypes(_ context.Context, id string, t []string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.m[id] = t
	return nil
}

func TestPutProfile(t *testing.T) {
	t.Parallel()
	k := fakeSessions{}
	profiles := &fakeProfiles{m: map[string][]string{}}
	h := New(Config{DB: fakeDB{}, Sessions: k, Profiles: profiles, ExamTypes: []content.ExamType{
		{ID: "C", Available: true},
		{ID: "D", Available: true},
		{ID: "A", Available: false},
	}})
	put := func(body string, signedIn bool) int {
		req := httptest.NewRequest(http.MethodPut, "/api/profile", strings.NewReader(body))
		if signedIn {
			req.AddCookie(&http.Cookie{Name: "session", Value: "valid"})
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	if code := put(`{"examTypes":["D"]}`, true); code != http.StatusOK || !slices.Equal(profiles.m["id-1"], []string{"D"}) {
		t.Fatalf("available type: status %d, stored %q", code, profiles.m["id-1"])
	}
	if code := put(`{"examTypes":["D","C","D"]}`, true); code != http.StatusOK || !slices.Equal(profiles.m["id-1"], []string{"C", "D"}) {
		t.Fatalf("several types: status %d, stored %q", code, profiles.m["id-1"])
	}
	for _, body := range []string{`{"examTypes":["A"]}`, `{"examTypes":["D","A"]}`, `{"examTypes":["Z"]}`, `{"examTypes":[]}`, `{}`, `not json`} {
		if code := put(body, true); code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", body, code)
		}
	}
	if code := put(`{"examTypes":["D"]}`, false); code != http.StatusUnauthorized {
		t.Errorf("signed out: status %d, want 401", code)
	}
}
