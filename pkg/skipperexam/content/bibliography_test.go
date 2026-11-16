package content

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestQuoteOnPage(t *testing.T) {
	t.Parallel()
	text := &SourceText{Pages: []PageText{
		{Page: 1, Text: "a) Expresia „lumină de catarg” înseamnă o lu-\nmină albă amplasată"},
		{Page: 2, Text: "în planul longitudinal al navei."},
	}}
	cases := []struct {
		quote string
		page  int
		want  bool
	}{
		{"Expresia \"lumina de catarg\" înseamnă o lumină albă", 1, true}, // diacritics, quotes, hyphenation
		{"o lumină albă amplasată în planul longitudinal", 1, true},       // runs on to the next page
		{"o lumină albă amplasată în planul longitudinal", 2, false},
		{"lumină verde", 1, false},
		{"", 1, false},
	}
	for _, c := range cases {
		if got := text.QuoteOnPage(c.quote, c.page); got != c.want {
			t.Errorf("QuoteOnPage(%q, %d) = %v, want %v", c.quote, c.page, got, c.want)
		}
	}
}

func TestQuoteOnPageOCR(t *testing.T) {
	t.Parallel()
	page := []PageText{{Page: 1, Text: "Echipamentul de radiotelefonie care se glisește la bordul navei trebuie să fie conform."}}
	corrected := "Echipamentul de radiotelefonie care se găsește la bordul navei"
	invented := "Echipamentul de navigație care se află în cabina navei"
	if (&SourceText{Pages: page}).QuoteOnPage(corrected, 1) {
		t.Error("a corrected quote matched text that isn't OCR")
	}
	ocr := &SourceText{OCR: true, Pages: page}
	if !ocr.QuoteOnPage(corrected, 1) {
		t.Error("a quote correcting an OCR error didn't match")
	}
	if ocr.QuoteOnPage(invented, 1) {
		t.Error("an invented quote matched OCR text")
	}
}

func TestValidateExplanations(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, bibliographyDir), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := writeJSON(textFile(dir, "doc"), SourceText{Source: "doc", Pages: []PageText{{Page: 1, Text: "Nava trebuie să arate o lumină albă."}}}); err != nil {
		t.Fatal(err)
	}
	c := &Content{
		Sources:   []Source{{ID: "doc", Kind: KindBibliography}, {ID: "list", Kind: KindQuestions}},
		Questions: []Question{{ID: "q1", Revision: 2}, {ID: "q2", Revision: 1}},
		Explanations: []Explanation{
			{QuestionID: "q1", Revision: 2, Source: "doc", Page: 1, Reference: "Regula 1", Quote: "trebuie să arate o lumină albă", Status: StatusVerified},
			{QuestionID: "q2", Revision: 1, Source: "doc", Page: 1, Reference: "Regula 1", Quote: "o lumină roșie", Status: StatusSuggested},
			{QuestionID: "q2", Revision: 1, Source: "list", Page: 1, Quote: "x", Status: "maybe"},
			{QuestionID: "q9", Revision: 1, Source: "doc", Page: 1, Quote: "x", Status: StatusSuggested},
			{QuestionID: "q1", Revision: 1, Source: "doc", Page: 1, Reference: "Regula 1", Quote: "o lumină albă", Status: StatusVerified},
		},
	}
	var got []string
	for _, p := range validateExplanations(c, dir) {
		got = append(got, p.String())
	}
	all := strings.Join(got, "\n")
	for _, want := range []string{
		"explanation of q2: the quote isn't on page 1 of doc",
		"explanation of q2: more than one",
		`explanation of q2: unknown status "maybe"`,
		`explanation of q2: unknown bibliography source "list"`,
		"explanation of q9: unknown question",
		"explanation of q1: made for revision 1, the question is at 2; mark it stale",
	} {
		if !strings.Contains(all, want) {
			t.Errorf("missing problem %q in:\n%s", want, all)
		}
	}
	if strings.Contains(all, "explanation of q1: the quote") {
		t.Errorf("valid quote reported:\n%s", all)
	}
}
