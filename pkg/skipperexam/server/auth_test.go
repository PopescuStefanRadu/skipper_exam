package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fakeKratos answers whoami for the cookie "session=valid" and echoes other paths.
func fakeKratos(t *testing.T) *Kratos {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/sessions/whoami" {
			if c, err := r.Cookie("session"); err != nil || c.Value != "valid" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_, _ = io.WriteString(w, `{"identity":{"id":"id-1","traits":{"email":"a@example.test"}}}`)
			return
		}
		_, _ = io.WriteString(w, "kratos:"+r.URL.Path+"?"+r.URL.RawQuery)
	}))
	t.Cleanup(srv.Close)
	k, err := NewKratos(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	return k
}

func TestMe(t *testing.T) {
	t.Parallel()
	k := fakeKratos(t)
	h := New(Config{DB: fakeDB{}, Sessions: k, AccountsProxy: k.Proxy()})

	t.Run("signed in", func(t *testing.T) {
		t.Parallel()
		req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
		req.AddCookie(&http.Cookie{Name: "session", Value: "valid"})
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		var got Identity
		_ = json.NewDecoder(rec.Body).Decode(&got)
		if rec.Code != http.StatusOK || got.ID != "id-1" || got.Email != "a@example.test" || got.Roles == nil {
			t.Fatalf("got %d %+v", rec.Code, got)
		}
	})

	t.Run("signed out", func(t *testing.T) {
		t.Parallel()
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/me", nil))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})
}

func TestAccountsProxyStripsPrefix(t *testing.T) {
	t.Parallel()
	k := fakeKratos(t)
	h := New(Config{DB: fakeDB{}, Sessions: k, AccountsProxy: k.Proxy()})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/.ory/self-service/login/browser?x=1", nil))
	if body := rec.Body.String(); body != "kratos:/self-service/login/browser?x=1" {
		t.Fatalf("proxied to %q", body)
	}
}
