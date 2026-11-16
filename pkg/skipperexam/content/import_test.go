package content

import (
	"reflect"
	"testing"
)

func q(section, number int, text string, correct int, answers ...string) Imported {
	imp := Imported{Section: section, Number: number, Text: text}
	for i, a := range answers {
		imp.Answers = append(imp.Answers, Answer{Text: a, Correct: i == correct})
	}
	return imp
}

var (
	anchor  = q(1, 1, "Ce este o ancoră de tip Danforth?", 0, "o ancoră cu brațe articulate", "o ancoră fixă", "o geamandură")
	sound   = q(1, 2, "Durata unui sunet lung este de:", 2, "circa 5 secunde", "circa 6 secunde", "circa 4 secunde")
	firstAd = q(2, 1, "Care este durata maximă a masajului cardiac?", 1, "10 minute", "30 - 40 minute", "2 ore")
)

func bankIDs(c *Content, bank string) []string {
	var ids []string
	for _, e := range c.Bank(bank).Entries {
		ids = append(ids, e.QuestionID)
	}
	return ids
}

func TestImportBankAssignsNewIDs(t *testing.T) {
	t.Parallel()
	c := &Content{}
	r := c.ImportBank("C", "src-C", []Imported{anchor, sound})
	if got, want := bankIDs(c, "C"), []string{"q0001", "q0002"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("ids = %v, want %v", got, want)
	}
	if len(r.New) != 2 || r.Unchanged != 0 {
		t.Fatalf("report = %+v", r)
	}
}

func TestImportBankSharesIdenticalQuestionsAcrossBanks(t *testing.T) {
	t.Parallel()
	c := &Content{}
	c.ImportBank("C", "src-C", []Imported{anchor, firstAd})
	r := c.ImportBank("D", "src-D", []Imported{sound, firstAd})
	if got := bankIDs(c, "D"); got[1] != "q0002" {
		t.Fatalf("shared question got id %s, want q0002", got[1])
	}
	if len(c.Questions) != 3 || len(r.Shared) != 1 || len(r.New) != 1 {
		t.Fatalf("questions = %d, report = %+v", len(c.Questions), r)
	}
}

func TestReimportKeepsIdentities(t *testing.T) {
	t.Parallel()
	c := &Content{}
	c.ImportBank("C", "src-C", []Imported{anchor, sound})

	t.Run("unchanged", func(t *testing.T) {
		c := clone(c)
		r := c.ImportBank("C", "src-C", []Imported{anchor, sound})
		if r.Unchanged != 2 || len(r.New)+len(r.Changed)+len(r.Removed) != 0 {
			t.Fatalf("report = %+v", r)
		}
	})

	t.Run("typo fixed keeps the id and bumps the revision", func(t *testing.T) {
		c := clone(c)
		fixed := sound
		fixed.Text = "Durata unui sunet lung este, de regulă, de:"
		r := c.ImportBank("C", "src-C", []Imported{anchor, fixed})
		if len(r.Changed) != 1 || bankIDs(c, "C")[1] != "q0002" || c.Question("q0002").Revision != 2 {
			t.Fatalf("report = %+v, ids = %v", r, bankIDs(c, "C"))
		}
	})

	t.Run("moved correct answer is a new question", func(t *testing.T) {
		c := clone(c)
		moved := sound
		moved.Answers = []Answer{{Text: "circa 5 secunde", Correct: true}, {Text: "circa 6 secunde"}, {Text: "circa 4 secunde"}}
		r := c.ImportBank("C", "src-C", []Imported{anchor, moved})
		if len(r.New) != 1 || !reflect.DeepEqual(r.Removed, []string{"q0002"}) {
			t.Fatalf("report = %+v", r)
		}
		if c.Question("q0002") == nil {
			t.Fatal("removed question must stay in the pool")
		}
	})

	t.Run("renumbered question keeps its id", func(t *testing.T) {
		c := clone(c)
		renumbered := sound
		renumbered.Number = 7
		r := c.ImportBank("C", "src-C", []Imported{anchor, renumbered})
		if r.Unchanged != 2 || c.Bank("C").Entries[1].Number != 7 {
			t.Fatalf("report = %+v", r)
		}
	})
}

func TestReimportDoesNotChangeAQuestionAnotherBankUses(t *testing.T) {
	t.Parallel()
	c := &Content{}
	c.ImportBank("C", "src-C", []Imported{firstAd})
	c.ImportBank("D", "src-D", []Imported{firstAd})

	edited := firstAd
	edited.Text = "Care este durata maximă a masajului cardiac extern?"
	r := c.ImportBank("C", "src-C", []Imported{edited})
	if len(r.New) != 1 || c.Question("q0001").Text != firstAd.Text {
		t.Fatalf("report = %+v; the question bank D uses must not change", r)
	}
}

func clone(c *Content) *Content {
	out := &Content{Sources: append([]Source(nil), c.Sources...)}
	for _, q := range c.Questions {
		q.Answers = append([]Answer(nil), q.Answers...)
		out.Questions = append(out.Questions, q)
	}
	for _, b := range c.Banks {
		b.Entries = append([]BankEntry(nil), b.Entries...)
		out.Banks = append(out.Banks, b)
	}
	return out
}

func TestNormalize(t *testing.T) {
	t.Parallel()
	got := Normalize("  navigaţie   şi  ţărm ,  apoi ?")
	if want := "navigație și țărm, apoi?"; got != want {
		t.Fatalf("Normalize = %q, want %q", got, want)
	}
}
