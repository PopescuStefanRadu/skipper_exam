package content

import (
	"testing"
)

// The real content in the repository must always be valid.
func TestRealContentIsValid(t *testing.T) {
	t.Parallel()
	const dir = "../../../content"
	c, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Banks) == 0 || len(c.Questions) == 0 {
		t.Fatal("no content found")
	}
	for _, p := range Validate(c, dir) {
		if p.Error {
			t.Error(p.Message)
		}
	}
}
