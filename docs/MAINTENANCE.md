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

## Releases and tags

- Create releases from merged `main` using the `dist/` artifacts.
- Delete broken/obsolete releases and tags with GitHub CLI:

```bash
# List
gh release list -L 100

# Delete a release
gh release delete v1.2.6 --yes

# Delete a tag
git push origin :refs/tags/v1.2.6
```

## Packaging

- Flat zip: `make pack` or `make dist` → `dist/clipflow-pro@nickotmazgin.github.io.shell-extension.zip`
- Source zip: `dist/clipflow-pro-source.zip`

## Distribution

- Publish zips on the GitHub Releases page.
- Include tested shell versions in release notes.
