// Command content manages the app's content (see docs/app/features/content.md).
//
//	content import-rna -bank C -file sources/rna/Lista-intrebari-clasa-C-CAA.pdf -url https://... [-last-modified ...]
//	content tag          apply content/subject-ranges.json to the questions
//	content extract-text [-source ID]   extract the text of the bibliography sources (needs poppler's pdftotext)
//	content search [-source ID] words...               pages of the bibliography containing all the words
//	content check-quote -source ID -page N "quote"      whether the quote is on that page (or runs on to the next)
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
	case "extract-text":
		err = extractText(os.Args[2:])
	case "search":
		err = search(os.Args[2:])
	case "check-quote":
		err = checkQuote(os.Args[2:])
	default:
		usage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage: content import-rna|tag|extract-text|search|check-quote|validate [flags]")
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
		Kind:         content.KindQuestions,
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

func extractText(args []string) error {
	fs := flag.NewFlagSet("extract-text", flag.ExitOnError)
	dir := fs.String("dir", "content", "content directory")
	only := fs.String("source", "", "only this source ID")
	_ = fs.Parse(args)
	c, err := content.Load(*dir)
	if err != nil {
		return err
	}
	for _, s := range c.Sources {
		if s.Kind != content.KindBibliography || (*only != "" && s.ID != *only) {
			continue
		}
		t, err := content.ExtractText(*dir, s)
		if err != nil {
			return err
		}
		chars, empty := 0, 0
		for _, p := range t.Pages {
			chars += len(p.Text)
			if len(p.Text) < 20 {
				empty++
			}
		}
		fmt.Printf("%s: %d pages, %d characters, %d pages without text\n", s.ID, len(t.Pages), chars, empty)
	}
	return nil
}

func bibliographyTexts(dir, only string) ([]*content.SourceText, error) {
	c, err := content.Load(dir)
	if err != nil {
		return nil, err
	}
	var texts []*content.SourceText
	for _, s := range c.Sources {
		if s.Kind != content.KindBibliography || (only != "" && s.ID != only) {
			continue
		}
		t, err := content.LoadText(dir, s.ID)
		if err != nil {
			return nil, err
		}
		texts = append(texts, t)
	}
	if len(texts) == 0 {
		return nil, fmt.Errorf("no bibliography source %q", only)
	}
	return texts, nil
}

func search(args []string) error {
	fs := flag.NewFlagSet("search", flag.ExitOnError)
	dir := fs.String("dir", "content", "content directory")
	only := fs.String("source", "", "only this source ID")
	full := fs.Bool("full", false, "print the whole page, not only the matching lines")
	_ = fs.Parse(args)
	texts, err := bibliographyTexts(*dir, *only)
	if err != nil {
		return err
	}
	query := strings.Join(fs.Args(), " ")
	hits := content.Search(texts, query)
	for _, h := range hits {
		fmt.Printf("== %s page %d\n", h.Source, h.Page)
		if *full {
			fmt.Println(h.Text)
			continue
		}
		for _, line := range strings.Split(h.Text, "\n") {
			if len(content.Search([]*content.SourceText{{Pages: []content.PageText{{Text: line}}}}, strings.Fields(query)[0])) > 0 {
				fmt.Println("  " + line)
			}
		}
	}
	fmt.Printf("%d pages\n", len(hits))
	return nil
}

func checkQuote(args []string) error {
	fs := flag.NewFlagSet("check-quote", flag.ExitOnError)
	dir := fs.String("dir", "content", "content directory")
	source := fs.String("source", "", "source ID")
	page := fs.Int("page", 0, "PDF page, from 1")
	_ = fs.Parse(args)
	texts, err := bibliographyTexts(*dir, *source)
	if err != nil || *source == "" {
		return errors.New("-source must name a bibliography source")
	}
	quote := strings.Join(fs.Args(), " ")
	if texts[0].QuoteOnPage(quote, *page) {
		fmt.Println("ok: the quote is on that page")
		return nil
	}
	for _, h := range content.Search(texts, quote) {
		if texts[0].QuoteOnPage(quote, h.Page) {
			return fmt.Errorf("not on page %d, but on page %d", *page, h.Page)
		}
	}
	return fmt.Errorf("not found: the quote must be copied word for word from the page text")
}
