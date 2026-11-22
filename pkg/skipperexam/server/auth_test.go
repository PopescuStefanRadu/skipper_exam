package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/auth"
)

// fakeSessions accepts the cookie "session=valid" as account id-1.
type fakeSessions struct{}

func (fakeSessions) Identity(_ context.Context, r *http.Request) (Identity, error) {
	if c, err := r.Cookie("session"); err == nil && c.Value == "valid" {
		return Identity{ID: "id-1", Email: "a@example.test", Subject: "sub-1"}, nil
	}
	return Identity{}, ErrNoSession
}

// memStore is an in-memory AuthStore.
type memStore struct {
	mu       sync.Mutex
	requests map[string]auth.LoginRequest
	accounts map[string]auth.Account // by subject
	sessions map[string]string       // token → account ID
	codes    map[string]string       // app code → account ID
}

func newMemStore() *memStore {
	return &memStore{requests: map[string]auth.LoginRequest{}, accounts: map[string]auth.Account{},
		sessions: map[string]string{}, codes: map[string]string{}}
}

func (m *memStore) SaveLoginRequest(_ context.Context, r auth.LoginRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.requests[r.State] = r
	return nil
}

func (m *memStore) TakeLoginRequest(_ context.Context, state string) (auth.LoginRequest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.requests[state]
	if !ok {
		return auth.LoginRequest{}, auth.ErrNotFound
	}
	delete(m.requests, state)
	return r, nil
}

func (m *memStore) SignedIn(_ context.Context, subject, email string) (auth.Account, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, ok := m.accounts[subject]
	if !ok {
		a = auth.Account{ID: "acc-" + subject, Subject: subject}
	}
	a.Email = email
	m.accounts[subject] = a
	return a, nil
}

func (m *memStore) NewSession(_ context.Context, id string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t := auth.RandomToken()
	m.sessions[t] = id
	return t, nil
}

func (m *memStore) SessionAccount(_ context.Context, token string) (auth.Account, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.sessions[token]
	if !ok {
		return auth.Account{}, auth.ErrNotFound
	}
	for _, a := range m.accounts {
		if a.ID == id {
			return a, nil
		}
	}
	return auth.Account{}, auth.ErrNotFound
}

func (m *memStore) DeleteSession(_ context.Context, token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, token)
	return nil
}

func (m *memStore) NewAppCode(_ context.Context, id string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c := auth.RandomToken()
	m.codes[c] = id
	return c, nil
}

func (m *memStore) TakeAppCode(_ context.Context, code string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.codes[code]
	if !ok {
		return "", auth.ErrNotFound
	}
	delete(m.codes, code)
	return id, nil
}

// fakeService signs in whoever the code names ("good:<subject>"), if the
// verifier and nonce match the ones the sign-in started with.
type fakeService struct {
	mu     sync.Mutex
	issued map[string][2]string // state → verifier, nonce
}

func (f *fakeService) AuthURL(_ context.Context, state, nonce, verifier string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.issued[state] = [2]string{verifier, nonce}
	return "https://auth.example/authorize?state=" + url.QueryEscape(state), nil
}

func (f *fakeService) EndSessionURL(context.Context) (string, error) {
	return "https://auth.example/end-session/", nil
}

func (f *fakeService) Exchange(_ context.Context, code, verifier, nonce string) (auth.Claims, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	subject, ok := strings.CutPrefix(code, "good:")
	if !ok {
		return auth.Claims{}, errors.New("bad code")
	}
	for _, vn := range f.issued {
		if vn == [2]string{verifier, nonce} {
			return auth.Claims{Subject: subject, Email: subject + "@example.test"}, nil
		}
	}
	return auth.Claims{}, errors.New("unknown verifier")
}

func newAuthServer(secure bool) (http.Handler, *memStore) {
	store := newMemStore()
	a := &Auth{Store: store, Service: &fakeService{issued: map[string][2]string{}}, SecureCookies: secure}
	return New(Config{DB: fakeDB{}, Sessions: a, Auth: a}), store
}

func get(h http.Handler, target string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

// startSignIn begins a sign-in and returns the state the service was given.
func startSignIn(t *testing.T, h http.Handler, query string) string {
	t.Helper()
	rec := get(h, "/auth/login?"+query)
	loc, _ := url.Parse(rec.Header().Get("Location"))
	if rec.Code != http.StatusFound || loc.Host != "auth.example" {
		t.Fatalf("login: %d %s", rec.Code, rec.Header().Get("Location"))
	}
	return loc.Query().Get("state")
}

func sessionCookie(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == SessionCookie {
			return c
		}
	}
	return nil
}

