# ClipFlow Pro v1.2.17 Release Notes

## 🐛 Bug Fix Release

This release fixes a critical issue with clipboard content decoding.

### Fixed

- **GLib.Bytes handling**: Fixed `_decodeClipboardBytes` to properly handle GLib.Bytes objects that expose `get_data()` and `get_size()` methods
- **Clipboard content decoding**: Resolves issue where clipboard content from `get_content()` (HTML/URI payloads) was not being decoded correctly
- **Codex review feedback**: Addresses automated code review feedback about missing GLib.Bytes handling

### Technical Details

- **Version:** 1.2.17 (version 23)
- **Compatibility:** GNOME Shell 45–47
- **Format:** ESM (ES Modules)
- **Status:** Active on extensions.gnome.org

### Installation

**🌐 Recommended: Install via extensions.gnome.org**
- **Website:** [https://extensions.gnome.org/extension/8793/clipflow-pro/](https://extensions.gnome.org/extension/8793/clipflow-pro/)

**📦 Manual Installation:**
- Download the attached zip file below
- Install manually using GNOME Extensions or command line

### Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

### Support

- **🌐 extensions.gnome.org:** [https://extensions.gnome.org/extension/8793/clipflow-pro/](https://extensions.gnome.org/extension/8793/clipflow-pro/)
- **GitHub Issues:** https://github.com/nickotmazgin/clipflow-pro/issues
- **Email:** nickotmazgin.dev@gmail.com

---

Thank you for using ClipFlow Pro! ❤️

