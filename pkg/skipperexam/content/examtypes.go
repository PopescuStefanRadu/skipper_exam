package content

// ExamType returns the exam type with the given ID, or nil.
func (c *Content) ExamType(id string) *ExamType {
	for i := range c.ExamTypes {
		if c.ExamTypes[i].ID == id {
			return &c.ExamTypes[i]
		}
	}
	return nil
}

// ExamQuestions returns the IDs of the questions an exam type draws from, in bank
// order, without repeats. Questions without exactly one correct answer (a defect
// of the source) are left out.
func (c *Content) ExamQuestions(t ExamType) []string {
	b := c.Bank(t.Bank)
	if b == nil {
		return nil
	}
	allowed := map[string]bool{}
	for _, s := range t.Subjects {
		allowed[s] = true
	}
	seen := map[string]bool{}
	var ids []string
	for _, e := range b.Entries {
		q := c.Question(e.QuestionID)
		if q == nil || seen[q.ID] || (len(allowed) > 0 && !allowed[q.Subject]) || correctCount(q.Answers) != 1 {
			continue
		}
		seen[q.ID] = true
		ids = append(ids, q.ID)
	}
	return ids
}

func correctCount(answers []Answer) int {
	n := 0
	for _, a := range answers {
		if a.Correct {
			n++
		}
	}
	return n
}

// ExamGroupCount returns how many questions an exam of this type can hold at
// most: equivalent questions count once, since an exam never has both.
func (c *Content) ExamGroupCount(t ExamType) int {
	groups := c.EquivalenceGroups()
	seen := map[string]bool{}
	for _, id := range c.ExamQuestions(t) {
		g := groups[id]
		if g == "" {
			g = id
		}
		seen[g] = true
	}
	return len(seen)
}
