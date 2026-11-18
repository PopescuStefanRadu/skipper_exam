package server

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/account"
)

// Accounts exports and deletes the app's data about an account.
type Accounts interface {
	Export(ctx context.Context, info account.Info) (account.Export, error)
	Delete(ctx context.Context, identityID string, deleteIdentity func(context.Context) error) error
}

// Identities deletes users from the sign-in service, where their account there
// exists only for this app (auth.Authentik).
type Identities interface {
	DeleteIfAppOnly(ctx context.Context, subject string) error
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
			if identities == nil {
				return nil
			}
			return identities.DeleteIfAppOnly(ctx, id.Subject)
		})
		if err != nil {
			slog.Error("delete account", "err", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not delete"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
