# ClipFlow Pro (GNOME 43–44)

Unified Classic+ build for GNOME 43–44 under the UUID `clipflow-pro@nickotmazgin.github.io`.

## Compatibility

- GNOME 43–44: Classic UI is the default (Enhanced available via toggle)
- Classic+ includes:
  - Pinned strip, Starred section, Others list
  - Quick filters (All / Pinned / Starred) with active highlighting
  - Per‑row actions: Pin, Star, Copy, Copy Cleaned, Delete
  - Show more/less for large histories
  - Keyboard shortcuts for filters and top item toggles
  - Export/Import, Purge duplicates, Pin Top 3/5, Unpin All
  - Reset to Defaults in Preferences → About → Maintenance

## Installation (local dev)

```
./build.sh
mkdir -p ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io
cp -r build/* ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
# Restart GNOME Shell: Alt+F2 → r → Enter
```

## Packaging (extensions.gnome.org)

- This build’s `metadata.json` declares `shell-version: ["43","44"]`.
- Upload this zip alongside the GNOME 45–47 ESM zip under the same UUID.
- EGO will serve the correct build automatically based on the user’s GNOME Shell version.


## Screenshots (1.3.3)

![Overview collage (1.3.3)](https://raw.githubusercontent.com/nickotmazgin/clipflow-pro/main/docs/screenshots/1.3.3/collage-3x3.jpg)

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/1.3.3/1.png" alt="ClipFlow Pro screenshot 1" width="300"><br><sub>1</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.3/2.png" alt="ClipFlow Pro screenshot 2" width="300"><br><sub>2</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.3/3.png" alt="ClipFlow Pro screenshot 3" width="300"><br><sub>3</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/1.3.3/4.png" alt="ClipFlow Pro screenshot 4" width="300"><br><sub>4</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.3/5.png" alt="ClipFlow Pro screenshot 5" width="300"><br><sub>5</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.3/6.png" alt="ClipFlow Pro screenshot 6" width="300"><br><sub>6</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/1.3.3/7.png" alt="ClipFlow Pro screenshot 7" width="300"><br><sub>7</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.3/8.png" alt="ClipFlow Pro screenshot 8" width="300"><br><sub>8</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.3/9.png" alt="ClipFlow Pro screenshot 9" width="300"><br><sub>9</sub></td>
  </tr>
</table>
