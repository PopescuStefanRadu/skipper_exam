package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

// Accounts are managed by Ory Kratos. Its public API is served on the app's own
// origin under kratosPrefix, so sign-in cookies belong to the app's origin.
const kratosPrefix = "/.ory"

// Identity is the signed-in account.
type Identity struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	// Roles is filled in by /api/me only.
	Roles []string `json:"roles"`
}

// ErrNoSession means the request has no valid session.
var ErrNoSession = errors.New("no valid session")

// Sessions resolves the account a request belongs to.
type Sessions interface {
	Identity(ctx context.Context, r *http.Request) (Identity, error)
}

// Kratos talks to Kratos's public API.
type Kratos struct {
	PublicURL *url.URL
	Client    *http.Client
}

// NewKratos returns a client for the Kratos public API at publicURL.
func NewKratos(publicURL string) (*Kratos, error) {
	u, err := url.Parse(publicURL)
	if err != nil {
		return nil, err
	}
	return &Kratos{PublicURL: u, Client: &http.Client{Timeout: 5 * time.Second}}, nil
}

// Identity asks Kratos who the session cookie in r belongs to.
func (k *Kratos) Identity(ctx context.Context, r *http.Request) (Identity, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, k.PublicURL.JoinPath("sessions/whoami").String(), nil)
	if err != nil {
		return Identity{}, err
	}
	req.Header.Set("Cookie", r.Header.Get("Cookie"))
	req.Header.Set("Accept", "application/json")
	res, err := k.Client.Do(req)
	if err != nil {
		return Identity{}, err
	}
	defer res.Body.Close()
	switch res.StatusCode {
	case http.StatusOK:
	case http.StatusUnauthorized, http.StatusForbidden:
		return Identity{}, ErrNoSession
	default:
		return Identity{}, fmt.Errorf("kratos whoami: status %d", res.StatusCode)
	}
	var session struct {
		Identity struct {
			ID     string `json:"id"`
			Traits struct {
				Email string `json:"email"`
			} `json:"traits"`
		} `json:"identity"`
	}
	if err := json.NewDecoder(res.Body).Decode(&session); err != nil {
		return Identity{}, err
	}
	return Identity{ID: session.Identity.ID, Email: session.Identity.Traits.Email}, nil
}

// Proxy forwards requests under kratosPrefix to Kratos's public API.
func (k *Kratos) Proxy() http.Handler {
	p := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(k.PublicURL)
			pr.Out.URL.Path = strings.TrimPrefix(pr.In.URL.Path, kratosPrefix)
			pr.Out.URL.RawPath = ""
			// Kratos builds its URLs from its configured base URL, not the request.
			pr.Out.Host = k.PublicURL.Host
		},
	}
	return p
}

func me(sessions Sessions, reviews Reviews) http.HandlerFunc {
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
		writeJSON(w, http.StatusOK, id)
	})
}
