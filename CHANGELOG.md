# Changelog - ClipFlow Pro

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2025-11-10

### Added
- Preferences toggle (`Use Compact UI Layout`) to switch between the new boxed design and the slimmer legacy styling.

### Changed
- Compact mode inherits the lighter backgrounds, borders, and spacing from the original layout while keeping the new empty-state/scroll fixes.

---

## [1.2.2] - 2025-11-09

### Added
- Modern empty-state banner with icon/hint text so the clipboard window always explains what to do next.
- `verify_clipflow.sh` helper that recompiles schemas, resets risky settings, and guides Wayland users through log capture.
- User-facing toast when GNOME hasn’t exposed the clipboard service yet, reducing confusion after login.

### Changed
- Restyled the history list with a dedicated scrollbar lane, brighter rows, and padded pagination buttons for better readability on dark themes.
- Scrollbars now auto-hide when a page fits but never overlap the navigation controls.

### Fixed
- Ensured clipboard monitoring retries clear the previous warning flag so notifications don’t repeat forever.
- Eliminated GNOME CSS warnings by removing unsupported properties in the new empty-state wrapper.

---

## [1.2.1] - 2025-11-07

### Added
- `safe-reload.sh` helper that keeps GNOME Shell logs tailing while re-enabling the extension so crashes are captured immediately.
- Bundled `schemas/gschemas.compiled` so strictly rootless installs still work even if `glib-compile-schemas` is missing.

### Changed
- Reduced the `max-entries` slider bounds to 10–100 to match real-world performance limits and keep the UI honest about what the extension can store sustainably.
- INSTALL/CONTRIBUTING docs now focus on rootless workflows and document the schema compilation fallback.

### Fixed
- Panel indicator creation/destruction is now idempotent; pending idle callbacks and settings signals are cleared before reattaching so no duplicate icons linger after shell restarts or position changes.

---

## [1.2.0] - 2025-11-05

### Added
- Automated CodeQL scanning workflow that runs on every push/PR to `main` and on a weekly schedule, surfacing JavaScript security issues early.
- Repository security guardrails: GitHub secret scanning with push protection, vulnerability alerts, and automated fixes.

### Improved
- Hardened clipboard HTML sanitization to remove script/style tags even when they contain trailing whitespace or attributes, preventing partial injections in copied text.

### Fixed
- Resolved CodeQL-reported sanitization warnings to keep the codebase clean for future scans.

---

## [1.1.2] - 2025-11-04

### Added
- Compatibility toggle in preferences (`Use Legacy Menu Rows`) so users can switch between the new Wayland-safe list rendering and the classic popup layout if their Shell version prefers it.

### Improved
- Rebuilt history rows with plain `St` actors, hover/focus styling, and inline badges to eliminate Wayland layout glitches and keep keyboard navigation responsive.
- Guarded menu assembly, added idle-driven rebuild fallbacks, and hardened copy notification settings to ensure the main menu always populates even when optional widgets misbehave.
- Throttled copy success notifications and GNOME Shell log output so rapid clipboard activity no longer spams toasts or the journal.
- Added context-aware badges, timestamp formatting, and schema-backed defaults for legacy shells.

### Fixed
- Prevented optional pagination/action sections from short-circuiting `_refreshHistory()` on GNOME 42–44.
- Resolved scenarios where rendered entry counts returned zero despite available history by automatically rebuilding the menu.
- Avoided redundant clipboard interface error logs when Wayland temporarily withholds access.

---

## [1.1.1] - 2025-10-31

### Improved
- Auto-focus the search field when the menu opens for faster access
- Settings validation with safe bounds for numeric options
- Content-type styling now uses CSS classes for reliable theming
- Friendlier empty-state messages (with guidance) 

### Performance
- Cached filtered results to speed up search and refresh on large histories

### Fixed
- Keyboard navigation (Enter/Space) now respects promote-on-copy behavior

---

## [1.1.0] - 2025-10-25

### Added
- Persistent clipboard history stored at `~/.config/clipflow-pro/history.json` with auto-save and optional logout wipe.
- Sensitive-entry auto-clear timers and improved duplicate filtering.
- Search-aware pagination controls in the main menu.
- Custom symbolic panel icon packaged via `icons/clipflow-pro-symbolic.svg`.
- Context menu integration toggles and asynchronous conflict detection.

