package content

import (
	"strings"
	"testing"
)

func TestValidateFindsProblems(t *testing.T) {
	t.Parallel()
	c := &Content{
		Questions: []Question{
			{ID: "q0001", Text: "ok", Answers: []Answer{{Text: "a", Correct: true}, {Text: "b"}, {Text: "c"}}},
			{ID: "q0002", Text: "two correct", Answers: []Answer{{Text: "a", Correct: true}, {Text: "b", Correct: true}, {Text: "c"}}},
			{ID: "q0003", Text: "", Answers: []Answer{{Text: "a", Correct: true}, {Text: ""}}},
		},
		Banks: []Bank{{ID: "C", Source: "missing", Entries: []BankEntry{
			{Section: 1, Number: 1, QuestionID: "q0001"},
			{Section: 1, Number: 4, QuestionID: "q0002"},
			{Section: 1, Number: 2, QuestionID: "q9999"},
		}}},
	}
	var errs, warns []string
	for _, p := range Validate(c, t.TempDir()) {
		if p.Error {
			errs = append(errs, p.Message)
		} else {
			warns = append(warns, p.Message)
		}
	}
	for _, want := range []string{
		"q0002: 2 correct answers",
		"q0003: empty text",
		"q0003: 2 answers, want 3",
		"q0003: answer 2 is empty",
		"unknown source missing",
		"unknown question q9999",
		"number 2 after 4",
	} {
		if !containsSubstring(errs, want) {
			t.Errorf("missing error %q in %v", want, errs)
		}
	}
	if !containsSubstring(warns, "numbers 2-3 are missing") {
		t.Errorf("missing gap warning in %v", warns)
	}
}

func containsSubstring(list []string, sub string) bool {
	for _, s := range list {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}
