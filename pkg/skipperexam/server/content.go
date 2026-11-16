package server

import (
	"encoding/json"
	"net/http"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
)

// contentPackage serves the content package. It's public material (the RNA
// lists), and its version is its ETag, so devices download it only when it changed.
func contentPackage(p *content.Package) http.HandlerFunc {
	data, err := json.Marshal(p)
	if err != nil {
		panic(err)
	}
	etag := `"` + p.Version + `"`
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("ETag", etag)
		w.Header().Set("Cache-Control", "no-cache")
		if r.Header.Get("If-None-Match") == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(data)
	}
}
