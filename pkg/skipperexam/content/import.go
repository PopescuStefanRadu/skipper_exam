package content

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// Imported is one question as read from a new version of a bank's source.
type Imported struct {
	Section int
	Number  int
	Text    string
	Answers []Answer
	Issues  []string
}

// Report describes what an import changed. Entries are "<question id> s<section>#<number>".
type Report struct {
	Bank      string
	Unchanged int
	// Shared are questions that already existed in the pool through another bank.
	Shared  []string
	New     []string
	Changed []string
	Removed []string
}

// minChangedSimilarity is how similar a question must be to a previous one to
// count as the same question, changed, rather than a new one.
const minChangedSimilarity = 0.8

// ImportBank replaces the entries of bank bankID with the imported questions and
// updates the pool, keeping question identities stable:
//   - a question identical to a pool question gets that question's ID;
//   - otherwise, a question very similar to one of the bank's previous questions
//     keeps that question's ID, and the question is updated (its revision goes up),
//     unless another bank also uses it;
//   - anything else becomes a new pool question.
//
// Pool questions are never deleted, so history that refers to them stays valid.
func (c *Content) ImportBank(bankID, sourceID string, imported []Imported) Report {
	report := Report{Bank: bankID}

	byKey := map[string]string{}
	for _, q := range c.Questions {
		byKey[key(q.Text, q.Answers)] = q.ID
	}
	var previous []string
	if b := c.Bank(bankID); b != nil {
		for _, e := range b.Entries {
			previous = append(previous, e.QuestionID)
		}
	}
	usedElsewhere := map[string]bool{}
	for _, b := range c.Banks {
		if b.ID == bankID {
			continue
		}
		for _, e := range b.Entries {
			usedElsewhere[e.QuestionID] = true
		}
	}

	matched := map[string]bool{}
	var unmatched []int
	ids := make([]string, len(imported))
	for i, q := range imported {
		id, ok := byKey[key(q.Text, q.Answers)]
		if !ok || matched[id] {
			unmatched = append(unmatched, i)
			continue
		}
		ids[i] = id
		matched[id] = true
		c.Question(id).Issues = q.Issues
		if contains(previous, id) {
			report.Unchanged++
		} else {
			report.Shared = append(report.Shared, label(id, q))
		}
	}

	for _, i := range unmatched {
		q := imported[i]
		best, bestScore := "", 0.0
		for _, id := range previous {
			if matched[id] || usedElsewhere[id] {
				continue
			}
			old := c.Question(id)
			if s := similarity(q.Text, q.Answers, old.Text, old.Answers); s > bestScore {
				best, bestScore = id, s
			}
		}
		if bestScore >= minChangedSimilarity {
			old := c.Question(best)
			old.Text, old.Answers, old.Issues = q.Text, q.Answers, q.Issues
			old.Revision++
			ids[i] = best
			matched[best] = true
			report.Changed = append(report.Changed, label(best, q))
			continue
		}
		id := c.nextQuestionID()
		c.Questions = append(c.Questions, Question{ID: id, Text: q.Text, Answers: q.Answers, Revision: 1, Issues: q.Issues})
		byKey[key(q.Text, q.Answers)] = id
		ids[i] = id
		matched[id] = true
		report.New = append(report.New, label(id, q))
	}

	for _, id := range previous {
		if !matched[id] {
			report.Removed = append(report.Removed, id)
		}
	}

	bank := Bank{ID: bankID, Source: sourceID}
	for i, q := range imported {
		bank.Entries = append(bank.Entries, BankEntry{Section: q.Section, Number: q.Number, QuestionID: ids[i]})
		bank.Sections = max(bank.Sections, q.Section)
	}
	if b := c.Bank(bankID); b != nil {
		*b = bank
	} else {
		c.Banks = append(c.Banks, bank)
		sort.Slice(c.Banks, func(i, j int) bool { return c.Banks[i].ID < c.Banks[j].ID })
	}
	return report
}

func (c *Content) nextQuestionID() string {
	n := 0
	for _, q := range c.Questions {
		var v int
		if _, err := fmt.Sscanf(q.ID, "q%d", &v); err == nil && v > n {
			n = v
		}
	}
	return fmt.Sprintf("q%04d", n+1)
}

func label(id string, q Imported) string {
	return fmt.Sprintf("%s s%d#%d", id, q.Section, q.Number)
}

func contains(ids []string, id string) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}

// key identifies a question by its exact wording, answers and correct answer.
func key(text string, answers []Answer) string {
	var b strings.Builder
	b.WriteString(text)
	for _, a := range answers {
		fmt.Fprintf(&b, "\x00%s\x00%t", a.Text, a.Correct)
	}
	return b.String()
}

var wordRE = regexp.MustCompile(`[\p{L}\p{N}]+`)

// similarity is the share of words two questions have in common (Jaccard index
// over the words of the question and its answers), 0 if the correct answer moved.
func similarity(textA string, answersA []Answer, textB string, answersB []Answer) float64 {
	if correctIndex(answersA) != correctIndex(answersB) {
		return 0
	}
	a, b := words(textA, answersA), words(textB, answersB)
	inter := 0
	for w := range a {
		if b[w] {
			inter++
		}
	}
	union := len(a) + len(b) - inter
	if union == 0 {
		return 1
	}
	return float64(inter) / float64(union)
}

func correctIndex(answers []Answer) int {
	for i, a := range answers {
		if a.Correct {
			return i
		}
	}
	return -1
}

func words(text string, answers []Answer) map[string]bool {
	all := text
	for _, a := range answers {
		all += " " + a.Text
	}
	set := map[string]bool{}
	for _, w := range wordRE.FindAllString(strings.ToLower(all), -1) {
		set[w] = true
	}
	return set
}
