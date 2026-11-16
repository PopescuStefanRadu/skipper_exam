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
// order, without repeats.
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
		if q == nil || seen[q.ID] || (len(allowed) > 0 && !allowed[q.Subject]) {
			continue
		}
		seen[q.ID] = true
		ids = append(ids, q.ID)
	}
	return ids
}
