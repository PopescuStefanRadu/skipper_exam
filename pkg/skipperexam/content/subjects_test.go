package content

import (
	"strings"
	"testing"
)

func taggedContent() *Content {
	c := &Content{Subjects: []Subject{{ID: "colreg"}, {ID: "seamanship"}}}
	c.ImportBank("C", "src-C", []Imported{
		q(1, 1, "Ce lumini poartă o navă?", 0, "verde", "roșu", "alb"),
		q(1, 2, "Ce este o parâmă?", 1, "un nod", "o frânghie", "o ancoră"),
	})
	c.ImportBank("D", "src-D", []Imported{
		q(1, 1, "Ce este o parama?", 1, "un nod", "o franghie", "o ancora"),
	})
	return c
}

func TestApplySubjectRanges(t *testing.T) {
	t.Parallel()
	c := taggedContent()
	c.SubjectRanges = []SubjectRange{
		{Bank: "C", Section: 1, From: 1, To: 1, Subject: "colreg"},
		{Bank: "C", Section: 1, From: 2, To: 2, Subject: "seamanship"},
		{Bank: "D", Section: 1, From: 1, To: 1, Subject: "seamanship"},
	}
	if err := c.ApplySubjectRanges(); err != nil {
		t.Fatal(err)
	}
	if got := c.Question("q0001").Subject + "," + c.Question("q0002").Subject + "," + c.Question("q0003").Subject; got != "colreg,seamanship,seamanship" {
		t.Fatalf("subjects = %s", got)
	}
	for _, p := range Validate(c, t.TempDir()) {
		if p.Error && !strings.Contains(p.Message, "source") {
			t.Errorf("unexpected problem: %s", p.Message)
		}
	}
}

func TestApplySubjectRangesRejectsConflicts(t *testing.T) {
	t.Parallel()
	c := &Content{}
	shared := q(1, 1, "Ce este o parâmă?", 1, "un nod", "o frânghie", "o ancoră")
	c.ImportBank("C", "src-C", []Imported{shared})
	c.ImportBank("D", "src-D", []Imported{shared})
	c.SubjectRanges = []SubjectRange{
		{Bank: "C", Section: 1, From: 1, To: 1, Subject: "colreg"},
		{Bank: "D", Section: 1, From: 1, To: 1, Subject: "seamanship"},
	}
	if err := c.ApplySubjectRanges(); err == nil {
		t.Fatal("want an error for a question tagged with two subjects")
	}
}

func TestEquivalenceGroupsIgnoreDiacriticsPunctuationAndCase(t *testing.T) {
	t.Parallel()
	c := taggedContent()
	groups := c.EquivalenceGroups()
	if groups["q0002"] != "q0002" || groups["q0003"] != "q0002" {
		t.Fatalf("groups = %v, want q0002 and q0003 in group q0002", groups)
	}
	if _, ok := groups["q0001"]; ok {
		t.Fatal("q0001 has no equivalent question")
	}
}

func TestValidateSubjects(t *testing.T) {
	t.Parallel()
	c := taggedContent()
	c.SubjectRanges = []SubjectRange{
		{Bank: "C", Section: 1, From: 1, To: 2, Subject: "colreg"},
		{Bank: "C", Section: 1, From: 2, To: 2, Subject: "nope"},
	}
	if err := c.ApplySubjectRanges(); err == nil {
		t.Fatal("want a conflict error for C#2")
	}
	c.Question("q0003").Subject = "seamanship"
	var msgs []string
	for _, p := range Validate(c, t.TempDir()) {
		msgs = append(msgs, p.Message)
	}
	for _, want := range []string{
		"subject range 2: unknown subject nope",
		"subject ranges 1 and 2 overlap",
		"bank D s1#1: not covered by any subject range",
		"q0001: unknown or missing subject",
	} {
		if !containsSubstring(msgs, want) {
			t.Errorf("missing %q in %v", want, msgs)
		}
	}
}
