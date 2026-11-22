package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/auth"
)

// SessionCookie holds the website's session token.
const SessionCookie = "skipper_session"

// SessionTokenHeader carries the session token of the Android app, which can't
// share the website's cookies.
const SessionTokenHeader = "X-Session-Token"

// AppReturnURL is where the sign-in sends the Android app back, with a one-time code.
const AppReturnURL = "ro.skipperexam.app://auth"

// Identity is the signed-in account.
type Identity struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	// Roles is filled in by /api/me only.
	Roles []string `json:"roles"`
	// Subject is the sign-in service's user ID.
	Subject string `json:"-"`
}

// ErrNoSession means the request has no valid session.
var ErrNoSession = errors.New("no valid session")

// Sessions resolves the account a request belongs to.
type Sessions interface {
	Identity(ctx context.Context, r *http.Request) (Identity, error)
}

// AuthStore keeps accounts, sessions and sign-ins in progress (auth.Store).
type AuthStore interface {
	SaveLoginRequest(ctx context.Context, r auth.LoginRequest) error
	TakeLoginRequest(ctx context.Context, state string) (auth.LoginRequest, error)
	SignedIn(ctx context.Context, subject, email string) (auth.Account, error)
	NewSession(ctx context.Context, accountID string) (string, error)
	SessionAccount(ctx context.Context, token string) (auth.Account, error)
	DeleteSession(ctx context.Context, token string) error
	NewAppCode(ctx context.Context, accountID string) (string, error)
	TakeAppCode(ctx context.Context, code string) (string, error)
}

// SignInService is the OpenID Connect provider users sign in at (auth.Provider).
type SignInService interface {
	AuthURL(ctx context.Context, state, nonce, verifier string) (string, error)
	Exchange(ctx context.Context, code, verifier, nonce string) (auth.Claims, error)
	// EndSessionURL is where the browser ends its session at the service, or "".
	EndSessionURL(ctx context.Context) (string, error)
}

// Auth signs users in and resolves their sessions.
type Auth struct {
	Store   AuthStore
	Service SignInService
	// SecureCookies is set when the app is served over HTTPS.
	SecureCookies bool
}

// sessionToken is the request's session token: the app's header or the website's cookie.
func sessionToken(r *http.Request) string {
	if t := r.Header.Get(SessionTokenHeader); t != "" {
		return t
	}
	if c, err := r.Cookie(SessionCookie); err == nil {
		return c.Value
	}
	return ""
}

// Identity returns the account of the request's session.
func (a *Auth) Identity(ctx context.Context, r *http.Request) (Identity, error) {
	token := sessionToken(r)
	if token == "" {
		return Identity{}, ErrNoSession
	}
	acc, err := a.Store.SessionAccount(ctx, token)
	if errors.Is(err, auth.ErrNotFound) {
		return Identity{}, ErrNoSession
	}
	if err != nil {
		return Identity{}, err
	}
	return Identity{ID: acc.ID, Email: acc.Email, Subject: acc.Subject}, nil
}

func (a *Auth) setCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name: SessionCookie, Value: token, Path: "/", HttpOnly: true, Secure: a.SecureCookies,
		SameSite: http.SameSiteLaxMode, MaxAge: int(auth.SessionLifetime.Seconds()),
	})
}

func (a *Auth) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: SessionCookie, Path: "/", HttpOnly: true, Secure: a.SecureCookies,
		SameSite: http.SameSiteLaxMode, MaxAge: -1})
}

// safeReturn keeps only paths on the app's own site.
func safeReturn(p string) string {
	if !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") || strings.Contains(p, `\`) {
		return "/"
	}
	return p
}

// login starts a sign-in: GET /auth/login?platform=web|app&return_to=/path.
func (a *Auth) login(w http.ResponseWriter, r *http.Request) {
	req := auth.LoginRequest{
		State:    auth.RandomToken(),
		Nonce:    auth.RandomToken(),
		Verifier: auth.RandomToken() + auth.RandomToken(),
		Platform: "web",
		ReturnTo: safeReturn(r.URL.Query().Get("return_to")),
	}
	if r.URL.Query().Get("platform") == "app" {
		req.Platform = "app"
	}
	target, err := a.Service.AuthURL(r.Context(), req.State, req.Nonce, req.Verifier)
	if err == nil {
		err = a.Store.SaveLoginRequest(r.Context(), req)
	}
	if err != nil {
		slog.Error("start sign-in", "err", err)
		a.fail(w, r, req.Platform)
		return
	}
	http.Redirect(w, r, target, http.StatusFound)
}

