package content

import (
	"fmt"
	"html"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
)

// Source kinds.
const (
	KindQuestions    = "questions"
	KindBibliography = "bibliography"
)

// SourceText is the text of a bibliography document, page by page, as extracted
// from its PDF. Explanations quote it.
type SourceText struct {
	Source string `json:"source"`
	// OCR is set when the text was recognised from a scan, so it has recognition
	// errors. Quotes from it may correct them.
	OCR   bool       `json:"ocr,omitempty"`
	Pages []PageText `json:"pages"`
}

// PageText is the text of one PDF page. Page counts from 1, like PDF viewers do,
// so the document can be opened at it.
type PageText struct {
	Page int    `json:"page"`
	Text string `json:"text"`
}

// Explanation links a question to the passage of a bibliography document that
// shows why its correct answer is correct (see docs/app/features/explanations.md).
type Explanation struct {
	QuestionID string `json:"questionId"`
	// Revision is the question revision the explanation was made for. A newer
	// revision makes it stale.
	Revision int    `json:"revision"`
	Source   string `json:"source"`
	Page     int    `json:"page"`
	// Reference names the rule, article or section, e.g. "Regula 21(b)".
	Reference string `json:"reference"`
	// Quote is the passage, word for word from the source text.
	Quote  string `json:"quote"`
	Status string `json:"status"`
	// Concern is set when the source seems to contradict the official answer.
	Concern string `json:"concern,omitempty"`
	// Note is for reviewers, e.g. why the passage only partly supports the answer.
	Note string `json:"note,omitempty"`
}

// Explanation statuses.
const (
	StatusSuggested = "suggested"
	StatusVerified  = "verified"
	StatusStale     = "stale"
)

const (
	bibliographyDir  = "bibliography"
	explanationsFile = "explanations.json"
)

func textFile(dir, sourceID string) string {
	return filepath.Join(dir, bibliographyDir, sourceID+".json")
}

// LoadText reads the extracted text of a bibliography source.
func LoadText(dir, sourceID string) (*SourceText, error) {
	t := &SourceText{}
	if err := readJSON(textFile(dir, sourceID), t); err != nil {
		return nil, err
	}
	return t, nil
}

// ExtractText extracts a bibliography source's text with pdftotext (poppler) and
// stores it. Column "left" keeps only the left column of each page, for documents
// printed in two languages side by side.
func ExtractText(dir string, s Source) (*SourceText, error) {
	pdf := filepath.Join(dir, s.File)
	out, err := exec.Command("pdfinfo", pdf).Output()
	if err != nil {
		return nil, fmt.Errorf("pdfinfo %s: %w", s.File, err)
	}
	pages, width, height := 0, 0.0, 0.0
	for _, line := range strings.Split(string(out), "\n") {
		if v, ok := strings.CutPrefix(line, "Pages:"); ok {
			pages, _ = strconv.Atoi(strings.TrimSpace(v))
		}
		if v, ok := strings.CutPrefix(line, "Page size:"); ok {
			_, _ = fmt.Sscanf(strings.TrimSpace(v), "%g x %g", &width, &height)
		}
	}
	if pages == 0 {
		return nil, fmt.Errorf("%s: no pages", s.File)
	}
	t := &SourceText{Source: s.ID, OCR: s.OCR}
	if s.OCR {
		texts, err := ocr(dir, s.File)
		if err != nil {
			return nil, err
		}
		for i, text := range texts {
			t.Pages = append(t.Pages, PageText{Page: i + 1, Text: cleanPage(text)})
		}
		return t, writeJSON(textFile(dir, s.ID), t)
	}
	for p := 1; p <= pages; p++ {
		var text string
		if s.Column == "left" {
			text, err = leftColumn(pdf, p, width)
		} else {
			var out []byte
			out, err = exec.Command("pdftotext", "-q", "-enc", "UTF-8", "-f", strconv.Itoa(p), "-l", strconv.Itoa(p), pdf, "-").Output()
			text = string(out)
		}
		if err != nil {
			return nil, fmt.Errorf("pdftotext %s page %d: %w", s.File, p, err)
		}
		t.Pages = append(t.Pages, PageText{Page: p, Text: cleanPage(text)})
	}
	return t, writeJSON(textFile(dir, s.ID), t)
}

