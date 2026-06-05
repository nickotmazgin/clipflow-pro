#!/usr/bin/env bash
# One-time setup: SSH tag signing for Verified GitHub releases.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_PUB="${CLIPFLOW_SIGNING_KEY:-${HOME}/.ssh/id_ed25519.pub}"

if [[ ! -f "$KEY_PUB" ]]; then
  echo "Missing signing public key: $KEY_PUB"
  echo "Create one: ssh-keygen -t ed25519 -C \"your@email\" -f ~/.ssh/id_ed25519"
  exit 1
fi

echo "=== Repo-local git signing config ($REPO_ROOT) ==="
git -C "$REPO_ROOT" config gpg.format ssh
git -C "$REPO_ROOT" config user.signingkey "$KEY_PUB"
git -C "$REPO_ROOT" config tag.gpgsign true
echo "OK tag.gpgsign=true, gpg.format=ssh"

echo ""
echo "=== GitHub SSH signing key ==="
if gh api user/ssh_signing_keys --jq 'length' >/dev/null 2>&1; then
  COUNT=$(gh api user/ssh_signing_keys --jq 'length')
  FPR=$(ssh-keygen -lf "$KEY_PUB" 2>/dev/null | awk '{print $2}' || true)
  if gh api user/ssh_signing_keys --jq ".[].key" | grep -qF "$(cat "$KEY_PUB")"; then
    echo "OK signing key already on GitHub"
  else
    echo "Uploading signing key..."
    gh ssh-key add "$KEY_PUB" --title "ClipFlow Pro release signing" --type signing
    echo "OK uploaded"
  fi
else
  echo "GitHub CLI needs the admin:ssh_signing_key scope."
  echo "Run:"
  echo "  gh auth refresh -h github.com -s admin:ssh_signing_key"
  echo "  gh ssh-key add \"$KEY_PUB\" --title \"ClipFlow Pro release signing\" --type signing"
  echo ""
  echo "Or add manually: GitHub → Settings → SSH and GPG keys → New SSH key → Signing key"
  echo "Paste:"
  cat "$KEY_PUB"
fi

echo ""
echo "=== Test local signed tag (dry run) ==="
TEST_TAG="clipflow-sign-test-$(date +%s)"
if git -C "$REPO_ROOT" tag -s "$TEST_TAG" -m "signing smoke test" HEAD 2>/dev/null; then
  git -C "$REPO_ROOT" verify-tag "$TEST_TAG" && echo "OK local verify-tag passed"
  git -C "$REPO_ROOT" tag -d "$TEST_TAG" >/dev/null
else
  echo "WARN: could not create signed tag (ssh-agent / key passphrase?)."
  echo "Ensure your SSH key is loaded: ssh-add ~/.ssh/id_ed25519"
fi

echo ""
echo "Done. Publish releases with: ./tools/release-publish.sh"
