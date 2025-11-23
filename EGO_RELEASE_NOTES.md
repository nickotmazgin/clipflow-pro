Title

ClipFlow Pro

Description

Modern clipboard manager for GNOME Shell 45–47. ClipFlow Pro records your history, adds instant search and smart filters, and keeps the menu responsive on both Xorg and Wayland. No background daemons or network chatter — every entry stays local in your user config.

About

ClipFlow Pro brings a full‑featured clipboard experience to the GNOME Shell panel. Browse and search your recent copies, pin or star favorites, and jump in with Super+Shift+V. Switch between the sleek boxed layout and the compact view, while your history remains private under ~/.config/clipflow-pro. Source, docs, and issues: https://github.com/nickotmazgin/clipflow-pro

Release Notes (1.3.0)

Classic+ + Enhanced, GNOME 43–47 (one UUID)

- One UUID (clipflow-pro@nickotmazgin.github.io), two uploads:
  - GNOME 43–44 (legacy GJS): Classic+ default
  - GNOME 45–47 (ESM): Enhanced default
- Classic+ (both builds): pinned strip, starred section, quick filters, per‑row actions, show more/less, shortcuts, export/import, purge dups, pin top 3/5, unpin all, reset defaults
- Enhanced (45+): per‑row Copy & Clean Copy, auto‑fallback to Classic when needed
- Stability & compliance: deferred enable, throttled xclip/xsel, lazy menu build, local‑only; flat zip per EGO
- One‑time settings migration from legacy 43 schema when present
