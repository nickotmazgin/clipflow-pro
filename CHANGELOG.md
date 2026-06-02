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

**Current release for GNOME Shell 45–50 (ESM) and legacy 43–44.**

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
