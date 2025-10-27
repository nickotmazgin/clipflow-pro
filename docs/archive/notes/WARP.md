# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

ClipFlow Pro is a GNOME Shell extension that provides advanced clipboard management functionality. It's written in JavaScript using the GNOME Shell extension APIs and supports GNOME Shell versions 40-47.

## Development Commands

### Build and Installation
```bash
# Build the extension
make build

# Install locally for testing
make install

# Development mode with file watching
make dev

# Create distribution packages
make dist

# Uninstall extension
make uninstall
```

### Validation and Testing
```bash
# Validate extension files and schemas
make validate

# Test installation and check for errors
make test

# Check current version
make version

# Bump version number
make bump-version
```

### Manual Installation Commands
```bash
# Enable extension after installation
gnome-extensions enable clipflow-pro@nickotmazgin.github.io

# Check extension status
gnome-extensions list | grep clipflow-pro

# View extension logs
journalctl -f | grep clipflow-pro

# Restart GNOME Shell (X11)
Alt + F2 → type 'r' → Enter

# Open extension preferences
gnome-extensions prefs clipflow-pro@nickotmazgin.github.io
```

## Architecture

### Core Components

**Main Extension (`extension.js`)**
- `ClipboardEntry` - Data model for clipboard entries with metadata (pinned, starred, timestamps)
- `ClipFlowManager` - Core clipboard monitoring and history management
- `ClipFlowExtension` - Main extension class with panel integration
- Handles clipboard monitoring, persistence, and GNOME Shell integration

**Preferences (`prefs.js` and `prefs-gtk4.js`)**
- GTK-based preferences UI for extension configuration
- Separate implementations for different GNOME Shell versions
- Integrates with GSettings schema for persistent configuration

**Context Menu Integration (`contextMenu.js`)**
- File manager integration for right-click operations
- Cross-file-manager compatibility (Nautilus, Nemo, Thunar, etc.)
- Terminal integration and file path operations

**Configuration Schema (`schemas/org.gnome.shell.extensions.clipflow-pro.gschema.xml`)**
- GSettings schema defining all configuration options
- Includes keyboard shortcuts, UI preferences, privacy settings
- Supports validation and default values

### Key Features Architecture

**Clipboard Management**
- Real-time monitoring using `St.Clipboard` API
- Intelligent duplicate detection
- Content filtering (password detection, length limits)
- Persistent storage in user config directory

**Search and Organization**
- Real-time search across clipboard history
- Pin/star system for important entries
- Pagination for large entry sets
- Entry type categorization (text, files, URLs)

**File Manager Integration**
- Multi-file-manager support with detection
- Context menu operations (copy paths, open terminal)
- Cross-desktop environment compatibility

## File Structure

```
clipflow-pro/
├── extension.js          # Main extension logic
├── contextMenu.js        # File manager integration
├── prefs.js             # Preferences (GNOME 40-42)
├── prefs-gtk4.js        # Preferences (GNOME 43+)
├── metadata.json        # Extension metadata
├── stylesheet.css       # UI styling
├── schemas/             # GSettings configuration schema
├── locale/             # Internationalization files
└── build/              # Build artifacts
```

## Development Guidelines

### Extension-Specific Patterns

**GNOME Shell API Usage**
- Always import GNOME APIs through `imports.gi`
- Use ExtensionUtils for settings and translations
- Handle GNOME Shell version compatibility carefully

**Settings Management**
- Access settings via `ExtensionUtils.getSettings()`
- Monitor setting changes with `connect('changed::key')`
- Use GSettings schema for validation and defaults

**UI Components**
- Use `St` widgets for GNOME Shell UI integration
- Follow GNOME HIG guidelines for preferences
- Implement proper cleanup in `disable()` method

**File Operations**
- Use GLib for cross-platform file operations
- Handle different file managers gracefully
- Provide fallbacks for missing system components

### Testing and Debugging

**Development Workflow**
- Use `make dev` for continuous development
- Monitor `journalctl` for runtime errors
- Test across different GNOME Shell versions
- Validate with `make validate` before commits

**Error Handling**
- Always wrap file operations in try-catch blocks
- Use `log()` for debugging messages
- Handle missing system dependencies gracefully
- Provide meaningful error messages

### Compatibility Considerations

**GNOME Shell Versions**
- Support versions 40-47 as defined in metadata.json
- Handle API changes between versions carefully
- Test on multiple GNOME versions when possible

**Desktop Environments**
- Primary support for GNOME Shell
- Basic compatibility with other environments (Zorin, etc.)
- Handle both Wayland and X11 display protocols

**File Managers**
- Full integration: Nautilus, Nemo, Thunar
- Basic integration: Dolphin, PCManFM
- Graceful degradation when file manager unavailable

## Configuration Schema

Key settings available in GSettings:
- `max-entries` (10-1000): Maximum clipboard history entries
- `max-entry-length` (100-10000): Maximum characters per entry
- `enable-auto-copy`: Auto-copy selected text
- `show-menu-shortcut`: Keyboard shortcut configuration
- `ignore-passwords`: Privacy protection
- `panel-position`: UI placement (left/center/right)

Access settings programmatically:
```javascript
const settings = ExtensionUtils.getSettings();
const maxEntries = settings.get_int('max-entries');
settings.set_boolean('enable-auto-copy', true);
```

## Project Links

- **GitHub Repository**: https://github.com/nickotmazgin/clipflow-pro
- **Support Development**: [Donate via PayPal](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)
- **Developer**: Nick Otmazgin
