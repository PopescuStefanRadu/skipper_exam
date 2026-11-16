// Package rnapdf extracts questions from the RNA question-list PDFs.
//
// The PDFs are exported from Excel. Every cell border is drawn as a thin filled
// rectangle, so the table grid can be rebuilt exactly: horizontal borders separate
// rows and vertical borders separate columns. Each text run is placed in the cell
// that contains its centre. Some exports have hidden, very narrow columns (type,
// difficulty, URL) whose values spill over the neighbouring cells; those columns
// are dropped, and so are the runs that belong to them.
//
// After dropping the narrow columns every page must have exactly these columns:
// number, question, then three times answer text and its correct flag (0 or 1).
package rnapdf

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/ledongthuc/pdf"
)

// Row is one question as printed in the PDF.
type Row struct {
	Page int
	// Section counts from 1. The lists are made of untitled sections, and the
	// numbering restarts at 1 in each one.
	Section  int
	Number   int
	Question string
	Answers  [3]Answer
}

// Answer is one answer option and the value of its correct flag.
type Answer struct {
	Text    string
	Correct bool
	// FlagMissing is set when the correct flag cell is empty in the PDF (a defect
	// in the source); Correct is then false.
	FlagMissing bool
}

const (
	// Borders are drawn as filled rectangles about one point thick.
	maxBorderThickness = 2.0
	// Columns narrower than this are hidden columns.
	minColumnWidth = 5.0
	// Vertical borders closer than this are the same border.
	borderMergeDistance = 0.5
	// Runs whose baselines differ by less than this are on the same line.
	sameLineDistance = 1.0
	wantColumns      = 8
)

// Extract reads every question row from an RNA question-list PDF.
func Extract(path string) ([]Row, error) {
	f, r, err := pdf.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var rows []Row
	for n := 1; n <= r.NumPage(); n++ {
		page := r.Page(n)
		if page.V.IsNull() {
			continue
		}
		pageRows, err := extractPage(page.Content())
		if err != nil {
			return nil, fmt.Errorf("page %d: %w", n, err)
		}
		for i := range pageRows {
			pageRows[i].Page = n
		}
		rows = append(rows, pageRows...)
	}
	section := 1
	for i := range rows {
		if i > 0 && rows[i].Number <= rows[i-1].Number {
			section++
		}
		rows[i].Section = section
	}
	return rows, nil
}

type run struct {
	text       string
	x, xEnd, y float64
}

func (r run) centre() float64 { return (r.x + r.xEnd) / 2 }

func extractPage(c pdf.Content) ([]Row, error) {
	rowBorders, colBorders := borders(c.Rect)
	if len(rowBorders) < 2 {
		return nil, nil // no table on this page
	}
	cols := columns(colBorders)
	if len(cols) != wantColumns {
		return nil, fmt.Errorf("found %d columns, want %d", len(cols), wantColumns)
	}

	// cells[row][col] holds the runs of one cell. PDF y grows upwards, so
	// rowBorders are sorted top to bottom by descending y.
	cells := make([][][]run, len(rowBorders)-1)
	for i := range cells {
		cells[i] = make([][]run, len(cols))
	}
	for _, rn := range runs(c.Text) {
		ri := sort.Search(len(rowBorders), func(i int) bool { return rowBorders[i] < rn.y }) - 1
		if ri < 0 || ri >= len(cells) {
			continue // outside the table, e.g. a page header
		}
		ci := columnAt(cols, rn.centre())
		if ci < 0 {
			continue // belongs to a hidden column
		}
		cells[ri][ci] = append(cells[ri][ci], rn)
	}

	var rows []Row
	for ri, cell := range cells {
		numText := cellText(cell[0])
		number, err := strconv.Atoi(numText)
		if err != nil {
			if ri == 0 {
				continue // header row
			}
			return nil, fmt.Errorf("row %d: number %q is not an integer", ri, numText)
		}
		row := Row{Number: number, Question: cellText(cell[1])}
		for a := 0; a < 3; a++ {
			flag := cellText(cell[3+2*a])
			if flag != "0" && flag != "1" && flag != "" {
				return nil, fmt.Errorf("question %d: answer %d flag is %q, want 0, 1 or empty", number, a+1, flag)
			}
			row.Answers[a] = Answer{Text: cellText(cell[2+2*a]), Correct: flag == "1", FlagMissing: flag == ""}
		}
		rows = append(rows, row)
	}
	return rows, nil
}

