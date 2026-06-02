#!/usr/bin/env bash
# Rebuild all extension collages + social exports for repos and ~/Downloads.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/make_collage_2026.py"
VERTICAL="$(cd "$(dirname "$0")" && pwd)/make_collage_vertical.py"
SOCIAL_DIR="${HOME}/Downloads/socials post collages"
PICTURES="${HOME}/Pictures/Screenshots"
CLIPFLOW_REPO="${CLIPFLOW_REPO:-$HOME/dev/clipflow-pro}"

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

# ClipFlow: main grid in tools/assets; published README collage is collage-v1.4.1-2026.png
if [[ -d "$PICTURES/clipflow pro 2026" ]]; then
  python3 "$SCRIPT" clipflow "$PICTURES/clipflow pro 2026" \
    "$CLIPFLOW_REPO/tools/assets/collage-main-grid-2026.png"
fi
if [[ -f "$CLIPFLOW_REPO/tools/assets/collage-main-grid-2026.png" ]]; then
  python3 "$VERTICAL" \
    --main "$CLIPFLOW_REPO/tools/assets/collage-main-grid-2026.png" \
    "$CLIPFLOW_REPO/screenshots/v1.4.1/1.jpg" \
    "$CLIPFLOW_REPO/screenshots/v1.4.1/2.jpg" \
    "$CLIPFLOW_REPO/screenshots/v1.4.1/3.jpg" \
    -o "$CLIPFLOW_REPO/screenshots/collage-v1.4.1-2026.png" \
    --social-dir "$SOCIAL_DIR"
  /bin/cp -f "$SOCIAL_DIR/clipflow-pro-v141-social-1280x640.png" \
    "$CLIPFLOW_REPO/.github/social-preview.png"
  echo "OK clipflow v1.4.1 stack"
fi

build_one numeric "$PICTURES/numeric clock 2026" "$HOME/dev/Linux-Numeric-Date-And-Clock"
build_one easehub "$PICTURES/easehub 2026" "$HOME/dev/comfort-control-easehub"

echo ""
echo "=== Downloads/socials post collages ==="
ls -lh "$SOCIAL_DIR"
