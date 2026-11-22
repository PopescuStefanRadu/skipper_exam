// Command mock-oidc is the fake sign-in service of the test stack: a minimal OpenID
// Connect provider standing in for Authentik and Google. Its sign-in page lets a
// test choose who signs in (the user ID becomes "sub") and which claims are sent.
// Every sign-in keeps its own state, so parallel sign-ins never mix up their users
// or nonces. Never use it outside tests: it signs in anyone as anyone.
//
// It serves one issuer, http://127.0.0.1:$PORT/default: discovery, authorize (the
// sign-in page, then a redirect with a code), token (authorization code with PKCE)
// and the keys. ID tokens are signed with RS256 by a key made at start-up.
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"os"
	"sync"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

type grant struct {
	clientID, redirectURI, nonce, challenge string
	subject                                 string
	claims                                  map[string]any
	created                                 time.Time
}

type provider struct {
	issuer string
	key    *rsa.PrivateKey
	signer jose.Signer

	mu     sync.Mutex
	grants map[string]grant
}

var page = template.Must(template.New("page").Parse(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mock OAuth2 Server Sign-in</title>
<style>body{font-family:sans-serif;margin:2rem;max-width:40rem} input,textarea{display:block;width:100%;margin:.5rem 0 1rem;font:inherit;box-sizing:border-box}</style>
</head><body>
<h1>Mock OAuth2 Server Sign-in</h1>
<form method="post">
<label>User ID<input required type="text" name="username" autofocus></label>
<label>Claims (JSON)<textarea name="claims" rows="8" placeholder="{}"></textarea></label>
<input type="submit" value="Sign-in">
</form>
</body></html>`))

func main() {
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080"
	}
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatal(err)
	}
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: jose.JSONWebKey{Key: key, KeyID: "mock", Algorithm: "RS256"}},
		(&jose.SignerOptions{}).WithType("JWT"))
	if err != nil {
		log.Fatal(err)
	}
	p := &provider{issuer: "http://127.0.0.1:" + port + "/default", key: key, signer: signer, grants: map[string]grant{}}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /default/.well-known/openid-configuration", p.discovery)
	mux.HandleFunc("GET /default/jwks", p.jwks)
	mux.HandleFunc("GET /default/authorize", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = page.Execute(w, nil)
	})
	mux.HandleFunc("POST /default/authorize", p.authorize)
	mux.HandleFunc("POST /default/token", p.token)
	mux.HandleFunc("GET /default/end-session", endSession)
	log.Printf("mock OpenID Connect provider at %s", p.issuer)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (p *provider) discovery(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"issuer":                                p.issuer,
		"authorization_endpoint":                p.issuer + "/authorize",
		"token_endpoint":                        p.issuer + "/token",
		"jwks_uri":                              p.issuer + "/jwks",
		"end_session_endpoint":                  p.issuer + "/end-session",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"code_challenge_methods_supported":      []string{"S256"},
		"scopes_supported":                      []string{"openid", "email", "profile"},
	})
}

func (p *provider) jwks(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &p.key.PublicKey, KeyID: "mock", Algorithm: "RS256", Use: "sig"}}})
}

func random() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// authorize handles the sign-in form: the request's parameters are in the query,
// the chosen user and claims in the form.
func (p *provider) authorize(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	redirect, err := url.Parse(q.Get("redirect_uri"))
	if err != nil || redirect.Scheme == "" || q.Get("response_type") != "code" || q.Get("code_challenge_method") != "S256" {
		http.Error(w, "bad authorization request", http.StatusBadRequest)
		return
	}
	claims := map[string]any{}
	if c := r.PostFormValue("claims"); c != "" {
		if err := json.Unmarshal([]byte(c), &claims); err != nil {
			http.Error(w, "claims must be a JSON object", http.StatusBadRequest)
			return
		}
	}
	subject := r.PostFormValue("username")
	if subject == "" {
		http.Error(w, "user ID required", http.StatusBadRequest)
		return
	}
	code := random()
	p.mu.Lock()
	for c, g := range p.grants {
		if time.Since(g.created) > 10*time.Minute {
			delete(p.grants, c)
		}
	}
	p.grants[code] = grant{clientID: q.Get("client_id"), redirectURI: q.Get("redirect_uri"), nonce: q.Get("nonce"),
		challenge: q.Get("code_challenge"), subject: subject, claims: claims, created: time.Now()}
	p.mu.Unlock()
	back := redirect.Query()
	back.Set("code", code)
	back.Set("state", q.Get("state"))
	redirect.RawQuery = back.Encode()
	http.Redirect(w, r, redirect.String(), http.StatusFound)
}

func (p *provider) token(w http.ResponseWriter, r *http.Request) {
	fail := func(msg string) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_grant", "error_description": msg})
	}
	if r.PostFormValue("grant_type") != "authorization_code" {
		fail("grant_type must be authorization_code")
		return
	}
	code := r.PostFormValue("code")
	p.mu.Lock()
	g, ok := p.grants[code]
	delete(p.grants, code)
	p.mu.Unlock()
	if !ok {
		fail("unknown or used code")
		return
	}
	clientID, _, hasBasic := r.BasicAuth()
	if !hasBasic {
		clientID = r.PostFormValue("client_id")
	}
	sum := sha256.Sum256([]byte(r.PostFormValue("code_verifier")))
	switch {
	case clientID != g.clientID:
		fail("wrong client")
		return
	case r.PostFormValue("redirect_uri") != g.redirectURI:
		fail("wrong redirect_uri")
		return
	case base64.RawURLEncoding.EncodeToString(sum[:]) != g.challenge:
		fail("PKCE verification failed")
		return
	}
	now := time.Now()
	claims := map[string]any{}
	for k, v := range g.claims {
		claims[k] = v
	}
	std := jwt.Claims{Issuer: p.issuer, Subject: g.subject, Audience: jwt.Audience{g.clientID},
		IssuedAt: jwt.NewNumericDate(now), Expiry: jwt.NewNumericDate(now.Add(time.Hour))}
	if g.nonce != "" {
		claims["nonce"] = g.nonce
	}
	idToken, err := jwt.Signed(p.signer).Claims(std).Claims(claims).Serialize()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"access_token": random(), "token_type": "Bearer", "expires_in": 3600, "id_token": idToken,
	})
}

// endSession is the sign-out page (RP-initiated logout). The mock keeps no
// sessions of its own, so it only says it signed the user out, like Authentik
// does before showing esrp.ro.
func endSession(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(`<!doctype html><title>Mock OAuth2 Server Signed out</title><h1>Signed out</h1>`))
}
