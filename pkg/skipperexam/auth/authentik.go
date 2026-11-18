package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// Authentik deletes users from esrp.ro's sign-in service through its API, when
// their account there exists only for this app.
type Authentik struct {
	// URL is the service's address, e.g. https://auth.esrp.ro.
	URL *url.URL
	// Token is an API token allowed to view and delete users.
	Token string
	// AppGroup is the group this app's sign-ups are put in, e.g. skipper-exam.
	AppGroup string
	Client   *http.Client
}

// NewAuthentik returns a client for the Authentik API at baseURL.
func NewAuthentik(baseURL, token, appGroup string) (*Authentik, error) {
	u, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}
	return &Authentik{URL: u, Token: token, AppGroup: appGroup, Client: &http.Client{Timeout: 10 * time.Second}}, nil
}

type authentikUser struct {
	PK          int  `json:"pk"`
	IsSuperuser bool `json:"is_superuser"`
	Groups      []struct {
		Name string `json:"name"`
	} `json:"groups_obj"`
}

// DeleteIfAppOnly deletes the user with the given subject (Authentik's user UUID)
// if they belong to the app's group and to no other group, and aren't an
// administrator. Shared esrp.ro accounts are left alone. A user that no longer
// exists counts as deleted.
func (a *Authentik) DeleteIfAppOnly(ctx context.Context, subject string) error {
	q := url.Values{"uuid": {subject}, "include_groups": {"true"}}
	var page struct {
		Results []authentikUser `json:"results"`
	}
	if err := a.do(ctx, http.MethodGet, "api/v3/core/users/", q, &page); err != nil {
		return err
	}
	if len(page.Results) == 0 {
		return nil
	}
	u := page.Results[0]
	inApp, other := false, false
	for _, g := range u.Groups {
		if g.Name == a.AppGroup {
			inApp = true
		} else {
			other = true
		}
	}
	if !inApp || other || u.IsSuperuser {
		slog.Info("account deleted; its esrp.ro account is shared and stays", "subject", subject)
		return nil
	}
	return a.do(ctx, http.MethodDelete, "api/v3/core/users/"+strconv.Itoa(u.PK)+"/", nil, nil)
}

func (a *Authentik) do(ctx context.Context, method, path string, q url.Values, out any) error {
	u := a.URL.JoinPath(path)
	u.RawQuery = q.Encode()
	req, err := http.NewRequestWithContext(ctx, method, u.String(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+a.Token)
	req.Header.Set("Accept", "application/json")
	res, err := a.Client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	switch {
	case method == http.MethodDelete && (res.StatusCode == http.StatusNoContent || res.StatusCode == http.StatusNotFound):
		return nil
	case res.StatusCode != http.StatusOK:
		return fmt.Errorf("authentik %s %s: status %d", method, path, res.StatusCode)
	}
	if out != nil {
		return json.NewDecoder(res.Body).Decode(out)
	}
	return nil
}