func TestWebSignIn(t *testing.T) {
	t.Parallel()
	h, _ := newAuthServer(true)
	state := startSignIn(t, h, "return_to=/invatare")
	rec := get(h, "/auth/callback?code=good:u1&state="+state)
	c := sessionCookie(rec)
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "/invatare" || c == nil {
		t.Fatalf("callback: %d %s %v", rec.Code, rec.Header().Get("Location"), c)
	}
	if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode {
		t.Errorf("cookie flags: %+v", c)
	}
	var me Identity
	rec = get(h, "/api/me", c)
	_ = json.NewDecoder(rec.Body).Decode(&me)
	if rec.Code != http.StatusOK || me.ID != "acc-u1" || me.Email != "u1@example.test" {
		t.Fatalf("me: %d %+v", rec.Code, me)
	}

	// The same state can't be used twice.
	if rec := get(h, "/auth/callback?code=good:u1&state="+state); rec.Header().Get("Location") != "/autentificare?eroare=1" {
		t.Errorf("replayed state: %s", rec.Header().Get("Location"))
	}

	// Signing out ends the session.
	req := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	req.AddCookie(c)
	out := httptest.NewRecorder()
	h.ServeHTTP(out, req)
	if out.Code != http.StatusOK || sessionCookie(out) == nil || sessionCookie(out).MaxAge >= 0 {
		t.Fatalf("logout: %d %v", out.Code, sessionCookie(out))
	}
	var bye struct {
		EndSessionURL string `json:"endSessionUrl"`
	}
	if err := json.NewDecoder(out.Body).Decode(&bye); err != nil || bye.EndSessionURL != "https://auth.example/end-session/" {
		t.Errorf("logout answer: %+v %v", bye, err)
	}
	if rec := get(h, "/api/me", c); rec.Code != http.StatusUnauthorized {
		t.Errorf("after logout: %d", rec.Code)
	}
}

func TestSignInFailures(t *testing.T) {
	t.Parallel()
	h, _ := newAuthServer(false)
	for name, target := range map[string]func() string{
		"unknown state":  func() string { return "/auth/callback?code=good:u1&state=forged" },
		"service error":  func() string { return "/auth/callback?error=access_denied&state=" + startSignIn(t, h, "") },
		"refused code":   func() string { return "/auth/callback?code=bad&state=" + startSignIn(t, h, "") },
		"no code at all": func() string { return "/auth/callback?state=" + startSignIn(t, h, "") },
	} {
		rec := get(h, target())
		if rec.Header().Get("Location") != "/autentificare?eroare=1" || sessionCookie(rec) != nil {
			t.Errorf("%s: %d %s", name, rec.Code, rec.Header().Get("Location"))
		}
	}
	// The app is sent back to itself with an error.
	rec := get(h, "/auth/callback?error=access_denied&state="+startSignIn(t, h, "platform=app"))
	if rec.Header().Get("Location") != AppReturnURL+"?error=1" {
		t.Errorf("app failure: %s", rec.Header().Get("Location"))
	}
}

func TestReturnToStaysOnTheSite(t *testing.T) {
	t.Parallel()
	for in, want := range map[string]string{
		"/examen": "/examen", "": "/", "https://evil.example": "/", "//evil.example": "/", `/\evil.example`: "/",
	} {
		if got := safeReturn(in); got != want {
			t.Errorf("safeReturn(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAppSignIn(t *testing.T) {
	t.Parallel()
	h, _ := newAuthServer(true)
	state := startSignIn(t, h, "platform=app")
	rec := get(h, "/auth/callback?code=good:u2&state="+state)
	loc, _ := url.Parse(rec.Header().Get("Location"))
	if !strings.HasPrefix(rec.Header().Get("Location"), AppReturnURL+"?code=") || sessionCookie(rec) != nil {
		t.Fatalf("app callback: %s", rec.Header().Get("Location"))
	}
	exchange := func(code string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/auth/app-token", strings.NewReader(`{"code":"`+code+`"}`))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	code := loc.Query().Get("code")
	res := exchange(code)
	var body struct {
		SessionToken string `json:"sessionToken"`
	}
	_ = json.NewDecoder(res.Body).Decode(&body)
	if res.Code != http.StatusOK || body.SessionToken == "" {
		t.Fatalf("app-token: %d", res.Code)
	}
	if again := exchange(code); again.Code != http.StatusUnauthorized {
		t.Errorf("code used twice: %d", again.Code)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set(SessionTokenHeader, body.SessionToken)
	me := httptest.NewRecorder()
	h.ServeHTTP(me, req)
	if me.Code != http.StatusOK || sessionCookie(me) != nil {
		t.Fatalf("me with token: %d", me.Code)
	}
}

func TestMeSignedOut(t *testing.T) {
	t.Parallel()
	h, _ := newAuthServer(false)
	if rec := get(h, "/api/me"); rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if rec := get(h, "/api/me", &http.Cookie{Name: SessionCookie, Value: "forged"}); rec.Code != http.StatusUnauthorized {
		t.Fatalf("forged cookie: %d", rec.Code)
	}
}
