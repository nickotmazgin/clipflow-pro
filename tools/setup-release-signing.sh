#!/usr/bin/env bash
# One-time setup: SSH tag signing for Verified GitHub releases.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Prefer the GitHub auth key (ssh config IdentityFile for github.com), not a stray default key.
if [[ -z "${CLIPFLOW_SIGNING_KEY:-}" ]]; then
  if [[ -f "${HOME}/.ssh/id_ed25519_github.pub" ]]; then
    KEY_PUB="${HOME}/.ssh/id_ed25519_github.pub"
  else
    KEY_PUB="${HOME}/.ssh/id_ed25519.pub"
  fi
else
  KEY_PUB="${CLIPFLOW_SIGNING_KEY}"
fi

SIGN_EMAIL="${CLIPFLOW_SIGN_EMAIL:-nickotmazgin@gmail.com}"
ALLOWED_SIGNERS="${HOME}/.ssh/allowed_signers"

if [[ ! -f "$KEY_PUB" ]]; then
  echo "Missing signing public key: $KEY_PUB"
  exit 1
fi

PUB_LINE="$(cat "$KEY_PUB")"
FPR="$(ssh-keygen -lf "$KEY_PUB" | awk '{print $2}')"
echo "Using signing key: $KEY_PUB ($FPR)"

echo ""
echo "=== Repo-local git signing config ($REPO_ROOT) ==="
git -C "$REPO_ROOT" config gpg.format ssh
git -C "$REPO_ROOT" config user.signingkey "$KEY_PUB"
git -C "$REPO_ROOT" config user.email "$SIGN_EMAIL"
git -C "$REPO_ROOT" config tag.gpgsign true
git -C "$REPO_ROOT" config gpg.ssh.allowedSignersFile "$ALLOWED_SIGNERS"
echo "OK signing key, email=$SIGN_EMAIL, tag.gpgsign=true"

echo ""
echo "=== allowed_signers ($ALLOWED_SIGNERS) ==="
ENTRY="${SIGN_EMAIL} namespaces=\"git\" ${PUB_LINE}"
if [[ -f "$ALLOWED_SIGNERS" ]] && grep -qF "$PUB_LINE" "$ALLOWED_SIGNERS" 2>/dev/null; then
  echo "OK public key already listed"
else
  mkdir -p "$(dirname "$ALLOWED_SIGNERS")"
  printf '%s\n' "$ENTRY" >> "$ALLOWED_SIGNERS"
  chmod 600 "$ALLOWED_SIGNERS"
  echo "OK appended allowed_signers entry"
fi

echo ""
echo "=== GitHub: Authentication vs Signing key ==="
echo "Your GitHub key \"zorin laptop 2025\" ($FPR) is an Authentication key."
echo "For the green Verified checkmark on release tags, add the SAME public key"
echo "once more as type **Signing key** (GitHub allows both on one key):"
echo "  https://github.com/settings/ssh/new"
echo "  Key type: Signing key"
echo "Paste this public key:"
echo ""
cat "$KEY_PUB"
echo ""

if gh api user/ssh_signing_keys --jq 'length' >/dev/null 2>&1; then
  if gh api user/ssh_signing_keys --jq '.[].key' | grep -qF "$PUB_LINE"; then
    echo "OK: signing key already registered on GitHub via gh"
  else
    echo "Upload with gh (optional):"
    echo "  gh auth refresh -h github.com -s admin:ssh_signing_key"
    echo "  gh ssh-key add \"$KEY_PUB\" --title \"zorin laptop 2025 signing\" --type signing"
  fi
fi

echo ""
echo "=== Test local signed tag ==="
TEST_TAG="clipflow-sign-test-$(date +%s)"
if git -C "$REPO_ROOT" tag -s "$TEST_TAG" -m "signing smoke test" HEAD; then
  git -C "$REPO_ROOT" verify-tag "$TEST_TAG" && echo "OK local verify-tag passed (no passphrase if key is in ssh-agent)"
  git -C "$REPO_ROOT" tag -d "$TEST_TAG" >/dev/null
else
  echo "WARN: signed tag failed. Load your GitHub key once:"
  echo "  ssh-add ~/.ssh/id_ed25519_github"
fi

echo ""
echo "Done. After Signing key is on GitHub, publish with:"
echo "  CLIPFLOW_RELEASE_YES=1 ./tools/release-publish.sh"
