package content

import (
	"regexp"
	"strings"
)

// The question lists mix the correct Romanian letters (comma below) with their
// cedilla look-alikes.
var cedillaReplacer = strings.NewReplacer("ş", "ș", "Ş", "Ș", "ţ", "ț", "Ţ", "Ț")

var spaceBeforePunct = regexp.MustCompile(`\s+([,.;:?!)])`)

// Normalize cleans up text from a source document without changing its wording:
// it uses the correct Romanian letters, collapses whitespace and removes spaces
// before punctuation.
func Normalize(s string) string {
	s = cedillaReplacer.Replace(s)
	s = strings.Join(strings.Fields(s), " ")
	return spaceBeforePunct.ReplaceAllString(s, "$1")
}
