# ClipFlow Pro

![EGO Validate](https://github.com/nickotmazgin/clipflow-pro/actions/workflows/ego-validate.yml/badge.svg)
[![CodeQL](https://github.com/nickotmazgin/clipflow-pro/actions/workflows/codeql.yml/badge.svg)](https://github.com/nickotmazgin/clipflow-pro/actions/workflows/codeql.yml)
[![Get it on extensions.gnome.org](https://img.shields.io/badge/Get%20it%20on-extensions.gnome.org-4A86CF?logo=gnome)](https://extensions.gnome.org/extension/8793/clipflow-pro/)

**Advanced Clipboard Manager for GNOME Shell**

ClipFlow Pro is a powerful and intelligent clipboard manager that provides comprehensive clipboard history management with advanced features like intelligent organization, search capabilities, pin/star functionality, and auto-copy on selection.

**Available on:** [extensions.gnome.org](https://extensions.gnome.org/extension/8793/clipflow-pro/) | Searchable in GNOME Extensions app | Installable via system extensions manager

Compatibility: GNOME Shell 43–47

- GNOME 43–44: Classic UI is default (Enhanced available via toggle)
- GNOME 45–47: Enhanced UI is default (Classic available via toggle)
- Auto‑fallback to Classic if Enhanced rendering is blocked by theme/layout

Note: This release uses the GNOME 45+ ES Modules format and libadwaita preferences. Older GNOME versions (≤44) are no longer declared as supported in this package.

Developer tooling:
- Validate package layout before upload: `make ego-validate`
- Create flat EGO zip + source zip: `make dist`
- Issue templates: open "EGO Review Feedback" or "Release Checklist" from GitHub → New Issue

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
- **Classic+ UI**: Pinned strip, Starred section, quick filters (All/Pinned/Starred), per‑row actions (Pin/Star/Copy/Clean Copy/Delete), Show more/less
- **Enhanced UI**: Modern layout with per‑row actions (Copy/Clean Copy); auto‑fallback to Classic when needed
- **Intelligent Categorization**: Automatically categorize entries (URLs, emails, code, files, etc.)
- **Pagination / Expansion**: Efficient handling of large histories
- **Right-click Integration**: Context menu integration for per‑item actions

### ⚙️ Customization
- **Comprehensive Settings**: Extensive configuration options
- **Theme Integration**: Automatically adapts to dark/light themes
- **Customizable Shortcuts**: Configure keyboard shortcuts to your preference
- **Panel Position**: Choose where to place the clipboard icon

## Screenshots

<div align="center">
  <img src="docs/screenshots/01-panel-main-menu.png" alt="ClipFlow Pro panel indicator with the history menu open showing navigation buttons" width="720">
  <p><em>Panel indicator with the full clipboard history menu.</em></p>
</div>

<div align="center">
  <img src="docs/screenshots/02-quick-menu.png" alt="ClipFlow Pro quick context menu showing five recent entries" width="720">
  <p><em>Quick context menu with the five most recent entries.</em></p>
</div>

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/03-settings-general.png" alt="ClipFlow Pro general settings tab" width="340"><br>
      <sub><strong>General</strong></sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/04-settings-behavior.png" alt="ClipFlow Pro behavior settings tab" width="340"><br>
      <sub><strong>Behavior</strong></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/screenshots/05-settings-appearance.png" alt="ClipFlow Pro appearance settings tab" width="340"><br>
      <sub><strong>Appearance</strong></sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/06-settings-shortcuts.png" alt="ClipFlow Pro shortcuts settings tab" width="340"><br>
      <sub><strong>Shortcuts</strong></sub>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="docs/screenshots/07-settings-about.png" alt="ClipFlow Pro about tab" width="340"><br>
      <sub><strong>About</strong></sub>
    </td>
  </tr>
</table>

## 📥 Installation

ClipFlow Pro can be installed through multiple methods. Choose the one that works best for you:

### 🌐 Method 1: Install from extensions.gnome.org (Recommended)

**ClipFlow Pro is officially available on extensions.gnome.org!**

[**👉 Install ClipFlow Pro from extensions.gnome.org**](https://extensions.gnome.org/extension/8793/clipflow-pro/)

**Direct link:** https://extensions.gnome.org/extension/8793/clipflow-pro/

**Benefits:**
- ✅ One-click installation
- ✅ Automatic updates
- ✅ Easy management via Extensions app
- ✅ Official GNOME Extensions platform
- ✅ Searchable and installable via GNOME Extensions app

**How to install:**

**Option A: Via Web Browser**
1. Visit [extensions.gnome.org/extension/8793/clipflow-pro/](https://extensions.gnome.org/extension/8793/clipflow-pro/)
2. Click the "Install" button
3. Follow the on-screen instructions
4. Enable the extension in GNOME Extensions app

**Option B: Via GNOME Extensions App (System Extensions Manager)**
1. Open **GNOME Extensions** app (search for "Extensions" in your application menu)
2. Click the **Browse** tab or search for "ClipFlow Pro"
3. Find ClipFlow Pro in the search results
4. Click **Install** or toggle the switch to enable
5. The extension will be automatically installed and enabled

**Option C: Via Command Line**
```bash
# Search and install via gnome-extensions tool
gnome-extensions install clipflow-pro@nickotmazgin.github.io

# Or enable if already installed
gnome-extensions enable clipflow-pro@nickotmazgin.github.io
```

### 📦 Method 2: Manual Installation

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

If the extension is slow or using too much memory:

1. Reduce the maximum entries limit in settings
2. Reduce the maximum entry length
3. Enable auto-clear sensitive data to reduce memory usage

## Changelog

### Recent Versions

- **1.2.17** - Fixed GLib.Bytes handling in _decodeClipboardBytes; Security: Fixed clear-text logging of sensitive information
- **1.2.16** - Removed buildPrefsWidget() function; Added donations field to metadata.json with PayPal support
- **1.2.15** - Updated PayPal donations field format
- **1.2.14** - Removed buildPrefsWidget() function; Added donations support
- **1.2.13** - Removed all debug/debugging code completely; Removed unnecessary try/catch blocks
- **1.2.12** - Removed deprecated ByteArray usage; Reduced try/catch wrappers
- **1.2.11** - Removed remaining unnecessary try/catch wrappers
- **1.2.10** - Removed compiled schemas from EGO zip (45+); Dropped ExtensionUtils (ESM)
- **1.2.8** - Hardened ESM runtime; Added `make ego-validate` and CI workflow
- **1.2.7** - Ported to GNOME 45+ ES Modules; Migrated preferences to `fillPreferencesWindow()`

For complete version history, see [CHANGELOG.md](CHANGELOG.md).

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

- **🌐 extensions.gnome.org**: [Install and manage ClipFlow Pro](https://extensions.gnome.org/extension/8793/clipflow-pro/)
- **GitHub Issues**: [Report bugs or request features](https://github.com/nickotmazgin/clipflow-pro/issues)
- **GitHub Discussions**: [Ask questions or discuss ideas](https://github.com/nickotmazgin/clipflow-pro/discussions)
- **Email**: [nickotmazgin.dev@gmail.com](mailto:nickotmazgin.dev@gmail.com)

## Donations

If you find ClipFlow Pro useful, please consider supporting its development:

[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)

## Branch Layout

- main: GNOME 45–47 (ESM). This is the default development branch.
- gnome43-44: GNOME 43–44 (legacy GJS). Maintained via a Git worktree at `../clipflow-pro-gnome43` for unified builds.

Packaging for extensions.gnome.org (EGO): two flat zips under one UUID. The build script `tools/build-unified.sh` outputs:
- `dist/clipflow-pro-gnome45-47.zip` (shell-version [45,46,47])
- `dist/clipflow-pro-gnome43-44.zip` (shell-version [43,44])

Compliance: no compiled schemas in zips; schema XML included; metadata.json `version` is an integer; `version-name` <= 16 chars and ASCII.
## What’s New in 1.3.3

- Minimal per‑entry actions: Copy + More (Pin/Unpin, Star/Unstar, Copy cleaned, Delete in overflow)
- Duplicate menu header removed for a cleaner look
- Pinned chip strip capped (max 6 chips) for readability
- New appearance toggles: Hide Pinned Section, Hide Starred Section
- Safer default: Capture PRIMARY is OFF on fresh installs (prevents stalls while taking screenshots)
- One‑command release script added: `tools/release.sh`
