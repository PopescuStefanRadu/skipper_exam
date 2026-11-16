package content

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// ApplySubjectRanges sets the subject of every question covered by a subject
// range. A question covered by ranges with different subjects, for example a
// question shared by two banks, is an error.
func (c *Content) ApplySubjectRanges() error {
	assigned := map[string]string{}
	for _, r := range c.SubjectRanges {
		b := c.Bank(r.Bank)
		if b == nil {
			return fmt.Errorf("subject range %+v: unknown bank", r)
		}
		for _, e := range b.Entries {
			if e.Section != r.Section || e.Number < r.From || e.Number > r.To {
				continue
			}
			if prev, ok := assigned[e.QuestionID]; ok && prev != r.Subject {
				return fmt.Errorf("question %s (bank %s s%d#%d) gets both %s and %s", e.QuestionID, r.Bank, e.Section, e.Number, prev, r.Subject)
			}
			assigned[e.QuestionID] = r.Subject
		}
	}
	for i := range c.Questions {
		if s, ok := assigned[c.Questions[i].ID]; ok {
			c.Questions[i].Subject = s
		}
	}
	return nil
}

// EquivalenceGroups maps every question that has equivalent questions to the ID
// of its group, which is the smallest question ID in the group. Questions are
// equivalent when question and answers match, in the same order and with the same
// correct answer, once diacritics, punctuation and case are ignored.
func (c *Content) EquivalenceGroups() map[string]string {
	byKey := map[string][]string{}
	for _, q := range c.Questions {
		k := foldedKey(q)
		byKey[k] = append(byKey[k], q.ID)
	}
	groups := map[string]string{}
	for _, ids := range byKey {
		if len(ids) < 2 {
			continue
		}
		first := ids[0]
		for _, id := range ids {
			first = min(first, id)
		}
		for _, id := range ids {
			groups[id] = first
		}
	}
	return groups
}

func foldedKey(q Question) string {
	var b strings.Builder
	b.WriteString(fold(q.Text))
	for _, a := range q.Answers {
		fmt.Fprintf(&b, "|%s|%t", fold(a.Text), a.Correct)
	}
	return b.String()
}

var foldWordRE = regexp.MustCompile(`[a-z0-9]+`)

// fold reduces text to lowercase ASCII words: no diacritics, no punctuation.
func fold(s string) string {
	var b strings.Builder
	for _, r := range norm.NFKD.String(strings.ToLower(s)) {
		if !unicode.Is(unicode.Mn, r) {
			b.WriteRune(r)
		}
	}
	return strings.Join(foldWordRE.FindAllString(b.String(), -1), " ")
}
