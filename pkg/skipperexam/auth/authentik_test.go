package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

// fakeAuthentik serves users by UUID and records deletions.
func fakeAuthentik(t *testing.T, users map[string]string) (*Authentik, *[]string) {
	t.Helper()
	var mu sync.Mutex
	var deleted []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/v3/core/users/":
			body, ok := users[r.URL.Query().Get("uuid")]
			if !ok {
				body = `{"results":[]}`
			}
			_, _ = w.Write([]byte(body))
		case r.Method == http.MethodDelete:
			mu.Lock()
			deleted = append(deleted, r.URL.Path)
			mu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	a, err := NewAuthentik(srv.URL, "tok", "skipper-exam")
	if err != nil {
		t.Fatal(err)
	}
	return a, &deleted
}

func TestDeleteIfAppOnly(t *testing.T) {
	a, deleted := fakeAuthentik(t, map[string]string{
		"app-only": `{"results":[{"pk":7,"is_superuser":false,"groups_obj":[{"name":"skipper-exam"}]}]}`,
		"shared":   `{"results":[{"pk":8,"is_superuser":false,"groups_obj":[{"name":"skipper-exam"},{"name":"jellyfin"}]}]}`,
		"admin":    `{"results":[{"pk":9,"is_superuser":true,"groups_obj":[{"name":"skipper-exam"}]}]}`,
		"no-group": `{"results":[{"pk":10,"is_superuser":false,"groups_obj":[]}]}`,
	})
	for _, subject := range []string{"app-only", "shared", "admin", "no-group", "gone"} {
		if err := a.DeleteIfAppOnly(context.Background(), subject); err != nil {
			t.Fatalf("%s: %v", subject, err)
		}
	}
	if len(*deleted) != 1 || (*deleted)[0] != "/api/v3/core/users/7/" {
		t.Fatalf("deleted %v, want only the app-only user", *deleted)
	}

	a.Token = "wrong"
	if err := a.DeleteIfAppOnly(context.Background(), "app-only"); err == nil {
		t.Fatal("a refused API call must fail the deletion")
	}
}
