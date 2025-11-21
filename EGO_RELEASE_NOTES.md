Title

ClipFlow Pro

Description

Modern clipboard manager for GNOME Shell 45–47. ClipFlow Pro records your history, adds instant search and smart filters, and keeps the menu responsive on both Xorg and Wayland. No background daemons or network chatter — every entry stays local in your user config.

About

ClipFlow Pro brings a full‑featured clipboard experience to the GNOME Shell panel. Browse and search your recent copies, pin or star favorites, and jump in with Super+Shift+V. Switch between the sleek boxed layout and the compact view, while your history remains private under ~/.config/clipflow-pro. Source, docs, and issues: https://github.com/nickotmazgin/clipflow-pro

Release Notes (1.2.17)

Security fix: fixed clear-text logging of sensitive information (identified by GitHub CodeQL security scanning). Added _sanitizeLogMessage() function to prevent sensitive clipboard data from being exposed in error logs. Error logging now only includes error types, not full messages that could contain sensitive data. Removed all _logEnabled and console.debug calls. Resolves CodeQL security alert 7.

GLib.Bytes handling fix: fixed _decodeClipboardBytes to properly handle GLib.Bytes objects that expose get_data() and get_size() methods (identified by GitHub Codex automated code review). This resolves issues where clipboard content from get_content() (HTML/URI payloads) was not being decoded correctly. All clipboard decoding paths now work correctly.

Code cleanup: removed buildPrefsWidget() function (not needed for GNOME 45+ packages). Removed _runSelfCheck() method. Removed all debug/debugging code completely. Removed enable-debug-logs setting from schema. Removed deprecated ByteArray usage. Removed unnecessary try/catch blocks that only logged errors.

Packaging (45+): flat zip with required files only; removed schemas/gschemas.compiled.

ESM cleanup: no ExtensionUtils/Me; settings from Extension.getSettings(); preferences opened via Main.extensionManager.openExtensionPrefs(UUID).

Preferences: destroy() + super.destroy(); simplified 45+ window APIs.

Compatibility: tested shells ["45","46","47"]; older versions are not declared.

Privacy: no background daemons or network activity; clipboard history remains local under ~/.config/clipflow-pro.

