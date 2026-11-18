package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/account"
)

// Accounts exports and deletes the app's data about an account.
type Accounts interface {
	Export(ctx context.Context, info account.Info) (account.Export, error)
	Delete(ctx context.Context, identityID string, deleteIdentity func(context.Context) error) error
}

// Identities deletes accounts in the account service.
type Identities interface {
	DeleteIdentity(ctx context.Context, id string) error
}

// KratosAdmin talks to Kratos's admin API.
type KratosAdmin struct {
	URL    *url.URL
	Client *http.Client
}

// NewKratosAdmin returns a client for the Kratos admin API at adminURL.
func NewKratosAdmin(adminURL string) (*KratosAdmin, error) {
	u, err := url.Parse(adminURL)
	if err != nil {
		return nil, err
	}
	return &KratosAdmin{URL: u, Client: &http.Client{Timeout: 10 * time.Second}}, nil
}

// DeleteIdentity deletes an account, with its credentials and sessions.
func (k *KratosAdmin) DeleteIdentity(ctx context.Context, id string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, k.URL.JoinPath("admin/identities", id).String(), nil)
	if err != nil {
		return err
	}
	res, err := k.Client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	// Already gone counts as deleted, so a retried deletion finishes.
	if res.StatusCode != http.StatusNoContent && res.StatusCode != http.StatusNotFound {
		return fmt.Errorf("kratos delete identity: status %d", res.StatusCode)
	}
	return nil
}

func exportAccount(accounts Accounts) func(http.ResponseWriter, *http.Request, Identity) {
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		data, err := accounts.Export(r.Context(), account.Info{ID: id.ID, Email: id.Email})
		if err != nil {
			slog.Error("export account", "err", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not export"})
			return
		}
		w.Header().Set("Content-Disposition", `attachment; filename="examen-caa-date.json"`)
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, data)
	}
}

func deleteAccount(accounts Accounts, identities Identities) func(http.ResponseWriter, *http.Request, Identity) {
	return func(w http.ResponseWriter, r *http.Request, id Identity) {
		err := accounts.Delete(r.Context(), id.ID, func(ctx context.Context) error {
			return identities.DeleteIdentity(ctx, id.ID)
		})
		if err != nil {
			slog.Error("delete account", "err", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
