#!/bin/sh
# Usage: ocr <pdf> — prints the text of every PDF page, each followed by a form feed.
#
# The scanned manual's pages are low-resolution photos of two-page spreads, some of
# them rotated. Each page's photo is taken as is, upscaled 3x, turned upright,
# split into its two book pages when it's a spread, and recognised with the
# Romanian "best" model. The rotation comes from Tesseract's orientation detection;
# when that is unsure or the recognised words have low confidence, every rotation
# is tried and the most confident one is kept. Pages run in parallel.
set -eu
pdf=$1
pages=$(pdfinfo "$pdf" | awk '/^Pages:/ {print $2}')
tmp=$(mktemp -d)
export tmp pdf
seq 1 "$pages" | xargs -P "$(nproc)" -I{} sh -c '
  p=$1; d="$tmp/$p"; mkdir -p "$d"
  pdfimages -f "$p" -l "$p" -png "$pdf" "$d/img"
  img=$(ls -S "$d"/img-*.png | head -1)
  convert "$img" -colorspace Gray -resize 300% -filter Lanczos -unsharp 0x1 "$d/big.png"

  # recognise <rotation>: writes $d/r<rotation>.txt and prints Tesseract'"'"'s mean
  # word confidence (0-100).
  recognise() {
    r=$1; o="$d/r$r"; mkdir -p "$o"
    convert "$d/big.png" -rotate "$r" "$o/up.png"
    w=$(identify -format %w "$o/up.png"); h=$(identify -format %h "$o/up.png")
    if [ "$w" -gt "$h" ]; then
      convert "$o/up.png" -crop 50%x100% +repage "$o/half-%d.png"
    else
      cp "$o/up.png" "$o/half-0.png"
    fi
    for half in "$o"/half-*.png; do
      OMP_THREAD_LIMIT=1 tesseract "$half" "${half%.png}" -l ron --psm 3 txt tsv >/dev/null 2>&1
    done
    cat "$o"/half-*.txt > "$o.txt"
    cat "$o"/half-*.tsv | awk -F "\t" "\$1 == 5 && \$11 >= 0 && \$12 != \"\" { s += \$11; n++ } END { print (n ? int(s / n) : 0) }"
  }

  osd=$(OMP_THREAD_LIMIT=1 tesseract "$d/big.png" - --psm 0 2>/dev/null)
  best=$(echo "$osd" | awk "/^Rotate:/ {print \$2}"); best=${best:-0}
  sure=$(echo "$osd" | awk "/^Orientation confidence:/ {print (\$3 >= 1.5)}")
  score=$(recognise "$best")
  if [ "${sure:-0}" != 1 ] || [ "$score" -lt 70 ]; then
    for r in 0 90 180 270; do
      [ "$r" = "$best" ] && continue
      s=$(recognise "$r")
      if [ "$s" -gt "$score" ]; then best=$r; score=$s; fi
    done
  fi
  cp "$d/r$best.txt" "$tmp/p$p.txt"
' _ {}
for p in $(seq 1 "$pages"); do
  cat "$tmp/p$p.txt"
  printf '\f'
done
