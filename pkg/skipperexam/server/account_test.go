package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/account"
)

type fakeAccounts struct {
	deleted []string
}

func (f *fakeAccounts) Export(_ context.Context, info account.Info) (account.Export, error) {
	return account.Export{Account: info, Roles: []string{}}, nil
}

func (f *fakeAccounts) Delete(ctx context.Context, id string, deleteIdentity func(context.Context) error) error {
	if err := deleteIdentity(ctx); err != nil {
		return err
	}
	f.deleted = append(f.deleted, id)
	return nil
}

type fakeIdentities struct{ err error }

func (f fakeIdentities) DeleteIfAppOnly(context.Context, string) error { return f.err }

func TestAccountExportAndDelete(t *testing.T) {
	t.Parallel()
	do := func(h http.Handler, method, path string, signedIn bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, nil)
		if signedIn {
			req.AddCookie(&http.Cookie{Name: "session", Value: "valid"})
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	accounts := &fakeAccounts{}
	h := New(Config{DB: fakeDB{}, Sessions: fakeSessions{}, Accounts: accounts, Identities: fakeIdentities{}})

	rec := do(h, http.MethodGet, "/api/account/export", true)
	var got account.Export
	_ = json.NewDecoder(rec.Body).Decode(&got)
	if rec.Code != http.StatusOK || got.Account.Email != "a@example.test" || rec.Header().Get("Content-Disposition") == "" {
		t.Fatalf("export: %d %+v", rec.Code, got)
	}
	if rec := do(h, http.MethodDelete, "/api/account", false); rec.Code != http.StatusUnauthorized {
		t.Errorf("signed-out delete: %d", rec.Code)
	}
	if rec := do(h, http.MethodDelete, "/api/account", true); rec.Code != http.StatusNoContent || len(accounts.deleted) != 1 {
		t.Errorf("delete: %d, deleted %v", rec.Code, accounts.deleted)
	}

	failing := &fakeAccounts{}
	h = New(Config{DB: fakeDB{}, Sessions: fakeSessions{}, Accounts: failing, Identities: fakeIdentities{err: errors.New("down")}})
	if rec := do(h, http.MethodDelete, "/api/account", true); rec.Code != http.StatusInternalServerError || len(failing.deleted) != 0 {
		t.Errorf("delete with account service down: %d, deleted %v", rec.Code, failing.deleted)
	}
}
