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
	// Library and Reviews serve explanations, reviews and source documents.
	Library *Library
	Reviews Reviews
	// AccountsProxy serves the account service's public API under /.ory.
	AccountsProxy http.Handler
	// Web holds the built web app. If nil, only the API is served.
	Web fs.FS
	// AppOrigins are the origins of installed apps (the Android app's web view),
	// which may call the API and the account service from another origin.
	AppOrigins []string
}

// New returns the backend's HTTP handler.
func New(cfg Config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", health(cfg.DB))
	mux.HandleFunc("GET /api/me", me(cfg.Sessions, cfg.Reviews))
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
	if cfg.Library != nil && cfg.Reviews != nil {
		mux.HandleFunc("GET /api/explanations", withIdentity(cfg.Sessions, listExplanations(cfg.Library, cfg.Reviews)))
		mux.HandleFunc("POST /api/reviews", withIdentity(cfg.Sessions, postReview(cfg.Library, cfg.Reviews)))
		mux.HandleFunc("GET /api/sources/{id}", sourceDocument(cfg.Library))
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
	return cors(cfg.AppOrigins, mux)
}

// cors lets the installed apps call the API and the account service. They
// authenticate with a session token header, never with cookies, so credentials
// are not allowed across origins.
func cors(origins []string, next http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range origins {
		allowed[o] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		w.Header().Add("Vary", "Origin")
		if !allowed[origin] {
			next.ServeHTTP(w, r)
			return
		}
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Access-Control-Expose-Headers", "ETag")
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
			h.Set("Access-Control-Allow-Headers", "Accept, Content-Type, If-None-Match, "+SessionTokenHeader)
			h.Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		// The app's web view adds Origin like a browser page would, but the app uses
		// Kratos's flows for native apps, which refuse requests that look like a
		// browser's. Past this check the request is the app's, so Origin goes.
		r.Header.Del("Origin")
		next.ServeHTTP(w, r)
	})
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
