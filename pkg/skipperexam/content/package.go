package content

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

// Package is the content the apps download and run on the device: the questions
// with their correct answers, the subjects, and the exam types with the questions
// each one draws from. Version changes whenever the content does.
type Package struct {
	Version   string            `json:"version"`
	Subjects  []Subject         `json:"subjects"`
	Questions []PackageQuestion `json:"questions"`
	ExamTypes []PackageExamType `json:"examTypes"`
}

// PackageQuestion is a question as the apps see it. Group is set for questions that
// have equivalent ones, which share it.
type PackageQuestion struct {
	ID       string   `json:"id"`
	Text     string   `json:"text"`
	Answers  []Answer `json:"answers"`
	Revision int      `json:"revision"`
	Subject  string   `json:"subject"`
	Group    string   `json:"group,omitempty"`
}

// PackageExamType is an exam type with the IDs of the questions it draws from.
type PackageExamType struct {
	ExamType
	QuestionIDs []string `json:"questionIds,omitempty"`
}

// Package builds the content package. Only questions used by an available exam
// type are included.
func (c *Content) Package() (*Package, error) {
	groups := c.EquivalenceGroups()
	p := &Package{Subjects: c.Subjects, Questions: []PackageQuestion{}, ExamTypes: []PackageExamType{}}
	included := map[string]bool{}
	for _, t := range c.ExamTypes {
		pt := PackageExamType{ExamType: t}
		if t.Available {
			pt.QuestionIDs = c.ExamQuestions(t)
			for _, id := range pt.QuestionIDs {
				included[id] = true
			}
		}
		p.ExamTypes = append(p.ExamTypes, pt)
	}
	for _, q := range c.Questions {
		if included[q.ID] {
			p.Questions = append(p.Questions, PackageQuestion{
				ID: q.ID, Text: q.Text, Answers: q.Answers, Revision: q.Revision, Subject: q.Subject, Group: groups[q.ID],
			})
		}
	}
	data, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(data)
	p.Version = hex.EncodeToString(sum[:8])
	return p, nil
}
