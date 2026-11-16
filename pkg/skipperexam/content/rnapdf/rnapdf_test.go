package rnapdf

import (
	"fmt"
	"testing"
)

// These tests read the real RNA PDFs stored in the repository.
func TestExtract(t *testing.T) {
	t.Parallel()
	tests := []struct {
		file           string
		sectionSizes   []int
		missingFlagRow string
	}{
		{"Lista-intrebari-clasa-C-CAA.pdf", []int{442, 50, 25}, "s3#6"},
		{"Lista-intrebari-clasa-D-CAA.pdf", []int{296, 50, 25}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.file, func(t *testing.T) {
			t.Parallel()
			rows, err := Extract("../../../../content/sources/rna/" + tt.file)
			if err != nil {
				t.Fatal(err)
			}
			sizes := map[int]int{}
			for _, r := range rows {
				sizes[r.Section]++
				correct := 0
				for _, a := range r.Answers {
					if a.Text == "" {
						t.Errorf("s%d#%d: empty answer", r.Section, r.Number)
					}
					if a.Correct {
						correct++
					}
					if a.FlagMissing && tt.missingFlagRow != sectionNumber(r) {
						t.Errorf("%s: unexpected missing flag", sectionNumber(r))
					}
				}
				if r.Question == "" || correct != 1 {
					t.Errorf("%s: question %q has %d correct answers", sectionNumber(r), r.Question, correct)
				}
			}
			for i, want := range tt.sectionSizes {
				if sizes[i+1] != want {
					t.Errorf("section %d: %d questions, want %d", i+1, sizes[i+1], want)
				}
			}
		})
	}
}

// Class D has hidden "type" and "difficulty" columns whose values (usually "11")
// spill over the answer cells. They must not end up in the answer text.
func TestExtractDropsHiddenColumns(t *testing.T) {
	t.Parallel()
	rows, err := Extract("../../../../content/sources/rna/Lista-intrebari-clasa-D-CAA.pdf")
	if err != nil {
		t.Fatal(err)
	}
	r := rows[16] // section 1, number 17
	if r.Number != 17 || r.Answers[0].Text != "1 m" {
		t.Fatalf("got #%d first answer %q, want #17 %q", r.Number, r.Answers[0].Text, "1 m")
	}
}

func sectionNumber(r Row) string {
	return fmt.Sprintf("s%d#%d", r.Section, r.Number)
}