// borders returns the y of every horizontal border, top to bottom, and the x of
// every vertical border, left to right.
func borders(rects []pdf.Rect) (rowYs, colXs []float64) {
	for _, r := range rects {
		w, h := r.Max.X-r.Min.X, r.Max.Y-r.Min.Y
		switch {
		case h <= maxBorderThickness && w > 5*h:
			rowYs = append(rowYs, (r.Min.Y+r.Max.Y)/2)
		case w <= maxBorderThickness && h > 5*w:
			colXs = append(colXs, (r.Min.X+r.Max.X)/2)
		}
	}
	rowYs = merge(rowYs)
	sort.Sort(sort.Reverse(sort.Float64Slice(rowYs)))
	return rowYs, merge(colXs)
}

// merge sorts the values and replaces each group of values closer than
// borderMergeDistance with their first value.
func merge(vs []float64) []float64 {
	sort.Float64s(vs)
	var out []float64
	for _, v := range vs {
		if len(out) == 0 || v-out[len(out)-1] >= borderMergeDistance {
			out = append(out, v)
		}
	}
	return out
}

type column struct{ left, right float64 }

// columns returns the visible columns between consecutive vertical borders.
func columns(xs []float64) []column {
	var cols []column
	for i := 0; i+1 < len(xs); i++ {
		if xs[i+1]-xs[i] >= minColumnWidth {
			cols = append(cols, column{xs[i], xs[i+1]})
		}
	}
	return cols
}

func columnAt(cols []column, x float64) int {
	for i, c := range cols {
		if x >= c.left && x < c.right {
			return i
		}
	}
	return -1
}

// runs groups the page's characters into line segments: characters that follow
// each other on the same baseline. A text operation in the PDF can span several
// lines, and even several cells, so segments are split wherever the position
// jumps: a new baseline, a move backwards, or a gap wider than a space.
func runs(chars []pdf.Text) []run {
	const maxGap = 3.0
	var out []run
	var b strings.Builder
	var cur run
	flush := func() {
		if strings.TrimSpace(b.String()) != "" {
			cur.text = b.String()
			out = append(out, cur)
		}
		b.Reset()
	}
	for _, ch := range chars {
		if !isPrintable(ch.S) {
			flush()
			continue
		}
		if b.Len() > 0 && (math.Abs(ch.Y-cur.y) > 0.5 || ch.X < cur.xEnd-0.5 || ch.X-cur.xEnd > maxGap) {
			flush()
		}
		if b.Len() == 0 {
			cur = run{x: ch.X, y: ch.Y}
		}
		b.WriteString(ch.S)
		cur.xEnd = ch.X + ch.W
	}
	flush()
	return out
}

// isPrintable reports whether s is visible text or a space. Line breaks inside
// cells come through as newlines or replacement characters.
func isPrintable(s string) bool {
	for _, r := range s {
		if r == '�' || (r < ' ' && r != '\t') {
			return false
		}
	}
	return s != ""
}

// cellText joins a cell's runs into one string: lines top to bottom, runs on a
// line left to right.
func cellText(rs []run) string {
	sort.SliceStable(rs, func(i, j int) bool {
		if math.Abs(rs[i].y-rs[j].y) >= sameLineDistance {
			return rs[i].y > rs[j].y
		}
		return rs[i].x < rs[j].x
	})
	var b strings.Builder
	for i, rn := range rs {
		text := strings.TrimSpace(rn.text)
		if text == "" {
			continue
		}
		if i > 0 && b.Len() > 0 {
			prev := rs[i-1]
			sameLine := math.Abs(prev.y-rn.y) < sameLineDistance
			switch {
			case sameLine && rn.x-prev.xEnd < 1:
				// adjacent runs of the same word
			case !sameLine && strings.HasSuffix(b.String(), "-"):
				// line wrapped at a hyphen
			default:
				b.WriteByte(' ')
			}
		}
		b.WriteString(text)
	}
	return strings.Join(strings.Fields(b.String()), " ")
}
