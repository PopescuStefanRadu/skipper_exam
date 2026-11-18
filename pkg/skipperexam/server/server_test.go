package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func TestHealth(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		db         fakeDB
		wantStatus int
		wantBody   healthResponse
	}{
		{"database up", fakeDB{}, http.StatusOK, healthResponse{Status: "ok", Database: "ok"}},
		{"database down", fakeDB{err: errors.New("down")}, http.StatusServiceUnavailable, healthResponse{Status: "degraded", Database: "unavailable"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			rec := httptest.NewRecorder()
			New(Config{DB: tt.db, Sessions: fakeSessions{}}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/health", nil))
			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			var got healthResponse
			if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
				t.Fatal(err)
			}
			if got != tt.wantBody {
				t.Fatalf("body = %+v, want %+v", got, tt.wantBody)
			}
		})
	}
}

func TestSPA(t *testing.T) {
	t.Parallel()
	web := fstest.MapFS{
		"index.html":    {Data: []byte("index")},
		"assets/app.js": {Data: []byte("js")},
	}
	h := New(Config{DB: fakeDB{}, Web: web})
	tests := []struct {
		path       string
		wantStatus int
		wantBody   string
	}{
		{"/", http.StatusOK, "index"},
		{"/assets/app.js", http.StatusOK, "js"},
		{"/exam/123", http.StatusOK, "index"},
		{"/api/unknown", http.StatusNotFound, "{\"error\":\"not found\"}\n"},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			t.Parallel()
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.path, nil))
			body, _ := io.ReadAll(rec.Body)
			if rec.Code != tt.wantStatus || string(body) != tt.wantBody {
				t.Fatalf("got %d %q, want %d %q", rec.Code, body, tt.wantStatus, tt.wantBody)
			}
		})
	}
}
