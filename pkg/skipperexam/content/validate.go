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

	subjects := map[string]bool{}
	for _, s := range c.Subjects {
		if subjects[s.ID] {
			errorf("subject %s: duplicate ID", s.ID)
		}
		subjects[s.ID] = true
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
		if !subjects[q.Subject] {
			errorf("question %s: unknown or missing subject %q", q.ID, q.Subject)
		}
		for _, issue := range q.Issues {
			warnf("question %s: %s", q.ID, issue)
		}
	}

	groups := c.EquivalenceGroups()
	for id, group := range groups {
		if a, b := c.Question(id), c.Question(group); a.Subject != b.Subject {
			errorf("question %s: subject %s differs from equivalent question %s (%s)", id, a.Subject, group, b.Subject)
		}
	}

	ps = append(ps, validateSubjectRanges(c, subjects)...)
	ps = append(ps, validateExamTypes(c, subjects)...)

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

// validateSubjectRanges checks that the ranges refer to known banks and subjects,
// don't overlap, and cover every bank entry, so re-applying them always gives
// the same tags.
func validateSubjectRanges(c *Content, subjects map[string]bool) []Problem {
	var ps []Problem
	errorf := func(format string, args ...any) {
		ps = append(ps, Problem{Error: true, Message: fmt.Sprintf(format, args...)})
	}
	for i, r := range c.SubjectRanges {
		if c.Bank(r.Bank) == nil {
			errorf("subject range %d: unknown bank %s", i+1, r.Bank)
		}
		if !subjects[r.Subject] {
			errorf("subject range %d: unknown subject %s", i+1, r.Subject)
		}
		if r.From > r.To {
			errorf("subject range %d: from %d is after to %d", i+1, r.From, r.To)
		}
		for j, o := range c.SubjectRanges[:i] {
			if o.Bank == r.Bank && o.Section == r.Section && r.From <= o.To && o.From <= r.To {
				errorf("subject ranges %d and %d overlap", j+1, i+1)
			}
		}
	}
	for _, b := range c.Banks {
		for _, e := range b.Entries {
			covered := false
			for _, r := range c.SubjectRanges {
				if r.Bank == b.ID && r.Section == e.Section && e.Number >= r.From && e.Number <= r.To {
					covered = true
					break
				}
			}
			if !covered {
				errorf("bank %s s%d#%d: not covered by any subject range", b.ID, e.Section, e.Number)
			}
		}
	}
	return ps
}

// validateExamTypes checks that every available exam type draws from a known bank
// and known subjects, and that there are enough questions for one exam.
func validateExamTypes(c *Content, subjects map[string]bool) []Problem {
	var ps []Problem
	errorf := func(format string, args ...any) {
		ps = append(ps, Problem{Error: true, Message: fmt.Sprintf(format, args...)})
	}
	seen := map[string]bool{}
	for _, t := range c.ExamTypes {
		if seen[t.ID] {
			errorf("exam type %s: duplicate ID", t.ID)
		}
		seen[t.ID] = true
		if t.Name == "" {
			errorf("exam type %s: no name", t.ID)
		}
		if !t.Available {
			continue
		}
		if c.Bank(t.Bank) == nil {
			errorf("exam type %s: unknown bank %q", t.ID, t.Bank)
			continue
		}
		for _, s := range t.Subjects {
			if !subjects[s] {
				errorf("exam type %s: unknown subject %s", t.ID, s)
			}
		}
		if t.Format == nil || t.Format.Questions <= 0 || t.Format.Minutes <= 0 || t.Format.PassPercent <= 0 || t.Format.PassPercent > 100 {
			errorf("exam type %s: missing or invalid format", t.ID)
			continue
		}
		if n := c.ExamGroupCount(t); n < t.Format.Questions {
			errorf("exam type %s: %d distinct questions available, the format needs %d", t.ID, n, t.Format.Questions)
		}
	}
	return ps
}
