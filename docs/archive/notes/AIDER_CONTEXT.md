# ClipFlow Pro - GNOME Shell Extension Context

## Project Overview
**ClipFlow Pro** is a modern, powerful clipboard manager for GNOME Shell that provides intelligent organization, beautiful UI, and comprehensive history management.

## Technical Details
- **Type**: GNOME Shell Extension
- **Target Versions**: GNOME Shell 42, 43, 44, 45, 46
- **Language**: JavaScript (GJS - GNOME JavaScript)
- **APIs Used**: St (Shell Toolkit), GObject, GLib, Gio, PanelMenu, PopupMenu
- **Distribution**: extensions.gnome.org, GitHub, Flatpak-ready

## Project Structure
- `extension.js` - Main extension logic, clipboard monitoring, UI
- `prefs.js` - Settings/preferences interface (GTK4)
- `contextMenu.js` - File manager integration, context menu actions
- `stylesheet.css` - UI styling and theming
- `metadata.json` - Extension metadata and version info
- `schemas/` - GSettings schema definitions

## Key Features
- **Clipboard History**: Tracks and stores clipboard content
- **Search & Filter**: Find specific clipboard items quickly
- **Panel Integration**: Status area icon with dropdown menu
- **Settings Panel**: User-configurable preferences
- **File Manager Integration**: Context menu actions for files
- **Dynamic Panel Position**: User can choose left/center/right
- **Privacy Protection**: Auto-ignore passwords and sensitive content

## Recent Fixes Applied
1. **Memory Leak Fixes**: Proper cleanup in destroy() methods
2. **Notification Icons**: Added appropriate icons to all notifications
3. **Dark Theme Support**: Improved readability in dark themes
4. **Error Handling**: Better error handling for process spawning

## Development Goals
- **Performance**: Optimize clipboard monitoring and memory usage
- **User Experience**: Improve UI/UX and accessibility
- **Features**: Add keyboard shortcuts, pinning, export/import
- **Security**: Ensure safe handling of clipboard data
- **Compatibility**: Maintain compatibility across GNOME versions

## Release Target
- **Primary**: extensions.gnome.org (official GNOME extensions site)
- **Secondary**: GitHub releases, Flatpak packages
- **Version**: 1.0.0 (semantic versioning)

## Code Quality Standards
- Follow GNOME Shell extension best practices
- Use modern GJS APIs and patterns
- Implement proper error handling
- Ensure accessibility compliance
- Maintain security best practices
- Optimize for performance and memory usage
