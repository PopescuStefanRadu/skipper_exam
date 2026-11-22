package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// discoveryServer serves a discovery document, with the sign-out page when given.
func discoveryServer(t *testing.T, endSession bool) *httptest.Server {
	t.Helper()
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		doc := map[string]string{
			"issuer":                 srv.URL,
			"authorization_endpoint": srv.URL + "/authorize",
			"token_endpoint":         srv.URL + "/token",
			"jwks_uri":               srv.URL + "/jwks",
		}
		if endSession {
			doc["end_session_endpoint"] = srv.URL + "/end-session/"
		}
		_ = json.NewEncoder(w).Encode(doc)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestEndSessionURL(t *testing.T) {
	t.Parallel()
	with := discoveryServer(t, true)
	got, err := (&Provider{IssuerURL: with.URL, ClientID: "c"}).EndSessionURL(context.Background())
	if err != nil || got != with.URL+"/end-session/" {
		t.Errorf("with a sign-out page: %q %v", got, err)
	}
	without := discoveryServer(t, false)
	got, err = (&Provider{IssuerURL: without.URL, ClientID: "c"}).EndSessionURL(context.Background())
	if err != nil || got != "" {
		t.Errorf("without a sign-out page: %q %v", got, err)
	}
}
