package content

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
)

// Problem is one finding of Validate.
type Problem struct {
	// Error problems make the content unusable; warnings are reported only.
	Error   bool
	Message string
}

func (p Problem) String() string {
	if p.Error {
		return "error: " + p.Message
	}
	return "warning: " + p.Message
}

// Validate checks the content stored in dir. It returns every problem found.
func Validate(c *Content, dir string) []Problem {
	var ps []Problem
	errorf := func(format string, args ...any) {
		ps = append(ps, Problem{Error: true, Message: fmt.Sprintf(format, args...)})
	}
	warnf := func(format string, args ...any) {
		ps = append(ps, Problem{Message: fmt.Sprintf(format, args...)})
	}

	for _, s := range c.Sources {
		data, err := os.ReadFile(filepath.Join(dir, s.File))
		if err != nil {
			errorf("source %s: %v", s.ID, err)
			continue
		}
		sum := sha256.Sum256(data)
		if got := hex.EncodeToString(sum[:]); got != s.SHA256 {
			errorf("source %s: file %s has sha256 %s, recorded %s", s.ID, s.File, got, s.SHA256)
		}
	}

	seen := map[string]bool{}
	for _, q := range c.Questions {
		if seen[q.ID] {
			errorf("question %s: duplicate ID", q.ID)
		}
		seen[q.ID] = true
		if q.Text == "" {
			errorf("question %s: empty text", q.ID)
		}
		if len(q.Answers) != 3 {
			errorf("question %s: %d answers, want 3", q.ID, len(q.Answers))
		}
		correct := 0
		for i, a := range q.Answers {
			if a.Text == "" {
				errorf("question %s: answer %d is empty", q.ID, i+1)
			}
			if a.Correct {
				correct++
			}
		}
		if correct != 1 {
			errorf("question %s: %d correct answers, want exactly 1", q.ID, correct)
		}
		for _, issue := range q.Issues {
			warnf("question %s: %s", q.ID, issue)
		}
	}

	for _, b := range c.Banks {
		if c.Source(b.Source) == nil {
			errorf("bank %s: unknown source %s", b.ID, b.Source)
		}
		last := map[int]int{}
		for _, e := range b.Entries {
			if !seen[e.QuestionID] {
				errorf("bank %s s%d#%d: unknown question %s", b.ID, e.Section, e.Number, e.QuestionID)
			}
			prev, ok := last[e.Section]
			switch {
			case e.Number <= prev:
				errorf("bank %s section %d: number %d after %d", b.ID, e.Section, e.Number, prev)
			case !ok && e.Number != 1:
				warnf("bank %s section %d: starts at %d", b.ID, e.Section, e.Number)
			case ok && e.Number == prev+2:
				warnf("bank %s section %d: number %d is missing", b.ID, e.Section, prev+1)
			case ok && e.Number > prev+2:
				warnf("bank %s section %d: numbers %d-%d are missing", b.ID, e.Section, prev+1, e.Number-1)
			}
			last[e.Section] = e.Number
		}
	}
	return ps
}
