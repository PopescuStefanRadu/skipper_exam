# OCR for scanned bibliography documents (make content-extract). Only the content
# tooling uses it; the extracted text is committed.
FROM debian:12.8-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils imagemagick curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# The most accurate (LSTM "best") Romanian model and the orientation model, pinned
# to a tessdata_best release.
RUN curl -fsSL -o /usr/share/tesseract-ocr/5/tessdata/ron.traineddata \
      https://github.com/tesseract-ocr/tessdata_best/raw/4.1.0/ron.traineddata \
 && curl -fsSL -o /usr/share/tesseract-ocr/5/tessdata/osd.traineddata \
      https://github.com/tesseract-ocr/tessdata_best/raw/4.1.0/osd.traineddata
COPY ocr.sh /usr/local/bin/ocr
ENTRYPOINT ["ocr"]
