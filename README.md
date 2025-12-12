# ClipFlow Pro

[What’s New in 1.3.8](CHANGELOG.md)

[![Release](https://img.shields.io/github/v/release/nickotmazgin/clipflow-pro)](https://github.com/nickotmazgin/clipflow-pro/releases)
[![Downloads](https://img.shields.io/github/downloads/nickotmazgin/clipflow-pro/total?label=downloads)](https://github.com/nickotmazgin/clipflow-pro/releases)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![GNOME 43–44](https://img.shields.io/badge/GNOME-43%E2%80%9344-blue?logo=gnome&logoColor=white)](#compatibility)
[![GNOME 45–47](https://img.shields.io/badge/GNOME-45%E2%80%9347-blue?logo=gnome&logoColor=white)](#compatibility)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ff5c93?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/nickotmazgin)

Clipboard history manager for GNOME Shell (UUID `clipflow-pro@nickotmazgin.github.io`).

## Compatibility

- GNOME 43–44: Classic UI by default (Enhanced available via toggle)
- GNOME 45–47: Enhanced UI with container + pagination (Classic available)
- Features:
  - Pinned strip, Starred section, Others list
  - Quick filters (All / Pinned / Starred) with active highlighting
  - Per‑row actions: Pin, Star, Copy, Copy Cleaned, Delete
  - Show more/less for large histories
  - Keyboard shortcuts for filters and top item toggles
  - Export/Import, Purge duplicates, Pin Top 3/5, Unpin All
  - Reset to Defaults in Preferences → About → Maintenance

## Links

- GitHub Releases: https://github.com/nickotmazgin/clipflow-pro/releases
- Issues & Support: https://github.com/nickotmazgin/clipflow-pro/issues

## Installation (local dev)

```
./build.sh
mkdir -p ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io
cp -r build/* ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
# Restart GNOME Shell: Alt+F2 → r → Enter
```

## Packaging

- Run `./build-legacy.sh` to prepare a 43–44 build in `build-43-44/`.
- Run `./create-release-zips.sh` to produce two zips in `dist/`:
  - 43–44 zip with `shell-version: ["43","44"]`
  - 45–47 zip with `shell-version: ["45","46","47"]`
  - Publish the zips on the GitHub Releases page.

### Compliance notes (1.3.7)

- No Gtk imports in the shell process (extension.js)
- No spawn usage; GNOME Shell APIs only for clipboard
- Async file reads via `Gio.File.load_contents_async`
- Logs gated by `enable-debug-logs` (globalThis.__CFP_DEBUG)
- 45–47: preferences shipped as ES modules (ESM)
- 43–44: fixed panel watcher syntax and removed duplicate schema keys
- No `stylesheet` field in `metadata.json`

This branch targets GNOME 45–47. For GNOME 43–44, see the `gnome43-44` branch.

## Quick Start

- Open clipboard menu: Super+Shift+V
- Click an entry to copy; right‑click for per‑row actions (Pin/Star/Copy/Clean/Delete)
- Use Actions submenu (bottom): Sort/Filter, Capture PRIMARY, Pause Monitoring, Export/Import, Maintenance

### Sorting & Pagination

- Enhanced UI: pinned → starred → newest-first; paginated by `entries-per-page`
- Classic UI: same ordering with quick filters and “Show more/less” batching


## Screenshots (1.3.5)

![Overview collage (1.3.5)](docs/screenshots/1.3.5/collage-3x3.jpg)

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/1.3.5/1.png" alt="ClipFlow Pro screenshot 1" width="300"><br><sub>1</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.5/2.png" alt="ClipFlow Pro screenshot 2" width="300"><br><sub>2</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.5/3.png" alt="ClipFlow Pro screenshot 3" width="300"><br><sub>3</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/1.3.5/4.png" alt="ClipFlow Pro screenshot 4" width="300"><br><sub>4</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.5/5.png" alt="ClipFlow Pro screenshot 5" width="300"><br><sub>5</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.5/6.png" alt="ClipFlow Pro screenshot 6" width="300"><br><sub>6</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/1.3.5/7.png" alt="ClipFlow Pro screenshot 7" width="300"><br><sub>7</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.5/8.png" alt="ClipFlow Pro screenshot 8" width="300"><br><sub>8</sub></td>
    <td align="center"><img src="docs/screenshots/1.3.5/9.png" alt="ClipFlow Pro screenshot 9" width="300"><br><sub>9</sub></td>
  </tr>
</table>

## Support

If you find this project useful, you can support development:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ff5c93?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/nickotmazgin)
[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)
