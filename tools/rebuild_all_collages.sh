#!/usr/bin/env bash
# Rebuild all extension collages + social exports for repos and ~/Downloads.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/make_collage_2026.py"
SOCIAL_DIR="${HOME}/Downloads/socials post collages"
PICTURES="${HOME}/Pictures/Screenshots"
CLIPFLOW_REPO="${CLIPFLOW_REPO:-$HOME/dev/clipflow-pro}"
CLIPFLOW_GRID="${PICTURES}/clipflow pro 2026/collage-grid"

mkdir -p "$SOCIAL_DIR"

build_one() {
  local kind="$1" src="$2" repo="$3"
  python3 "$SCRIPT" "$kind" "$src" \
    "$repo/screenshots/collage-2026.png" \
    --social-dir "$SOCIAL_DIR" \
    --github-social "$repo/.github/social-preview.png"
  if [[ "$kind" == "easehub" ]]; then
    /bin/cp -f "$SOCIAL_DIR/comfort-control-easehub-social-1280x640.png" \
      "$repo/screenshots/social-preview-2026.png"
  fi
  echo "OK $kind"
}

# ClipFlow: 7-tile grid (1c, 2c, 3c + settings 4–7) → HD JPEG README collage
if [[ -d "$CLIPFLOW_GRID" ]]; then
  tmp_png="${CLIPFLOW_REPO}/screenshots/.collage-build.png"
  python3 "$SCRIPT" clipflow "$CLIPFLOW_GRID" "$tmp_png" \
    --github-social "${CLIPFLOW_REPO}/.github/social-preview.png"
  python3 - "$tmp_png" "${CLIPFLOW_REPO}/screenshots/collage-v1.4.2-2026.jpg" <<'PY'
from PIL import Image, ImageFilter
import sys
src, dest = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
im = im.filter(ImageFilter.UnsharpMask(radius=0.8, percent=110, threshold=2))
im.save(dest, "JPEG", quality=93, subsampling=0, optimize=True)
print(f"Wrote {dest}")
PY
  rm -f "$tmp_png"
  echo "OK clipflow v1.4.2 collage"
fi

build_one numeric "$PICTURES/numeric clock 2026" "$HOME/dev/Linux-Numeric-Date-And-Clock"
build_one easehub "$PICTURES/easehub 2026" "$HOME/dev/comfort-control-easehub"

echo ""
echo "=== Downloads/socials post collages ==="
ls -lh "$SOCIAL_DIR"
