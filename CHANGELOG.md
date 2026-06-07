## 1.4.4 — 2026-06-07

**Fix paste failing after target window closes (screen recording, reopened terminals).**

- Validate insert-target window IDs before paste; discard stale/dead X11 windows
- Prefer live focus window over stale saved ID when capturing paste target
- Fix `xclip` stdin on GNOME 46 GJS (`communicate_utf8` instead of deprecated `UnixOutputStream`)

## 1.4.3 — 2026-06-07

**Reliable paste into agent terminals, chats, and special inputs (Codex, etc.).**

### Paste / insert
- Set system clipboard as **plain text only** via `xclip` / `wl-copy` before insert (avoids stale image/HTML formats confusing target apps).
- **Auto-detect** agent terminals and similar UIs (e.g. Codex) that treat Ctrl+V as image paste — use **direct keystroke typing** (`xdotool type`) instead.
- Shared insert helper (`clipboardInsert.js`) used by the history window; panel menu logic is inlined for GNOME Shell ESM compatibility.
- Capture insert-target window before opening the history window so paste returns to the prior app.
- History window now receives the target window ID (env + persisted file), activates it before insert, and matches panel timing.
- Fixed history window launch when passing insert-target env (merge full environment so gjs/DISPLAY are preserved).

## End of GNOME Shell 43–44 support — 2026-06-02

**ClipFlow Pro no longer builds, tests, or maintains a GNOME Shell 43–44 package.**

- Removed `build-legacy.sh`, `install-legacy.sh`, `prefs.js`, and the `build-43-44/` tree
- Release packaging now produces **GNOME 45–50** zips only
- Deleted the `gnome43-44` development branch
- **Minimum supported Shell:** GNOME **45**
- Removed the **v1.4.2** `*-gs43-44.zip` asset from the GitHub release; legacy builds are no longer distributed

## 1.4.2 — 2026-06-05

**Shortcuts, bulk delete, panel delete, History Window header, About maintenance, and refreshed docs.**

### Shortcuts (Settings → Shortcuts)
- Clearer Enhanced Copy / Enhanced Paste descriptions matching real behavior.
- Exposed Classic panel menu shortcuts (filter all/pinned/starred, toggle pin/star on top item).
- New optional shortcuts: **Open Recent Clips Menu**, **Paste Latest Entry**, **Paste Previous Entry**.
- Removed duplicate “Keyboard Shortcuts” section header.

### Delete controls
- Fixed History Window multi-select delete (checkbox selections now remove all chosen entries; prevents extension stale-save overwrite).
- Panel right-click recent clips: **Delete** row under each entry.

### History Window
- Header bar **Settings** and **About** buttons open ClipFlow preferences on the matching tab.

### About tab
- **Maintenance → Reset to Defaults** now asks for confirmation before resetting.
- Success toast after reset completes.

### Documentation
- New HD JPEG collage (8 tiles, About Maintenance last) and five-shot highlight gallery in README (`screenshots/v1.4.2/`).

## 1.4.1 — 2026-06-02

**Stability and workflow release focused on reliable insert/paste behavior and clean menu semantics.**

### Paste/insert reliability
- Fixed right-click recent-clip entries to run full activate behavior (copy + insert), not copy-only.
- Added focused target window tracking and restore for X11 (`xdotool`), including persisted target window ID.
- Added `enable-xdotool-insert` setting (default on) for explicit copy-only fallback when desired.
- History Window now supports **Insert** and **Insert + Enter** actions for selected entries.

### History Window quality improvements
- Unified ordering with panel history: pinned first, starred second, newest timestamps next.
- Added per-entry selection checkboxes, clearer status line, and “last copied” preview context.
- Added right-click row context menu (Copy, Insert, Insert + Enter, Pin/Star, Delete).
- Double-click now inserts into the focused field for faster workflows.
- Reduced UI flicker with signature-based reload checks and lower-frequency safety polling.

### Shortcuts/menu cleanup
- Removed deprecated quick-menu workflow and `show-menu-shortcut` (`Super+Shift+V`).
- Updated panel context action to **Open History Window (Full Clipboard)**.
- Synced README/install/preferences/schema text with current behavior and shortcuts.

## 1.4.0 — 2026-05-31

**Current release for GNOME Shell 45–50 (ESM).**

### History Window
- Full desktop history browser (CopyQ-style): search, scroll, copy, pin, star, delete, clear all
- **Left-click** panel icon → history window; **Super+Shift+H** shortcut
- Syncs via `~/.config/clipflow-pro/history.json`

### Panel and menus
- **Right-click** → recent clips with Show more / Show less paging

### Settings (GNOME 46)
- Preferences close button on Zorin (ToolbarView)
- Rendering Mode under General → Menu and Rendering

### Fixes
- ESM compatibility for GNOME 46 (`Gio.File` paths, no `Me` reference)
- Enhanced scroll menu and pagination on GNOME 45+

Download only from [latest release](https://github.com/nickotmazgin/clipflow-pro/releases/latest).
