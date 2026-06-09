## 1.4.9 — 2026-06-10

**Fix disable-time race in the clipboard fallback reader.**

- Guard the clipboard fallback path against the extension being disabled while
  an asynchronous external read is still in flight. Previously a pending
  callback could hit `this._clipboard = null` and raise
  `TypeError: this._clipboard is null` in the Shell journal, leaving the
  extension in an INACTIVE state until the session was restarted (seen during
  in-session upgrades from 1.4.7 to 1.4.8).

## 1.4.8 — 2026-06-10

**Journal-clean styling, release-validation coverage, and project credits.**

- Remove the invalid `icon-size: inherit` rule from the panel-icon stylesheet;
  GNOME Shell logged "Ignoring length property that isn't a number" on every
  panel icon repaint. Icon size is set programmatically, so there is no visual
  change.
- Run the Release Validate workflow for `stylesheet.css` and `locale/**`
  changes so files shipped in the release zip can no longer bypass the
  required `validate` status check.
- Add a Credits & Acknowledgements section to the README and a new
  `CONTRIBUTORS.md` documenting the maintainer and AI-assisted development
  (OpenAI Codex, Cursor Agent) with trademark-compliant, logo-free attribution.

## 1.4.7 — 2026-06-09

**Immediate paste response and bounded native clipboard monitoring.**

- Remove redundant panel/history-window insertion delays and reduce the
  post-focus allowance from 220 ms to 60 ms.
- Run History Window insertion entirely in a helper process so xclip, xdotool,
  and target applications cannot block its interface.
- Resolve and inspect the destination window once per insertion instead of
  repeatedly launching xdotool and xprop for the same target.
- Allow clipboard interfaces that provide either `get_text` or `get_content`;
  previously the polling path incorrectly required both methods.
- Permit only one asynchronous clipboard read per selection, preventing the
  500 ms poller from building a callback backlog when an owner responds slowly.
- Bound `get_text` and MIME fallback requests, ignore late callbacks safely,
  and avoid removing GLib timeout sources after they have already fired.
- Add a short-lived `xclip`/`wl-paste` reader helper for Shell builds whose
  St.Clipboard API exposes no external clipboard MIME types.
- Fix capture at the configured history limit: replacing the oldest entry no
  longer prevents persistence or causes the same clipboard to be reprocessed.
- Reduce history persistence debounce from one second to 100 ms and History
  Window file-refresh debounce from 350 ms to 50 ms.
- Restore privacy-safe operational warnings in the Shell journal without
  logging clipboard contents or previews.

## 1.4.6 — 2026-06-08

**Non-blocking insert helpers and reliable terminal paste targeting.**

- Move clipboard ownership and keyboard insertion out of the GNOME Shell process
  so a stalled external command cannot freeze the panel.
- Resolve one live X11 target per insertion and prefer the active app at paste
  time; the app captured before opening ClipFlow is the fallback.
- Detect terminal applications from `WM_CLASS` via `xprop`, including kitty
  windows whose title is Codex or another agent name.
- Use terminal paste accelerators (`Ctrl+Shift+V`, or `Shift+Insert` for
  xterm/rxvt-style terminals) and never send plain `Ctrl+V` to a terminal.
- Preserve the full environment when starting helper processes and return
  meaningful failure exit codes.
- Add an X11 terminal insertion smoke test for kitty and GNOME Terminal.

## 1.4.4 (unreleased; included in 1.4.6) — 2026-06-07

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
