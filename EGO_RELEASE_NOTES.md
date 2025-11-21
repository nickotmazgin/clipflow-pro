Title

ClipFlow Pro

Description

Modern clipboard manager for GNOME Shell 45–47. ClipFlow Pro records your history, adds instant search and smart filters, and keeps the menu responsive on both Xorg and Wayland. No background daemons or network chatter — every entry stays local in your user config.

About

ClipFlow Pro brings a full‑featured clipboard experience to the GNOME Shell panel. Browse and search your recent copies, pin or star favorites, and jump in with Super+Shift+V. Switch between the sleek boxed layout and the compact view, while your history remains private under ~/.config/clipflow-pro. Source, docs, and issues: https://github.com/nickotmazgin/clipflow-pro

Release Notes (1.2.16)

Removed buildPrefsWidget() function: removed legacy buildPrefsWidget() function from prefs.js (not needed for GNOME 45+ packages).

Added donations support: added donations field to metadata.json with PayPal support.

Debug code removal: completely eliminated all debug/debugging functionality. Removed Diagnostics section from preferences (Enable Debug Logging switch and self-check button). Removed all _debugLog() calls and method definition (104+ instances). Removed enable-debug-logs setting from schema.

Error handling cleanup: removed unnecessary try/catch blocks that only logged errors (per JustPerfection review feedback). Errors now bubble with automatic backtraces in logs. Kept minimal try/catch only for actual I/O operations (file reading/writing, JSON parsing) to prevent crashes on corrupted data.

ByteArray deprecation: verified ByteArray is completely removed (fixed in 1.2.12). All clipboard decoding uses TextDecoder/GLib.Bytes toArray() as required by EGO guidelines.

Packaging (45+): flat zip with required files only; removed schemas/gschemas.compiled.

ESM cleanup: no ExtensionUtils/Me; settings from Extension.getSettings(); preferences opened via Main.extensionManager.openExtensionPrefs(UUID).

Preferences: destroy() + super.destroy(); simplified 45+ window APIs.

Compatibility: tested shells ["45","46","47"]; older versions are not declared.

Privacy: no background daemons or network activity; clipboard history remains local under ~/.config/clipflow-pro.

