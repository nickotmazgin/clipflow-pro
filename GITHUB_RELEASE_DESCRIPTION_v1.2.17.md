# ClipFlow Pro v1.2.17 - Bug Fix Release

## 🐛 Bug Fix

This release fixes a critical issue with clipboard content decoding that was preventing HTML/URI payloads from being properly decoded.

### Fixed

- **GLib.Bytes handling**: Fixed `_decodeClipboardBytes` to properly handle GLib.Bytes objects that expose `get_data()` and `get_size()` methods
- **Clipboard content decoding**: Resolves issue where clipboard content from `get_content()` (HTML/URI payloads) was not being decoded correctly
- **Codex review feedback**: Addresses automated code review feedback about missing GLib.Bytes handling

### What Changed

The `_decodeClipboardBytes` function now properly handles:
- ✅ Strings
- ✅ **GLib.Bytes objects** (with `get_data()`/`get_size()`) - **NEW**
- ✅ Objects with `toArray()` method
- ✅ Uint8Array

### Technical Details

- **Version:** 1.2.17 (version 23)
- **Compatibility:** GNOME Shell 45–47
- **Format:** ESM (ES Modules)
- **Status:** ✅ Active on extensions.gnome.org

### Installation Options

**🌐 Recommended: Install via extensions.gnome.org**
- Visit [https://extensions.gnome.org/extension/8793/clipflow-pro/](https://extensions.gnome.org/extension/8793/clipflow-pro/)
- Click "Install" and follow the instructions

**📦 Manual Installation:**
1. Download the attached zip file
2. Extract to `~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/`
3. Enable via `gnome-extensions enable clipflow-pro@nickotmazgin.github.io`
4. Restart GNOME Shell (Alt+F2, type `r`, press Enter)

### Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

### Support & Links

- **🌐 extensions.gnome.org:** [https://extensions.gnome.org/extension/8793/clipflow-pro/](https://extensions.gnome.org/extension/8793/clipflow-pro/)
- **GitHub Issues:** https://github.com/nickotmazgin/clipflow-pro/issues
- **GitHub Repo:** https://github.com/nickotmazgin/clipflow-pro

---

**Thank you for using ClipFlow Pro!** ❤️

