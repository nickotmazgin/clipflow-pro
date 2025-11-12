# ClipFlow Pro 1.2.7 (GNOME 45+ ESM)

- Ported runtime to GNOME 45+ ES Modules (ESM) using `resource:///` and `gi://` imports.
- Preferences implemented via `fillPreferencesWindow()` and attached as a GTK child to preserve libadwaita header buttons (close/minimize).
- `metadata.json` now lists only tested shells: ["45", "46", "47"].
- About tab shows the version from `metadata.json` (`version-name`).
- Packaging: flat zip with top‑level files for extensions.gnome.org reviewers.

Notes
- This package targets GNOME Shell 45+. For 42–44, use older releases/branches.
- Wayland: if the history is empty immediately after login, wait a few seconds or toggle the extension once; the extension already warm‑polls and retries during shell startup.

## Dist Artifacts

- Flat zip for EGO: `dist/clipflow-pro@nickotmazgin.github.io.shell-extension.zip`
  - Includes: `metadata.json`, `extension.js`, `prefs.js`, `stylesheet.css`, `schemas/`, `icons/`, `LICENSE`.

## GitHub Release (commands)

```bash
# Tag and push
git tag -f v1.2.7
git push -f origin v1.2.7

# Create release with assets
gh release create v1.2.7 \
  dist/clipflow-pro@nickotmazgin.github.io.shell-extension.zip \
  dist/clipflow-pro-source.zip \
  -t "ClipFlow Pro 1.2.7 (GNOME 45+ ESM)" \
  -n "$(sed -n '/^## \\[1.2.7\\]/,/^---/p' CHANGELOG.md | sed '1d;$d')"

# (Optional) Delete older release/tag — use with care
# gh release delete v1.2.6 --yes
# git tag -d v1.2.6 && git push origin :refs/tags/v1.2.6
```
