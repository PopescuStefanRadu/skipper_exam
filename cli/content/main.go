// Command content manages the app's content (see docs/app/features/content.md).
//
//	content import-rna -bank C -file sources/rna/Lista-intrebari-clasa-C-CAA.pdf -url https://... [-last-modified ...]
//	content tag          apply content/subject-ranges.json to the questions
//	content validate
//
// Paths are relative to the content directory (-dir, default "content").
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content"
	"github.com/PopescuStefanRadu/skipper_exam/pkg/skipperexam/content/rnapdf"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	var err error
	switch os.Args[1] {
	case "import-rna":
		err = importRNA(os.Args[2:])
	case "tag":
		err = tag(os.Args[2:])
	case "validate":
		err = validate(os.Args[2:])
	default:
		usage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: content import-rna|tag|validate [flags]")
	os.Exit(2)
}

func importRNA(args []string) error {
	fs := flag.NewFlagSet("import-rna", flag.ExitOnError)
	dir := fs.String("dir", "content", "content directory")
	bank := fs.String("bank", "", "bank ID, e.g. C")
	file := fs.String("file", "", "question-list PDF, relative to the content directory")
	url := fs.String("url", "", "where the PDF was published")
	lastModified := fs.String("last-modified", "", "publication date reported by the publisher")
	_ = fs.Parse(args)
	if *bank == "" || *file == "" || *url == "" {
		return errors.New("-bank, -file and -url are required")
	}

	c, err := content.Load(*dir)
	if err != nil {
		return err
	}
	path := filepath.Join(*dir, *file)
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	rows, err := rnapdf.Extract(path)
	if err != nil {
		return err
	}

	sum := sha256.Sum256(data)
	source := content.Source{
		ID:           "rna-questions-" + *bank,
		File:         *file,
		URL:          *url,
		SHA256:       hex.EncodeToString(sum[:]),
		LastModified: *lastModified,
		RetrievedAt:  time.Now().UTC().Format(time.DateOnly),
	}
	if s := c.Source(source.ID); s != nil {
		*s = source
	} else {
		c.Sources = append(c.Sources, source)
	}

	imported := make([]content.Imported, len(rows))
	for i, r := range rows {
		q := content.Imported{Section: r.Section, Number: r.Number, Text: content.Normalize(r.Question)}
		for a, ans := range r.Answers {
			q.Answers = append(q.Answers, content.Answer{Text: content.Normalize(ans.Text), Correct: ans.Correct})
			if ans.FlagMissing {
				q.Issues = append(q.Issues, fmt.Sprintf("the source has no correct flag for answer %d (bank %s, section %d, number %d)", a+1, *bank, r.Section, r.Number))
			}
		}
		imported[i] = q
	}
	report := c.ImportBank(*bank, source.ID, imported)
	if err := c.Save(*dir); err != nil {
		return err
	}

	fmt.Printf("bank %s: %d questions in %d sections\n", *bank, len(imported), c.Bank(*bank).Sections)
	fmt.Printf("  unchanged: %d\n", report.Unchanged)
	printList("shared with other banks", report.Shared)
	printList("new", report.New)
	printList("changed", report.Changed)
	printList("removed", report.Removed)
	return validateContent(c, *dir)
}

func printList(title string, items []string) {
	fmt.Printf("  %s: %d\n", title, len(items))
	if len(items) > 0 && len(items) <= 20 {
		fmt.Printf("    %s\n", strings.Join(items, "\n    "))
	}
}

func tag(args []string) error {
	fs := flag.NewFlagSet("tag", flag.ExitOnError)
	dir := fs.String("dir", "content", "content directory")
	_ = fs.Parse(args)
	c, err := content.Load(*dir)
	if err != nil {
		return err
	}
	if err := c.ApplySubjectRanges(); err != nil {
		return err
	}
	if err := c.Save(*dir); err != nil {
		return err
	}
	counts := map[string]int{}
	for _, q := range c.Questions {
		counts[q.Subject]++
	}
	for _, s := range c.Subjects {
		fmt.Printf("  %-14s %4d  %s\n", s.ID, counts[s.ID], s.Name)
	}
	return validateContent(c, *dir)
}

func validate(args []string) error {
	fs := flag.NewFlagSet("validate", flag.ExitOnError)
	dir := fs.String("dir", "content", "content directory")
	_ = fs.Parse(args)
	c, err := content.Load(*dir)
	if err != nil {
		return err
	}
	return validateContent(c, *dir)
}

func validateContent(c *content.Content, dir string) error {
	errs := 0
	for _, p := range content.Validate(c, dir) {
		fmt.Println(p)
		if p.Error {
			errs++
		}
	}
	if errs > 0 {
		return fmt.Errorf("content validation failed: %d error(s)", errs)
	}
	groups := map[string]bool{}
	for _, g := range c.EquivalenceGroups() {
		groups[g] = true
	}
	fmt.Printf("content valid: %d questions (%d equivalence groups), %d banks, %d sources\n", len(c.Questions), len(groups), len(c.Banks), len(c.Sources))
	return nil
}
