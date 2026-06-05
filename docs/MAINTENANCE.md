# Repository Maintenance

This project enforces protected `main` with PR-only changes. Use the following guidance for routine cleanup.

## Prune local stale refs

```bash
git remote prune origin
```

## Remove stale remote branches (after verifying they are safe to delete)

```bash
# Example: delete a remote branch
git push origin --delete codex/screenshots-gallery
```

## Releases and tags (signed + automated)

ClipFlow Pro uses **SSH-signed tags** (GitHub **Verified** checkmark), **immutable releases**, and **GitHub Actions** to build and publish the zip when a tag is pushed.

### One-time signing setup

```bash
./tools/setup-release-signing.sh
```

If `gh` needs the signing scope:

```bash
gh auth refresh -h github.com -s admin:ssh_signing_key
gh ssh-key add ~/.ssh/id_ed25519.pub --title "ClipFlow Pro release signing" --type signing
```

Or add the same public key manually: GitHub → **Settings → SSH and GPG keys → New SSH key → Signing key**.

Repo-local git config (set by the setup script):

- `gpg.format=ssh`
- `user.signingkey=~/.ssh/id_ed25519.pub`
- `tag.gpgsign=true`

### Publish a release (long-term flow)

1. Merge all changes to `main` (metadata + CHANGELOG updated).
2. From a clean `main`:

```bash
./tools/release-publish.sh
```

3. Confirm on GitHub Releases:
   - Tag shows **Verified**
   - Release shows **Immutable** (enabled for this repo)
   - Zip built by Actions matches `dist/*-gs45-50.zip`

Non-interactive republish (e.g. retag same version):

```bash
CLIPFLOW_RELEASE_YES=1 ./tools/release-publish.sh
```

Workflow: `.github/workflows/release-publish.yml` (trigger: `v*-gnome45-50` tags).

### Delete broken releases

```bash
gh release list -L 100
gh release delete v1.2.6 --yes
git push origin :refs/tags/v1.2.6
```

## Packaging

- Flat zip: `make pack` or `make dist` → `dist/clipflow-pro@nickotmazgin.github.io.shell-extension.zip`
- Release zip: `./create-release-zips.sh` → `dist/*-gs45-50.zip` (GNOME 45–50 only)
- Source zip: `dist/clipflow-pro-source.zip`
- Validate: `make release-validate`

## Distribution

- Publish the **45–50** zip on the GitHub Releases page (via signed tag push).
- GNOME Shell **43–44** is discontinued; do not rebuild or advertise legacy packages.
- Release notes are generated from `CHANGELOG.md` (`tools/release_notes_from_changelog.py`).