type word struct {
	x, y, xMax float64
	text       string
}

var bboxWordRE = regexp.MustCompile(`<word xMin="([0-9.]+)" yMin="([0-9.]+)" xMax="([0-9.]+)" yMax="[0-9.]+">([^<]*)</word>`)

// leftColumn returns the text of a page's left column: the words that start
// before the right column's left margin.
func leftColumn(pdf string, page int, width float64) (string, error) {
	out, err := exec.Command("pdftotext", "-q", "-enc", "UTF-8", "-bbox", "-f", strconv.Itoa(page), "-l", strconv.Itoa(page), pdf, "-").Output()
	if err != nil {
		return "", err
	}
	var words []word
	starts := map[int]int{}
	for _, m := range bboxWordRE.FindAllStringSubmatch(string(out), -1) {
		x, _ := strconv.ParseFloat(m[1], 64)
		y, _ := strconv.ParseFloat(m[2], 64)
		xMax, _ := strconv.ParseFloat(m[3], 64)
		words = append(words, word{x: x, y: y, xMax: xMax, text: html.UnescapeString(m[4])})
		if x > width*0.45 && x < width*0.65 {
			starts[int(x)]++
		}
	}
	// The margin is the leftmost position where several words start and no word
	// runs across: in the gutter between the columns. Indented paragraphs start
	// further right; justified text can start a few words at the same position
	// inside the left column, but those positions have words running across them.
	crossing := func(m float64) int {
		n := 0
		for _, w := range words {
			if w.x < m-2 && w.xMax > m+1 {
				n++
			}
		}
		return n
	}
	margin := width / 2
	candidates := make([]int, 0, len(starts))
	for x, n := range starts {
		if n >= 3 {
			candidates = append(candidates, x)
		}
	}
	sort.Ints(candidates)
	for _, x := range candidates {
		if crossing(float64(x)) == 0 {
			margin = float64(x)
			break
		}
	}
	var left []word
	for _, w := range words {
		if w.x < margin-2 {
			left = append(left, w)
		}
	}
	// Lines: words whose tops are within 3 points of each other, left to right.
	sort.SliceStable(left, func(i, j int) bool { return left[i].y < left[j].y })
	var lines [][]word
	for _, w := range left {
		if n := len(lines); n > 0 && w.y-lines[n-1][0].y < 3 {
			lines[n-1] = append(lines[n-1], w)
		} else {
			lines = append(lines, []word{w})
		}
	}
	var b strings.Builder
	for _, l := range lines {
		sort.Slice(l, func(i, j int) bool { return l[i].x < l[j].x })
		for i, w := range l {
			if i > 0 {
				b.WriteByte(' ')
			}
			b.WriteString(w.text)
		}
		b.WriteByte('\n')
	}
	return b.String(), nil
}

// cleanPage normalises each line and drops empty ones, keeping the line breaks.
func cleanPage(text string) string {
	var lines []string
	for _, l := range strings.Split(text, "\n") {
		if l = Normalize(l); l != "" {
			lines = append(lines, l)
		}
	}
	return strings.Join(lines, "\n")
}

// letters reduces text to its lowercase ASCII letters and digits, so a quote
// matches its source regardless of diacritics, punctuation, line breaks and
// words hyphenated across lines.
func letters(s string) string {
	return strings.ReplaceAll(fold(s), " ", "")
}

// QuoteOnPage reports whether quote appears on the given page, or runs on from it
// onto the next page. For OCR text, the quote may differ from the text by up to
// one letter in ten, so it can correct recognition errors.
func (t *SourceText) QuoteOnPage(quote string, page int) bool {
	q := letters(quote)
	if q == "" {
		return false
	}
	var text string
	for _, p := range t.Pages {
		if p.Page == page || p.Page == page+1 {
			text += p.Text + "\n"
		}
	}
	if strings.Contains(letters(text), q) {
		return true
	}
	return t.OCR && len(q) >= 20 && substringDistance(q, letters(text)) <= len(q)/10
}

