Title

ClipFlow Pro

Description

Modern clipboard manager for GNOME Shell 45–47. ClipFlow Pro records your history, adds instant search and smart filters, and keeps the menu responsive on both Xorg and Wayland. No background daemons or network chatter — every entry stays local in your user config.

About

ClipFlow Pro 1.3.7

- Dual packages for 43–44 and 45–47 (same UUID)
- 45–47: Preferences shipped as ES modules (fixes prefs SyntaxError)
- 43–44: Fixed gjs syntax in panel watcher; removed duplicate schema keys
- Compliance: no Gtk in shell process, no spawn, async file reads, logs gated by `enable-debug-logs`

Browse/search clipboard history, pin/star favorites, and open with Super+Shift+V. Compact mode available. History is stored locally in ~/.config/clipflow-pro.

Release Notes

Classic + Enhanced, GNOME 43–47 (one UUID)

- One UUID (clipflow-pro@nickotmazgin.github.io), two uploads:
  - GNOME 43–44 (legacy GJS): Classic default
  - GNOME 45–47 (ESM): Enhanced default
- Classic (both builds): pinned strip, starred section, quick filters, per‑row actions, show more/less, shortcuts, export/import, purge dups, pin top 3/5, unpin all, reset defaults
- Enhanced (45+): per‑row Copy & Clean Copy, auto‑fallback to Classic when needed
- Packaging: flat EGO zips with XML schemas only
