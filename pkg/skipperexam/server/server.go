// Package server holds the backend's HTTP handlers.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
)

// Pinger reports whether a dependency, such as the database, is reachable.
type Pinger interface {
	Ping(ctx context.Context) error
}

// Config holds the server's dependencies.
type Config struct {
	DB        Pinger
	Sessions  Sessions
	Profiles  Profiles
	Events    Events
	ExamTypes []content.ExamType
	// Content is the content package the apps download.
	Content *content.Package
	// AccountsProxy serves the account service's public API under /.ory.
	AccountsProxy http.Handler
	// Web holds the built web app. If nil, only the API is served.
	Web fs.FS
}

// New returns the backend's HTTP handler.
func New(cfg Config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", health(cfg.DB))
	mux.HandleFunc("GET /api/me", me(cfg.Sessions))
	mux.HandleFunc("GET /api/exam-types", examTypes(cfg.ExamTypes))
	mux.HandleFunc("GET /api/profile", withIdentity(cfg.Sessions, getProfile(cfg.Profiles)))
	mux.HandleFunc("PUT /api/profile", withIdentity(cfg.Sessions, putProfile(cfg.Profiles, cfg.ExamTypes)))
	if cfg.Content != nil {
		mux.HandleFunc("GET /api/content", contentPackage(cfg.Content))
	}
	if cfg.Events != nil {
		mux.HandleFunc("GET /api/events", withIdentity(cfg.Sessions, listEvents(cfg.Events)))
		mux.HandleFunc("POST /api/events", withIdentity(cfg.Sessions, postEvents(cfg.Events)))
	}
	if cfg.AccountsProxy != nil {
		mux.Handle(kratosPrefix+"/", cfg.AccountsProxy)
	}
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	})
	if cfg.Web != nil {
		mux.Handle("/", spa(cfg.Web))
	}
	return mux
}

type healthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
}

func health(db Pinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, healthResponse{Status: "degraded", Database: "unavailable"})
			return
		}
		writeJSON(w, http.StatusOK, healthResponse{Status: "ok", Database: "ok"})
	}
}

// spa serves the web app's files, and index.html for any other path so client-side routes work.
func spa(web fs.FS) http.Handler {
	files := http.FileServerFS(web)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name != "" {
			if _, err := fs.Stat(web, name); err == nil {
				files.ServeHTTP(w, r)
				return
			} else if !errors.Is(err, os.ErrNotExist) {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFileFS(w, r, web, "index.html")
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