// substringDistance returns the smallest edit distance between q and any part of
// text (semi-global alignment: the match may start and end anywhere in text).
func substringDistance(q, text string) int {
	prev := make([]int, len(text)+1) // matching nothing of q costs nothing anywhere
	cur := make([]int, len(text)+1)
	for i := 1; i <= len(q); i++ {
		cur[0] = i
		for j := 1; j <= len(text); j++ {
			cost := 1
			if q[i-1] == text[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j-1]+cost, prev[j]+1, cur[j-1]+1)
		}
		prev, cur = cur, prev
	}
	return slices.Min(prev)
}

// validateExplanations checks that every explanation refers to a known question
// and bibliography source, and that its quote is really on that page.
func validateExplanations(c *Content, dir string) []Problem {
	var ps []Problem
	errorf := func(format string, args ...any) {
		ps = append(ps, Problem{Error: true, Message: fmt.Sprintf(format, args...)})
	}
	warnf := func(format string, args ...any) {
		ps = append(ps, Problem{Message: fmt.Sprintf(format, args...)})
	}
	texts := map[string]*SourceText{}
	seen := map[string]bool{}
	for _, e := range c.Explanations {
		label := "explanation of " + e.QuestionID
		if seen[e.QuestionID] {
			errorf("%s: more than one", label)
		}
		seen[e.QuestionID] = true
		q := c.Question(e.QuestionID)
		if q == nil {
			errorf("%s: unknown question", label)
			continue
		}
		switch e.Status {
		case StatusSuggested, StatusVerified, StatusStale:
		default:
			errorf("%s: unknown status %q", label, e.Status)
		}
		if e.Revision != q.Revision && e.Status != StatusStale {
			errorf("%s: made for revision %d, the question is at %d; mark it stale", label, e.Revision, q.Revision)
		}
		s := c.Source(e.Source)
		if s == nil || s.Kind != KindBibliography {
			errorf("%s: unknown bibliography source %q", label, e.Source)
			continue
		}
		t, ok := texts[s.ID]
		if !ok {
			var err error
			if t, err = LoadText(dir, s.ID); err != nil || len(t.Pages) == 0 {
				errorf("%s: no extracted text for %s (run make content-extract)", label, s.ID)
				texts[s.ID] = &SourceText{}
				continue
			}
			texts[s.ID] = t
		}
		if len(t.Pages) == 0 {
			continue
		}
		if e.Reference == "" {
			warnf("%s: no reference", label)
		}
		if !t.QuoteOnPage(e.Quote, e.Page) {
			errorf("%s: the quote isn't on page %d of %s", label, e.Page, s.ID)
		}
	}
	return ps
}

// SearchHit is a page that contains all the searched words.
type SearchHit struct {
	Source string
	Page   int
	Text   string
}

// Search returns the pages of the given sources' texts that contain every word
// of query, ignoring case, diacritics and punctuation.
func Search(texts []*SourceText, query string) []SearchHit {
	terms := strings.Fields(fold(query))
	var hits []SearchHit
	for _, t := range texts {
		for _, p := range t.Pages {
			page := " " + fold(p.Text) + " "
			all := len(terms) > 0
			for _, term := range terms {
				if !strings.Contains(page, term) {
					all = false
					break
				}
			}
			if all {
				hits = append(hits, SearchHit{Source: t.Source, Page: p.Page, Text: p.Text})
			}
		}
	}
	return hits
}

// OCRImage is the Docker image that recognises scanned documents (docker/ocr).
const OCRImage = "skipper-exam-ocr"

// ocr returns the recognised text of every page of a scanned PDF.
func ocr(dir, file string) ([]string, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return nil, err
	}
	out, err := exec.Command("docker", "run", "--rm", "-v", abs+":/content:ro", OCRImage, "/content/"+file).Output()
	if err != nil {
		return nil, fmt.Errorf("ocr %s: %w (build the image with make content-extract)", file, err)
	}
	pages := strings.Split(string(out), "\f")
	return pages[:len(pages)-1], nil
}
