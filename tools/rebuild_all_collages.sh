#!/usr/bin/env bash
# Rebuild all extension collages + social exports for repos and ~/Downloads.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/make_collage_2026.py"
SOCIAL_DIR="${HOME}/Downloads/socials post collages"
PICTURES="${HOME}/Pictures/Screenshots"

mkdir -p "$SOCIAL_DIR"

build_one() {
  local kind="$1" src="$2" repo="$3"
  python3 "$SCRIPT" "$kind" "$src" \
    "$repo/screenshots/collage-2026.png" \
    --social-dir "$SOCIAL_DIR" \
    --github-social "$repo/.github/social-preview.png"
  # EaseHub also keeps social in screenshots/ for README link
  if [[ "$kind" == "easehub" ]]; then
    /bin/cp -f "$SOCIAL_DIR/comfort-control-easehub-social-1280x640.png" \
      "$repo/screenshots/social-preview-2026.png"
  fi
  echo "OK $kind"
}

build_one clipflow "$PICTURES/clipflow pro 2026" "$HOME/dev/clipflow-pro"
build_one numeric "$PICTURES/numeric clock 2026" "$HOME/dev/Linux-Numeric-Date-And-Clock"
build_one easehub "$PICTURES/easehub 2026" "$HOME/dev/comfort-control-easehub"

echo ""
echo "=== Downloads/socials post collages ==="
ls -lh "$SOCIAL_DIR"
