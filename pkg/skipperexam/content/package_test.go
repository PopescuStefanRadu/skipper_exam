package content

import "testing"

func TestPackageOfRealContent(t *testing.T) {
	t.Parallel()
	c, err := Load("../../../content")
	if err != nil {
		t.Fatal(err)
	}
	p, err := c.Package()
	if err != nil {
		t.Fatal(err)
	}
	again, _ := c.Package()
	if p.Version == "" || p.Version != again.Version {
		t.Fatalf("version %q, again %q: want stable and non-empty", p.Version, again.Version)
	}
	questions := map[string]PackageQuestion{}
	for _, q := range p.Questions {
		questions[q.ID] = q
	}
	for _, et := range p.ExamTypes {
		if !et.Available {
			if len(et.QuestionIDs) != 0 {
				t.Errorf("%s: unavailable but has questions", et.ID)
			}
			continue
		}
		for _, id := range et.QuestionIDs {
			q, ok := questions[id]
			if !ok {
				t.Fatalf("%s: question %s missing from the package", et.ID, id)
			}
			if correctCount(q.Answers) != 1 {
				t.Errorf("%s: question %s has %d correct answers", et.ID, id, correctCount(q.Answers))
			}
			if len(et.Subjects) == 1 && q.Subject != et.Subjects[0] {
				t.Errorf("%s: question %s has subject %s", et.ID, id, q.Subject)
			}
		}
	}
}
