#!/bin/bash
# Builds the three VCFO Suite collateral files into ../ (pptx always; pdf when LibreOffice is installed).
#   cd docs/collateral/vcfo-suite/build && npm install && ./build.sh
#   COMING_SOON=0 ./build.sh     # drop the "Coming soon" tags once those modules are live
set -e
cd "$(dirname "$0")"
OUT=..
node brochure.js "$OUT/VCFO_Suite_Brochure.pptx"
node deck.js "$OUT/VCFO_Suite_Corporate_Deck.pptx"
node onepager.js "$OUT/VCFO_Suite_One_Pager.pptx"
if command -v soffice >/dev/null; then
  # The PDFs need Public Sans and IBM Plex Mono installed, or LibreOffice substitutes other fonts.
  for f in VCFO_Suite_Brochure VCFO_Suite_Corporate_Deck VCFO_Suite_One_Pager; do
    soffice --headless --convert-to pdf --outdir "$OUT" "$OUT/$f.pptx" >/dev/null
  done
fi
