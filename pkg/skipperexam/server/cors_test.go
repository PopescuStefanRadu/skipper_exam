package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSAllowsOnlyAppOrigins(t *testing.T) {
	h := cors([]string{"https://localhost"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	pre := httptest.NewRequest(http.MethodOptions, "/api/events", nil)
	pre.Header.Set("Origin", "https://localhost")
	pre.Header.Set("Access-Control-Request-Method", "POST")
	res := httptest.NewRecorder()
	h.ServeHTTP(res, pre)
	if res.Code != http.StatusNoContent || res.Header().Get("Access-Control-Allow-Origin") != "https://localhost" {
		t.Fatalf("preflight: %d %v", res.Code, res.Header())
	}
	if res.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Fatal("credentials must not be allowed across origins")
	}

	other := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	other.Header.Set("Origin", "https://evil.example")
	res = httptest.NewRecorder()
	h.ServeHTTP(res, other)
	if res.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("unknown origin allowed")
	}
}
