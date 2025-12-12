## 1.3.4 — 2025-12-05

- Compliance fixes:
  - Removed `stylesheet` from metadata.json (43–44 build)
  - Removed Gtk usage in shell process
  - Removed all spawn-based clipboard fallbacks (xclip/xsel)
  - Gated debug logs behind `enable-debug-logs` setting
  - Switched history/import file reads to async with `Gio.File.load_contents_async`
- Sorting/pagination verified: pinned, then starred, then newest-first; Enhanced UI paginates; Classic keeps Show more batching
- 45–47 build: mirrored async history load and cleanup

## 1.3.2 — 2025-11-27

- UI simplified: Copy + More (Pin/Star/Clean/Delete) in overflow
- Duplicate header removed; pinned chip strip capped (6)
- Stability: bounded clipboard MIME probing; lighter behavior with screenshot tools

## 1.3.0 — Unified UUID & Classic+

- UUID unified to `clipflow-pro@nickotmazgin.github.io`
- Classic+ default on GNOME 43–44:
  - Pinned strip, Starred section, Others list
  - Quick filters (All / Pinned / Starred) with active highlighting
  - Per‑row actions: Pin, Star, Copy, Copy Cleaned, Delete
  - Show more / Show less
  - Shortcuts for filters and top item toggles
  - Export/Import, Purge duplicates, Pin Top 3/5, Unpin All
  - Reset to Defaults in Preferences → About → Maintenance
