#!/usr/bin/env bash
set -euo pipefail

# One-command release helper for ClipFlow Pro.
# Builds both GNOME 45–47 and GNOME 43–44 packages, bumps versions, and publishes GitHub releases.
#
# Usage:
#   tools/release.sh <version-name> [--ver45 <int>] [--ver43 <int>] [--repo43 <path>] [--clean]
# Example:
#   tools/release.sh 1.3.3 --ver45 28 --ver43 29 --repo43 ../clipflow-pro-gnome43 --clean

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO43="${ROOT_DIR}/../clipflow-pro-gnome43"
VERNAME=""
VER45=""
VER43=""
CLEAN=false

die() { echo "Error: $*" >&2; exit 1; }

[[ $# -ge 1 ]] || die "version-name is required (e.g., 1.3.3)"
VERNAME="$1"; shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ver45) VER45="$2"; shift 2;;
    --ver43) VER43="$2"; shift 2;;
    --repo43) REPO43="$2"; shift 2;;
    --clean) CLEAN=true; shift;;
    *) die "Unknown arg: $1";;
  esac
done

[[ -d "$REPO43" ]] || die "GNOME43 repo not found: $REPO43"

# Require gh
command -v gh >/dev/null 2>&1 || die "GitHub CLI (gh) required."

echo "==> Preparing versions"

# Bump 45–47 metadata version-name and optional version int
jq \
  --arg v "$VERNAME" \
  --argjson n45 "${VER45:-null}" \
  '(."version-name"=$v) | (if $n45!=null then .version=$n45 else . end)' \
  "$ROOT_DIR/metadata.json" > "$ROOT_DIR/metadata.json.tmp"
mv "$ROOT_DIR/metadata.json.tmp" "$ROOT_DIR/metadata.json"

# Bump 43–44 metadata
jq \
  --arg v "$VERNAME 43.44" \
  --argjson n43 "${VER43:-null}" \
  '(."version-name"=$v) | (if $n43!=null then .version=$n43 else . end)' \
  "$REPO43/metadata.json" > "$REPO43/metadata.json.tmp"
mv "$REPO43/metadata.json.tmp" "$REPO43/metadata.json"

echo "==> Building 45–47"
pushd "$ROOT_DIR" >/dev/null
./build.sh
mkdir -p dist
ZIP45="dist/clipflow-pro@nickotmazgin.github.io-${VERNAME}-gs45-47.zip"
(cd build && zip -9 -r "../${ZIP45}" . >/dev/null)
popd >/dev/null

echo "==> Building 43–44"
pushd "$REPO43" >/dev/null
./build.sh
mkdir -p dist
ZIP43="dist/clipflow-pro@nickotmazgin.github.io-${VERNAME}-gs43-44.zip"
(cd build && zip -9 -r "../${ZIP43}" . >/dev/null)
popd >/dev/null

TAG45="v${VERNAME}-gnome45-47"
TAG43="v${VERNAME}-gnome43-44"

if $CLEAN; then
  echo "==> Deleting any existing releases/tags for ${TAG45} and ${TAG43} (ignore errors)"
  gh release delete "$TAG45" -y || true
  gh release delete "$TAG43" -y || true
  git -C "$ROOT_DIR" push origin ":refs/tags/${TAG45}" || true
  git -C "$ROOT_DIR" push origin ":refs/tags/${TAG43}" || true
fi

echo "==> Creating GitHub releases"
pushd "$ROOT_DIR" >/dev/null
gh release create "$TAG45" "$ZIP45" \
  --title "ClipFlow Pro ${VERNAME} (GNOME 45–47)" \
  --notes "- Minimal rows: Copy + More (Pin/Star/Clean Copy/Delete in overflow)
- Duplicate header removed
- Pinned strip capped (6)
- Clipboard probing capped; improved behavior during screenshots"
popd >/dev/null

pushd "$REPO43" >/dev/null
gh release create "$TAG43" "$ZIP43" \
  --title "ClipFlow Pro ${VERNAME} (GNOME 43–44)" \
  --notes "- Minimal rows: Copy + More (overflow)
- Duplicate header removed
- Pinned strip capped (6)
- Bounded MIME fallback; improved behavior with screenshot tools"
popd >/dev/null

echo "==> Done"