### Changed
- Reorganised documentation under `docs/` and helper scripts under `tools/` to keep the project root tidy.
- Updated README/INSTALL guides to reflect new data paths and workflow.

### Fixed
- History list not rendering when menu sections were reactive containers.
- Highlight overflow that selected every entry in the popup.

---

## [1.0.0] - 2025-01-21

### ✨ Added - Initial Release
- **Core Clipboard Management**
  - Smart clipboard history with up to 1000 entries
  - Intelligent duplicate detection and filtering
  - Persistent storage that survives system restarts
  - Real-time clipboard monitoring with efficient memory usage

- **Advanced Organization**  
  - Pin system for frequently used clipboard entries
  - Star system for marking important content
  - Numbered entries for easy identification
  - Pagination for clean navigation through large histories

- **Search & Discovery**
  - Real-time search through clipboard history
  - Advanced filtering capabilities
  - Quick access to recently used entries
  - Content type detection and categorization

- **Productivity Features**
  - Auto-copy on text selection (optional)
  - One-click copy from history menu
  - Customizable keyboard shortcuts (Super+Shift+V default)
  - Quick access panel integration in GNOME top bar

- **File Manager Integration**
  - Right-click context menu integration
  - Copy full file paths, filenames, and directory paths
  - "Open Terminal Here" functionality
  - File information display (size, type, permissions)
  - Support for Nautilus, Nemo, Thunar, Dolphin, PCManFM

- **Comprehensive Settings**
  - 6 organized preference pages (General, Shortcuts, Behavior, Appearance, Privacy, About)
  - Modern GTK4-based preferences interface
  - Real-time configuration updates
  - Extensive customization options

- **Security & Privacy**
  - Automatic password field detection and filtering
  - Local-only storage with no cloud synchronization
  - Optional history clearing on logout
  - Content filtering for sensitive information
  - Secure JSON-based history storage

- **Professional Design**
  - Modern, responsive user interface
  - Custom CSS with smooth animations and transitions
  - Full accessibility support with keyboard navigation
  - Dark theme optimization
  - High contrast mode support
  - Reduced motion preferences support

- **Wide Compatibility**
  - GNOME Shell 40-47+ support
  - Full Wayland and X11/Xorg compatibility
  - Multi-distribution support (Ubuntu, Fedora, Zorin OS, Pop!_OS, Arch, Debian, openSUSE)

- **Developer Experience**
  - Comprehensive build system with Makefile
  - Automated validation and testing
  - Distribution package generation
  - Development mode with file watching
  - Proper version management tools

### 🔧 Technical Details
- Modern GNOME Shell extension architecture using ES6 modules
- Efficient GSettings schema with proper data validation
- Comprehensive error handling and logging
- Performance-optimized clipboard monitoring
- Memory-efficient storage with configurable limits
- Thread-safe operations for clipboard access

### 📚 Documentation
- Complete README with feature overview and usage instructions
- Detailed installation guide with distribution-specific instructions
- Troubleshooting guide with common issues and solutions
- Build system documentation for developers
- Contribution guidelines and issue templates

### 🌍 Internationalization
- Framework ready for multi-language support
- Gettext integration for string translation
- Locale directory structure prepared
- Translation contribution guidelines included

---

## Future Planned Features

### Version 1.2.0 (Planned)
- [ ] Plugin system for custom content processors
- [ ] Integration with password managers
- [ ] Advanced statistics and usage analytics
- [ ] Clipboard sharing between devices (local network)
- [ ] Bulk operations on clipboard history

### Version 2.0.0 (Future)
- [ ] Complete UI redesign with modern GNOME patterns
- [ ] Advanced AI-powered content organization
- [ ] Integration with GNOME ecosystem apps
- [ ] Enterprise features for organizations
- [ ] Advanced security features and encryption

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/nickotmazgin/clipflow-pro/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/nickotmazgin/clipflow-pro/discussions)
- 💖 **Donations**: [PayPal](https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW)

## License

ClipFlow Pro is licensed under the [GPL-3.0-or-later](LICENSE) license.
