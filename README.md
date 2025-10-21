# ClipFlow Pro

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-40%2B-orange.svg)](https://www.gnome.org/)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)

**ClipFlow Pro** is an advanced clipboard manager extension for GNOME Shell that provides intelligent organization, powerful search capabilities, and seamless integration with your desktop workflow.

![ClipFlow Pro Banner](assets/banner.png)

## ✨ Features

### 🎯 Core Functionality
- **Smart Clipboard History** - Keep track of up to 1000 clipboard entries with intelligent duplicate detection
- **Advanced Search** - Quickly find any clipboard entry with real-time search functionality
- **Organized Display** - Numbered entries with pagination for easy navigation
- **Persistent Storage** - Clipboard history survives system restarts

### 🔧 Smart Organization
- **Pin Important Items** - Pin frequently used clipboard entries for quick access
- **Star Favorites** - Star important content to highlight it in your history
- **Auto-categorization** - Automatic content type detection (text, files, URLs, etc.)
- **Custom Entry Limits** - Configure maximum entries and character length per entry

### ⚡ Productivity Features
- **Auto-copy on Selection** - Optionally copy selected text automatically
- **One-click Actions** - Click any entry to instantly copy it to clipboard
- **Keyboard Shortcuts** - Fully customizable shortcuts for all operations
- **Quick Access Panel** - Always-available panel icon for instant access

### 🗂️ File Manager Integration
- **Copy File Paths** - Right-click integration to copy full paths, filenames, or directory paths
- **Open Terminal Here** - Quick terminal access from any file location
- **File Information** - Display file size, type, and other metadata
- **Multi-format Support** - Works with all major Linux file managers

### 🎨 Customization & Appearance
- **Flexible UI** - Choose panel position (left, center, right)
- **Preview Options** - Toggle entry previews and numbering
- **Responsive Design** - Adapts to different screen sizes
- **Accessibility** - Full keyboard navigation and screen reader support

### 🔒 Privacy & Security
- **Password Protection** - Automatically ignores password field content
- **Secure Storage** - Local-only storage with no cloud synchronization
- **Clear on Logout** - Optional automatic history clearing
- **Content Filtering** - Smart content detection to avoid sensitive data

## 🚀 Installation

### From GNOME Extensions Website
1. Visit [extensions.gnome.org](https://extensions.gnome.org) (coming soon)
2. Search for "ClipFlow Pro"
3. Click "Install" and toggle ON

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/nickotmazgin/clipflow-pro/releases)
2. Extract the archive to `~/.local/share/gnome-shell/extensions/`
3. Restart GNOME Shell: `Alt + F2`, type `r`, press Enter
4. Enable the extension: `gnome-extensions enable clipflow-pro@nickotmazgin.github.io`

### From Source
```bash
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
make install
```

## 🎮 Usage

### Basic Operations
- **Open Menu**: `Super + Shift + V` (customizable)
- **Search**: Start typing in the search box when menu is open
- **Copy Entry**: Click any clipboard entry to copy it
- **Navigate**: Use arrow keys or pagination buttons

### Managing Entries
- **Pin Entry**: Click the pin icon next to any entry
- **Star Entry**: Click the star icon to mark as favorite  
- **Delete Entry**: Click the delete (×) icon to remove
- **Clear All**: Use the "Clear All" button to empty history

### File Operations
- **Copy Paths**: Right-click files → ClipFlow Pro → Copy options
- **Open Terminal**: Right-click files → ClipFlow Pro → Open Terminal Here
- **File Info**: View file size and metadata in context menu

## ⚙️ Configuration

Access settings through:
- **Extension Preferences**: Click "Settings" in ClipFlow Pro menu
- **GNOME Extensions**: Open Extensions app → ClipFlow Pro → Settings
- **Command Line**: `gnome-extensions prefs clipflow-pro@nickotmazgin.github.io`

### Settings Categories

#### General Settings
- Maximum clipboard entries (10-1000)
- Maximum entry character length (100-10000)  
- Entries displayed per page (5-50)

#### Keyboard Shortcuts
- Show clipboard menu (default: `Super + Shift + V`)
- Enhanced copy operation (default: `Super + C`)
- Enhanced paste operation (default: `Super + V`)

#### Behavior Options
- Auto-copy on text selection (toggle)
- Right-click context menu integration (toggle)
- File manager integration (toggle)

#### Appearance
- Panel icon position (left/center/right)
- Show entry numbers (toggle)
- Show entry previews (toggle)

#### Privacy & Security
- Ignore password fields (recommended: ON)
- Clear clipboard on logout (default: OFF)

## 🖥️ Compatibility

### Supported GNOME Shell Versions
- GNOME Shell 40+
- GNOME Shell 41+
- GNOME Shell 42+
- GNOME Shell 43+
- GNOME Shell 44+
- GNOME Shell 45+
- GNOME Shell 46+
- GNOME Shell 47+

### Supported Distributions
- **Ubuntu** 20.04+ (with GNOME Shell 40+)
- **Fedora** 34+
- **Zorin OS** 16+
- **Pop!_OS** 21.04+
- **openSUSE** Tumbleweed
- **Arch Linux** (with GNOME)
- **Debian** 11+ (with GNOME Shell backports)

### Display Protocols
- ✅ **Wayland** (full support)
- ✅ **X11/Xorg** (full support)

### File Managers
- **Nautilus** (GNOME Files) - Full integration
- **Nemo** (Cinnamon) - Full integration
- **Thunar** (XFCE) - Full integration  
- **Dolphin** (KDE) - Basic integration
- **PCManFM** (LXDE/LXQt) - Basic integration

## 🐛 Troubleshooting

### Common Issues

#### Extension Not Loading
```bash
# Check if extension is enabled
gnome-extensions list | grep clipflow-pro

# Check for errors
journalctl -f | grep clipflow-pro

# Restart GNOME Shell
Alt + F2 → type 'r' → Enter
```

#### Keyboard Shortcuts Not Working
1. Open Settings → Check for conflicting shortcuts
2. Reset shortcuts in ClipFlow Pro preferences
3. Ensure extension has proper permissions

#### Context Menu Not Appearing
1. Enable "Context Menu Integration" in settings
2. Restart file manager application
3. Check file manager compatibility list above

#### History Not Persisting
- Check write permissions for `~/.config/clipflow-pro/`
- Ensure sufficient disk space
- Review privacy settings (clear on logout)

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Development Setup
```bash
git clone https://github.com/nickotmazgin/clipflow-pro.git
cd clipflow-pro
npm install  # If using development tools
make dev     # Start development mode
```

### Reporting Issues
1. Check [existing issues](https://github.com/nickotmazgin/clipflow-pro/issues)
2. Use the issue template for bug reports
3. Include system information and logs
4. Provide steps to reproduce

### Feature Requests
- Open a [feature request](https://github.com/nickotmazgin/clipflow-pro/issues/new?template=feature_request.md)
- Explain the use case and expected behavior
- Check if it aligns with project goals

### Translation
Help translate ClipFlow Pro into your language:
1. Check available translations in `locale/`
2. Copy `locale/clipflow-pro.pot` to `locale/[lang]/LC_MESSAGES/clipflow-pro.po`
3. Translate strings and submit a pull request

## 📋 Changelog

### Version 1.0.0 (Initial Release)
- ✨ Complete clipboard history management
- ✨ Advanced search and filtering
- ✨ Pin/star organization system  
- ✨ File manager integration
- ✨ Customizable keyboard shortcuts
- ✨ Comprehensive privacy controls
- ✨ Multi-distribution support
- ✨ Wayland and X11 compatibility

## 💝 Support the Project

If ClipFlow Pro has improved your productivity, consider supporting its development:

[![Donate with PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=for-the-badge&logo=paypal)](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)

Your donations help:
- 🔧 Maintain compatibility with new GNOME versions
- 🌟 Add new features based on user feedback  
- 🐛 Fix bugs and improve stability
- 📚 Create better documentation and tutorials
- 🌍 Support more languages and distributions

## 📄 License

ClipFlow Pro is licensed under the [GNU General Public License v3.0 or later](LICENSE).

```
ClipFlow Pro - Advanced Clipboard Manager for GNOME Shell
Copyright (C) 2025 Nick Otmazgin

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.
```

## 👨‍💻 Author

**Nick Otmazgin**
- GitHub: [@nickotmazgin](https://github.com/nickotmazgin)
- Email: Contact via GitHub issues
- Donate: [PayPal](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)

## 🙏 Acknowledgments

- GNOME Shell development team for the excellent extension API
- The open-source community for feedback and contributions
- All users who support the project through donations and feedback

---

**⭐ If you find ClipFlow Pro useful, please star this repository to show your support!**