// callback finishes a sign-in: the sign-in service sends the browser back here
// with a code (or an error) and the state the sign-in started with.
func (a *Auth) callback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	req, err := a.Store.TakeLoginRequest(r.Context(), q.Get("state"))
	if err != nil {
		if !errors.Is(err, auth.ErrNotFound) {
			slog.Error("sign-in callback", "err", err)
		}
		a.fail(w, r, "web")
		return
	}
	if q.Get("error") != "" || q.Get("code") == "" {
		a.fail(w, r, req.Platform)
		return
	}
	claims, err := a.Service.Exchange(r.Context(), q.Get("code"), req.Verifier, req.Nonce)
	if err != nil {
		slog.Warn("sign-in refused", "err", err)
		a.fail(w, r, req.Platform)
		return
	}
	acc, err := a.Store.SignedIn(r.Context(), claims.Subject, claims.Email)
	if err != nil {
		slog.Error("sign-in account", "err", err)
		a.fail(w, r, req.Platform)
		return
	}
	if req.Platform == "app" {
		code, err := a.Store.NewAppCode(r.Context(), acc.ID)
		if err != nil {
			slog.Error("sign-in app code", "err", err)
			a.fail(w, r, req.Platform)
			return
		}
		http.Redirect(w, r, AppReturnURL+"?code="+url.QueryEscape(code), http.StatusFound)
		return
	}
	token, err := a.Store.NewSession(r.Context(), acc.ID)
	if err != nil {
		slog.Error("sign-in session", "err", err)
		a.fail(w, r, req.Platform)
		return
	}
	a.setCookie(w, token)
	http.Redirect(w, r, req.ReturnTo, http.StatusFound)
}

func (a *Auth) fail(w http.ResponseWriter, r *http.Request, platform string) {
	if platform == "app" {
		http.Redirect(w, r, AppReturnURL+"?error=1", http.StatusFound)
		return
	}
	http.Redirect(w, r, "/autentificare?eroare=1", http.StatusFound)
}

// appToken trades the Android app's one-time code for a session token:
// POST /auth/app-token {"code": "..."} → {"sessionToken": "..."}.
func (a *Auth) appToken(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil || body.Code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "code required"})
		return
	}
	id, err := a.Store.TakeAppCode(r.Context(), body.Code)
	if errors.Is(err, auth.ErrNotFound) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid code"})
		return
	}
	var token string
	if err == nil {
		token, err = a.Store.NewSession(r.Context(), id)
	}
	if err != nil {
		slog.Error("app token", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not sign in"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"sessionToken": token})
}

// logout ends the request's session: POST /auth/logout. It answers with the sign-in
// service's sign-out page, where the device goes next to end the esrp.ro session
// too; it's empty when the service has none or can't be reached.
func (a *Auth) logout(w http.ResponseWriter, r *http.Request) {
	if token := sessionToken(r); token != "" {
		if err := a.Store.DeleteSession(r.Context(), token); err != nil {
			slog.Error("sign out", "err", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not sign out"})
			return
		}
	}
	a.clearCookie(w)
	endSession, err := a.Service.EndSessionURL(r.Context())
	if err != nil {
		slog.Warn("sign out: no sign-out page from the sign-in service", "err", err)
	}
	writeJSON(w, http.StatusOK, map[string]string{"endSessionUrl": endSession})
}

func me(sessions Sessions, reviews Reviews, a *Auth) http.HandlerFunc {
	return withIdentity(sessions, func(w http.ResponseWriter, r *http.Request, id Identity) {
		id.Roles = []string{}
		if reviews != nil {
			roles, err := reviews.Roles(r.Context(), id.ID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not read roles"})
				return
			}
			id.Roles = roles
		}
		// The website checks the session at every start: renewing the cookie then
		// keeps it alive as long as the session is used.
		if c, err := r.Cookie(SessionCookie); err == nil && a != nil && r.Header.Get(SessionTokenHeader) == "" {
			a.setCookie(w, c.Value)
		}
		writeJSON(w, http.StatusOK, id)
	})
}
