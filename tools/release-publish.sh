#!/usr/bin/env bash
# Create a signed release tag and push — GitHub Actions publishes the zip.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if ! git -C "$REPO_ROOT" config --get tag.gpgsign >/dev/null 2>&1; then
  echo "Run ./tools/setup-release-signing.sh first."
  exit 1
fi

echo "=== Sync main ==="
git fetch origin
git checkout main
git pull --ff-only origin main

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Working tree has local changes. Commit or stash before releasing."
  git status --short
  exit 1
fi

echo "=== Build + validate ==="
./create-release-zips.sh
make release-validate

VERSION=$(python3 -c "import json; m=json.load(open('metadata.json')); print((m.get('version-name') or '').split()[0])")
TAG="v${VERSION}-gnome45-50"
ZIP="dist/clipflow-pro@nickotmazgin.github.io-${VERSION}-gs45-50.zip"

if [[ ! -f "$ZIP" ]]; then
  echo "Missing zip: $ZIP"
  exit 1
fi

echo ""
echo "Release tag : $TAG"
echo "Zip         : $ZIP"
echo "Commit      : $(git rev-parse --short HEAD)"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo ""
  echo "Tag $TAG already exists locally."
  if [[ "${CLIPFLOW_RELEASE_YES:-}" != "1" ]]; then
    read -r -p "Delete and recreate signed tag on HEAD? [y/N] " ans
    [[ "${ans,,}" == "y" ]] || { echo "Aborted."; exit 1; }
  fi
  git tag -d "$TAG"
fi

if git ls-remote --exit-code origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo ""
  echo "Remote tag $TAG exists."
  if [[ "${CLIPFLOW_RELEASE_YES:-}" != "1" ]]; then
    read -r -p "Delete remote tag and release, then republish? [y/N] " ans
    [[ "${ans,,}" == "y" ]] || { echo "Aborted."; exit 1; }
  fi
  gh release delete "$TAG" --yes 2>/dev/null || true
  git push origin ":refs/tags/${TAG}" || true
fi

NOTES=$(python3 tools/release_notes_from_changelog.py "$VERSION" | head -20)
MSG="ClipFlow Pro ${VERSION}

${NOTES}"

echo "=== Creating signed tag ==="
git tag -s "$TAG" -m "$MSG"

echo "=== Verifying tag signature locally ==="
git verify-tag "$TAG"

echo "=== Pushing tag (triggers .github/workflows/release-publish.yml) ==="
git push origin "$TAG"

echo ""
echo "OK pushed $TAG — watch Actions, then confirm on GitHub Releases:"
echo "  https://github.com/nickotmazgin/clipflow-pro/releases/tag/${TAG}"
echo "Look for: Verified tag + Immutable release + attested zip."
echo "(Release notes are written via --notes-file in CI to avoid shell backtick issues.)"
