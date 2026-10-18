# ClipFlow Pro — Security & Privacy

This document describes ClipFlow Pro’s **actual** privacy and security behavior, based on the current codebase. It is not a legal certification.

## Privacy principles (as implemented)

1. **Local-only history storage** — clipboard history is kept on the user’s machine under `~/.config/clipflow-pro/`.
2. **No intentional network use** — the extension and its packaged helpers do not open network connections for telemetry, sync, analytics, or updates.
3. **User control** — preferences and clear/export/import controls let users limit retention and remove stored clips.
4. **Transparency** — source is open on GitHub for review.

## What is stored

| Topic | Behavior |
| --- | --- |
| **What** | Clipboard **text** captured while monitoring is enabled (subject to filters/settings) |
| **Where** | `~/.config/clipflow-pro/history.json` (and related config under that directory) |
| **Who** | Anyone with access to the local user account / filesystem can read it |
| **Why** | Provide clipboard history and related UI features |
| **How long** | Bounded by settings; default **`max-entries` is 100** (schema default), user-configurable within the schema range |

Temporary insert helpers may also write a short-lived private JSON payload under the system temp directory when auto-insert is used. Successful runs delete that file after read; failed spawn paths are cleaned up by the extension.

## Sensitive-content filtering

Setting key: `ignore-passwords` (name kept for compatibility; on by default).

ClipFlow skips saving a clip in two cases:

1. **Password-manager hint (since 1.5.7).** Password managers such as KeePassXC put an `x-kde-passwordManagerHint` = `secret` marker next to a copied password. ClipFlow reads it on every clipboard path (X11, the MIME fallback and Wayland). When GNOME re-offers the same text without the marker after the password manager quits, a SHA-256 hash of recent marked clips (never the text, at most 32, in memory only) catches that copy too. An unreadable marker counts as secret.
2. **Heuristic content detection.** Keywords such as `password` / `secret`, and common token/key shapes (GitHub, Slack, AWS, `sk-` keys).

With the setting off, marked clips are saved but flagged sensitive (see `auto-clear-sensitive` below).

Verified on 1.5.7 (2026-10-18, Zorin OS 18.1 / GNOME Shell 46 / X11) with **KeePassXC 2.7.6**: a 20-character random password copied with Ctrl+C offered `x-kde-passwordManagerHint` = `secret` and was **not** saved; a normal clip copied right after **was** saved; quitting KeePassXC (which clears the clipboard) left nothing in history.

Limitations:

- ClipFlow does **not** detect whether text came from a password input field in other apps.
- A password copied from an app that sets no marker, with no matching pattern, is **not** filtered. Pause monitoring first for those.
- Keyword matches can produce false positives.
- This is a convenience filter, not a security boundary.

Related optional setting: `auto-clear-sensitive` removes entries already marked sensitive after a short delay.

## File permissions

History save paths attempt owner-only permissions (`0600`) on `history.json`. Insert payloads are created with GIO private create flags when possible so they are owner-only from creation.

Permissions are best-effort on the local filesystem. Other processes running as the same user can still read these files. Do not treat local clipboard history as encrypted or multi-user isolated storage.

## Subprocess / helper usage

ClipFlow may launch short-lived local helpers for optional features, for example:

- `gjs` history-window / clipboard-set / insert runners shipped with the extension
- On X11 sessions: tools such as `xdotool` / `xclip` when present and enabled
- On Wayland sessions: tools such as `wl-copy` / `wl-paste` / `wtype` when present and used by helper paths

These helpers are for local clipboard/insert behavior. They are not used to download remote code. Availability and behavior differ between Wayland and X11; some insert/target paths are more reliable on X11.

## Lifecycle / cleanup

The extension disconnects settings signals, stops clipboard monitoring sources it owns, and clears tracked deferred GLib sources on disable/destroy. Lock-screen signal handlers and search-focus / deferred idle/timeout sources used by history UI are cleaned up on destroy.

No software can honestly claim “perfect” lifecycle behavior in every Shell version without ongoing runtime testing. Treat cleanup as maintained best-effort; report leaks or journal errors if you observe them.

## Network

The extension itself does not implement outbound network clients for sync, telemetry, crash reporting, or update checks. Verify claims against the current source if you fork or add features.

## Access model (practical)

| Area | Notes |
| --- | --- |
| Clipboard | Reads/writes clipboard text via Shell APIs and/or local helpers |
| GSettings | Reads/writes extension preferences |
| Filesystem | History under `~/.config/clipflow-pro/`; temp insert payloads under the system temp dir; optional user-chosen import/export paths |
| Network | Not used by the extension for data export |

## Security checklist (reviewers)

- [x] History stored locally by design
- [x] No built-in cloud sync / telemetry client in the extension
- [x] User can clear history and adjust retention
- [x] Password-manager hint respected (`x-kde-passwordManagerHint`, verified with KeePassXC 2.7.6)
- [x] Optional heuristic sensitive-content filtering (`ignore-passwords`)
- [x] Optional auto-clear for sensitive-marked entries
- [x] Clear-on-logout option
- [x] Subprocess use limited to local helpers for clipboard/history/insert features
- [ ] Multi-user hostile environments — **not** a design goal; local files remain readable to the same UID
- [ ] Password-field awareness in other apps — **not implemented**; password-manager hint and heuristics only

## Privacy / “compliance” note

ClipFlow aims to minimize data handling (local clipboard history only). Statements such as “GDPR certified” or similar legal guarantees are **not** made here. If you need a formal compliance assessment, that is outside this document and must be performed for your deployment context.

## Reporting security issues

Follow [.github/SECURITY.md](../.github/SECURITY.md):

1. **Do not** open a public issue for vulnerabilities
2. Email **nickotmazgin.dev@gmail.com**
3. Include description, reproduction steps, impact, and a suggested fix if you have one

Expected initial response: within about 48 hours (see the security policy for the full timeline).

## Manual checks (examples)

```bash
# History permissions (when the file exists)
ls -la ~/.config/clipflow-pro/

# No eval-style dynamic code execution patterns in the main extension
rg -n 'eval\\(' extension.js || true

# Schema default max entries
rg -n 'max-entries' schemas/org.gnome.shell.extensions.clipflow-pro.gschema.xml
```

Live GNOME Shell / Wayland / X11 behavior must be verified on a Linux desktop session.
