package review

import (
	"testing"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
)

func TestEffective(t *testing.T) {
	t.Parallel()
	base := content.Explanation{QuestionID: "q1", Revision: 1, Source: "doc", Page: 3, Reference: "Regula 1", Quote: "text", Status: content.StatusSuggested, Note: "partial"}
	other := Passage{Source: "doc", Page: 4, Reference: "Regula 2", Quote: "alt text"}
	c := &content.Content{
		Sources:      []content.Source{{ID: "doc", Title: "Document"}},
		Questions:    []content.Question{{ID: "q1", Revision: 1}, {ID: "q2", Revision: 2}},
		Explanations: []content.Explanation{base},
	}
	reviewed := PassageOf(base)
	stale := Passage{Source: "doc", Page: 3, Reference: "Regula 1", Quote: "older text"}
	r := func(q, action string, d Data) Review { return Review{QuestionID: q, Action: action, Data: d} }
	one := func(rs ...Review) Explanation {
		for _, e := range Effective(c, rs) {
			if e.QuestionID == "q1" {
				return e
			}
		}
		t.Fatal("q1 missing")
		return Explanation{}
	}

	if e := one(); e.Status != content.StatusSuggested || e.SourceTitle != "Document" || e.Note != "partial" {
		t.Errorf("no reviews: %+v", e)
	}
	if e := one(r("q1", Confirm, Data{Revision: 1, Reviewed: &reviewed})); e.Status != content.StatusVerified {
		t.Errorf("confirmed: %+v", e)
	}
	if e := one(r("q1", Confirm, Data{Revision: 1, Reviewed: &stale})); e.Status != content.StatusSuggested {
		t.Errorf("confirmation of an older passage applied: %+v", e)
	}
	if e := one(r("q1", Confirm, Data{Revision: 0, Reviewed: &reviewed})); e.Status != content.StatusSuggested {
		t.Errorf("confirmation of an older question revision applied: %+v", e)
	}
	if e := one(r("q1", Reject, Data{Revision: 1, Reviewed: &reviewed})); e.Status != StatusRejected {
		t.Errorf("rejected: %+v", e)
	}
	if e := one(r("q1", Reject, Data{Revision: 1, Reviewed: &reviewed}), r("q1", Reset, Data{Revision: 1})); e.Status != content.StatusSuggested || e.Passage != reviewed {
		t.Errorf("reset: %+v", e)
	}
	if e := one(r("q1", Correct, Data{Revision: 1, Correction: &other})); e.Status != content.StatusVerified || e.Passage != other {
		t.Errorf("corrected: %+v", e)
	}
	if e := one(r("q1", Flag, Data{Revision: 1, Note: "contradiction"})); !e.Flagged || e.FlagNote != "contradiction" || e.Status != content.StatusSuggested {
		t.Errorf("flagged: %+v", e)
	}

	// A question without a proposed explanation can still be corrected or flagged.
	es := Effective(c, []Review{r("q2", Correct, Data{Revision: 2, Correction: &other})})
	if len(es) != 2 || es[1].QuestionID != "q2" || es[1].Status != content.StatusVerified {
		t.Errorf("correction without a proposal: %+v", es)
	}
}
