package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/profile"
)

type fakeProfiles struct {
	mu sync.Mutex
	m  map[string]string
}

func (f *fakeProfiles) Get(_ context.Context, id string) (profile.Profile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return profile.Profile{ExamType: f.m[id]}, nil
}

func (f *fakeProfiles) SetExamType(_ context.Context, id, t string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.m[id] = t
	return nil
}

func TestPutProfile(t *testing.T) {
	t.Parallel()
	k := fakeKratos(t)
	profiles := &fakeProfiles{m: map[string]string{}}
	h := New(Config{DB: fakeDB{}, Sessions: k, Profiles: profiles, ExamTypes: []content.ExamType{
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
	if code := put(`{"examType":"D"}`, true); code != http.StatusOK || profiles.m["id-1"] != "D" {
		t.Fatalf("available type: status %d, stored %q", code, profiles.m["id-1"])
	}
	for _, body := range []string{`{"examType":"A"}`, `{"examType":"Z"}`, `not json`} {
		if code := put(body, true); code != http.StatusBadRequest {
			t.Errorf("%s: status %d, want 400", body, code)
		}
	}
	if code := put(`{"examType":"D"}`, false); code != http.StatusUnauthorized {
		t.Errorf("signed out: status %d, want 401", code)
	}
}
