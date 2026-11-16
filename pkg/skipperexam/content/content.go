// Package content holds the app's content: the question pool, the question banks
// that refer to it, and the source documents they come from. It is stored as JSON
// files under content/ (see docs/app/features/content.md).
package content

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
)

// Source is one source document, such as an RNA question-list PDF.
type Source struct {
	ID string `json:"id"`
	// File is the path of the stored copy, relative to the content directory.
	File   string `json:"file"`
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
	// LastModified is the date the publisher reports for the document.
	LastModified string `json:"lastModified,omitempty"`
	RetrievedAt  string `json:"retrievedAt"`
}

// Question is one question of the shared pool.
type Question struct {
	ID       string   `json:"id"`
	Text     string   `json:"text"`
	Answers  []Answer `json:"answers"`
	Revision int      `json:"revision"`
	// Issues lists defects of the source, such as a missing correct flag.
	Issues []string `json:"issues,omitempty"`
}

// Answer is one answer option.
type Answer struct {
	Text    string `json:"text"`
	Correct bool   `json:"correct"`
}

// Bank is one RNA question list: which pool questions it contains, in order.
type Bank struct {
	ID       string      `json:"id"`
	Source   string      `json:"source"`
	Entries  []BankEntry `json:"entries"`
	Sections int         `json:"sections"`
}

// BankEntry places a pool question in a bank, under its RNA section and number.
type BankEntry struct {
	Section    int    `json:"section"`
	Number     int    `json:"number"`
	QuestionID string `json:"questionId"`
}

// Content is everything under the content directory.
type Content struct {
	Sources   []Source   `json:"-"`
	Questions []Question `json:"-"`
	Banks     []Bank     `json:"-"`
}

const (
	sourcesFile = "sources.json"
	poolFile    = "questions.json"
	banksDir    = "banks"
)

// Load reads the content directory. Missing files mean empty content.
func Load(dir string) (*Content, error) {
	c := &Content{}
	if err := readJSON(filepath.Join(dir, sourcesFile), &c.Sources); err != nil {
		return nil, err
	}
	if err := readJSON(filepath.Join(dir, poolFile), &c.Questions); err != nil {
		return nil, err
	}
	files, err := filepath.Glob(filepath.Join(dir, banksDir, "*.json"))
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	for _, f := range files {
		var b Bank
		if err := readJSON(f, &b); err != nil {
			return nil, err
		}
		c.Banks = append(c.Banks, b)
	}
	return c, nil
}

// Save writes the content directory.
func (c *Content) Save(dir string) error {
	if err := writeJSON(filepath.Join(dir, sourcesFile), c.Sources); err != nil {
		return err
	}
	if err := writeJSON(filepath.Join(dir, poolFile), c.Questions); err != nil {
		return err
	}
	for _, b := range c.Banks {
		if err := writeJSON(filepath.Join(dir, banksDir, b.ID+".json"), b); err != nil {
			return err
		}
	}
	return nil
}

// Source returns the source with the given ID, or nil.
func (c *Content) Source(id string) *Source {
	for i := range c.Sources {
		if c.Sources[i].ID == id {
			return &c.Sources[i]
		}
	}
	return nil
}

// Bank returns the bank with the given ID, or nil.
func (c *Content) Bank(id string) *Bank {
	for i := range c.Banks {
		if c.Banks[i].ID == id {
			return &c.Banks[i]
		}
	}
	return nil
}

// Question returns the pool question with the given ID, or nil.
func (c *Content) Question(id string) *Question {
	for i := range c.Questions {
		if c.Questions[i].ID == id {
			return &c.Questions[i]
		}
	}
	return nil
}

func readJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return nil
}

func writeJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}
