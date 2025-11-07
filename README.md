# ClipFlow Pro

**Advanced Clipboard Manager for GNOME Shell**

ClipFlow Pro is a powerful and intelligent clipboard manager that provides comprehensive clipboard history management with advanced features like intelligent organization, search capabilities, pin/star functionality, and auto-copy on selection.

## Features

### 🚀 Core Features
- **Advanced Clipboard History**: Keep track of all your clipboard entries with intelligent categorization
- **Smart Search & Filtering**: Find clipboard entries quickly with powerful search and category filtering
- **Pin & Star System**: Mark important entries for quick access
- **Auto-copy on Selection**: Automatically copy selected text to clipboard history
- **Keyboard Shortcuts**: Full keyboard support for power users

### 🔒 Privacy & Security
- **Password Detection**: Automatically detect and optionally ignore password-like content
- **Sensitive Data Protection**: Clear sensitive data with one click
- **Auto-clear Sensitive Data**: Automatically remove sensitive entries after 5 minutes
- **Secure Data Handling**: Proper cleanup of sensitive information

### 🎨 User Experience
- **Modern UI**: Beautiful, responsive interface that adapts to your GNOME theme
- **Intelligent Categorization**: Automatically categorize entries (URLs, emails, code, files, etc.)
- **Pagination Support**: Handle large clipboard histories efficiently
- **Right-click Integration**: Context menu integration for file operations

### ⚙️ Customization
- **Comprehensive Settings**: Extensive configuration options
- **Theme Integration**: Automatically adapts to dark/light themes
- **Customizable Shortcuts**: Configure keyboard shortcuts to your preference
- **Panel Position**: Choose where to place the clipboard icon

## Installation

### Method 1: Manual Installation

1. **Download the extension**:
   ```bash
   git clone https://github.com/nickotmazgin/clipflow-pro.git
   cd clipflow-pro
   ```

2. **Build the extension**:
   ```bash
   ./build.sh
   ```

3. **Install the extension**:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io
   cp -r build/* ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
   ```

4. **Enable the extension**:
   ```bash
   gnome-extensions enable clipflow-pro@nickotmazgin.github.io
   ```

5. **Restart GNOME Shell** (Alt+F2, type `r`, press Enter)

### Method 2: GNOME Extensions Website

1. Visit [extensions.gnome.org](https://extensions.gnome.org)
2. Search for "ClipFlow Pro"
3. Click "Install" and follow the instructions

## Usage

### Basic Usage

1. **Access the clipboard menu**: Click the clipboard icon in the top panel or use the keyboard shortcut `Super+Shift+V`
2. **Search entries**: Type in the search box to find specific clipboard entries
3. **Copy an entry**: Click on any entry to copy it to your clipboard
4. **Pin important entries**: Click the pin icon to keep important entries at the top
5. **Star favorites**: Click the star icon to mark favorite entries

### Keyboard Shortcuts

- `Super+Shift+V`: Show/hide clipboard menu
- `Super+C`: Enhanced copy (copy selected text to clipboard history)
- `Super+V`: Enhanced paste (paste with formatting cleanup)

## Configuration

### Settings Panel

Access the settings by clicking the "Settings" button in the clipboard menu or through GNOME Extensions.

#### General Settings
- **Maximum Entries**: Set how many clipboard entries to keep (10-100)
- **Maximum Entry Length**: Limit individual entry length (100-10000 characters)
- **Entries Per Page**: Number of entries shown per page (5-50)
- **Show Entry Numbers**: Display numbers next to entries
- **Show Entry Preview**: Show content preview in menu
- **Show Entry Timestamps**: Display when entries were copied

#### Behavior Settings
- **Enable Auto-copy on Selection**: Automatically copy selected text
- **Enhanced Selection Notifications**: Show notifications when text is auto-copied
- **Panel Icon Position**: Choose where to place the clipboard icon

#### Privacy & Security
- **Ignore Passwords**: Don't save password-like content
- **Clear on Logout**: Clear history when logging out
- **Auto-clear Sensitive Data**: Automatically remove sensitive entries after 5 minutes
- **Persistent History Storage**: History is kept locally at `~/.config/clipflow-pro/history.json`

#### Keyboard Shortcuts
- **Show Clipboard Menu**: Open the clipboard history menu
- **Enhanced Copy**: Copy selected text to clipboard history
- **Enhanced Paste**: Paste with formatting cleanup

## Troubleshooting

### Quick Verification

Run the built-in verification script to check your setup:
```bash
./verify_clipflow.sh
```

This will:
- Verify extension installation
- Check schema compilation
- Reset problematic settings (min-entry-length, ignore-passwords)
- Provide testing commands for Wayland clipboard

### Extension Not Showing in Panel

1. Check if the extension is enabled:
   ```bash
   gnome-extensions list --enabled | grep clipflow-pro
   ```

2. If not enabled, enable it:
   ```bash
   gnome-extensions enable clipflow-pro@nickotmazgin.github.io
   ```

3. Restart GNOME Shell (Alt+F2, type `r`, press Enter)

### Empty History List on Wayland

If clipboard history stays empty on Wayland:

1. **Enable debug logging** in extension settings
2. **Run verification script**: `./verify_clipflow.sh`
3. **Test with wl-clipboard**:
   ```bash
   printf 'hello clipflow' | wl-copy
   ```
4. **Watch logs**:
   ```bash
   journalctl -f /usr/bin/gnome-shell | grep -i "ClipFlow Pro"
   ```
5. **Toggle extension** (Wayland-safe):
   ```bash
   gnome-extensions disable clipflow-pro@nickotmazgin.github.io
   gnome-extensions enable clipflow-pro@nickotmazgin.github.io
   ```

### Settings Not Working

1. Check if schemas are compiled:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/schemas/
   ```

2. Restart GNOME Shell

### Keyboard Shortcuts Not Working

1. Check if shortcuts are properly set in GNOME Settings > Keyboard > Shortcuts
2. Make sure no other extensions are conflicting
3. Try resetting the shortcuts in the extension settings

### Performance Issues

1. Reduce the maximum entries limit in settings
2. Reduce the maximum entry length
3. Enable auto-clear sensitive data to reduce memory usage

## Development

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/nickotmazgin/clipflow-pro.git
   cd clipflow-pro
   ```

2. Make changes to the source files

3. Build the extension:
   ```bash
   ./build.sh
   ```

4. Install and test:
   ```bash
   cp -r build/* ~/.local/share/gnome-shell/extensions/clipflow-pro@nickotmazgin.github.io/
   gnome-extensions enable clipflow-pro@nickotmazgin.github.io
   ```

### File Structure

```
clipflow-pro/
├── extension.js          # Main extension file
├── prefs.js             # Preferences/settings UI
├── stylesheet.css       # Styling
├── metadata.json        # Extension metadata
├── schemas/             # GSettings schemas
│   └── org.gnome.shell.extensions.clipflow-pro.gschema.xml
├── locale/              # Translation files
│   └── clipflow-pro.pot
├── icons/               # Extension icons
│   └── clipflow-pro-symbolic.svg
├── build.sh             # Build script
└── README.md            # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Project Structure

- `docs/` – Internal notes, audits, and archived extension experiments.
- `icons/` – Custom symbolic icons bundled with the extension.
- `tools/` – Optional helper scripts for development and AI workflows.

## License

This project is licensed under the GPL-3.0-or-later License - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/nickotmazgin/clipflow-pro/issues)
- **GitHub Discussions**: [Ask questions or discuss ideas](https://github.com/nickotmazgin/clipflow-pro/discussions)
- **Email**: [nickotmazgin.dev@gmail.com](mailto:nickotmazgin.dev@gmail.com)

## Donations

If you find ClipFlow Pro useful, please consider supporting its development:

[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)

## Changelog

### Version 1.2.1
- Stabilized panel icon lifecycle to avoid duplicate indicators and Shell crashes when moving between left/center/right positions.
- Limited the history slider to 10–100 entries so GNOME Shell no longer stalls on gigantic histories, keeping the advertised defaults in sync with what the code enforces.
- Bundled a precompiled schema and updated the build/install scripts so rootless installs work even when `glib-compile-schemas` is unavailable.
- Added `safe-reload.sh` for quick local reloads with crash monitoring during development.

### Version 1.2.0
- Hardened clipboard HTML sanitization so embedded script/style tags are stripped reliably before copying back to the user.
- Added automated CodeQL scanning for every push/PR (and weekly), keeping the JavaScript codebase checked for vulnerabilities.
- Enabled GitHub security features (secret scanning with push protection, vulnerability alerts) to guard the project supply chain.
### Version 1.1.2
- Reworked the main history view with Wayland-safe `St` rows, inline pin/star badges, and improved hover/focus states.
- Added an optional “Use Legacy Menu Rows” preference so older GNOME Shell builds can fall back to the previous popup layout.
- Hardened menu assembly with guarded pagination/action sections plus an idle rebuild fallback to prevent blank lists.
- Throttled copy notifications and error logging to avoid toast or journal spam during rapid clipboard activity.

### Version 1.1.1
- Auto-focus search field when menu opens for faster access
- Settings validation with automatic bounds checking
- Content type styling now uses CSS classes for visual distinction
- Improved empty state messaging with helpful guidance
- Performance optimization with cached filtered results
- Fixed keyboard navigation to respect promote-on-copy setting

### Version 1.1.0
- Persistent clipboard history saved to `~/.config/clipflow-pro/history.json`
- Search-aware pagination with configurable page size
- Auto-clearing timers for sensitive entries
- Custom ClipFlow Pro panel icon and reorganised project docs/tools
- Asynchronous conflict detection and refined context menu integration

### Version 1.0.0
- Initial release
- Advanced clipboard history management
- Intelligent search and filtering
- Pin and star system
- Auto-copy on selection
- File manager integration
- Comprehensive settings panel
- Security and privacy features
- Keyboard shortcuts support
- Theme integration

## Acknowledgments

- GNOME Shell team for the excellent extension system
- GNOME community for inspiration and feedback
- All contributors and testers

---

**Made with ❤️ for the GNOME community**
