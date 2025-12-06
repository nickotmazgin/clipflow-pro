## 1.3.4 — 2025-12-06

- UI: Unified Actions submenu (Sort/Filter inside; toggles for Capture PRIMARY / Pause Monitoring)
- Import/Export: folder preference + full-fidelity import (pinned/starred/timestamps)
- EGO compliance: async file reads in shell process; logs gated by setting; no spawn fallbacks
- Packaging: added package.sh; dual zips (43–44, 45–47); XML schemas only
- Screenshots: updated to 1.3.4 with new collage

# Changelog - ClipFlow Pro

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.3] - 2025-11-28

### Changed
- UI cleanup: minimal per‑entry actions (Copy + More in overflow), removed duplicate menu header, capped pinned chip strip for readability
- New appearance toggles: Hide Pinned Section, Hide Starred Section
- Defaults: Capture PRIMARY off on fresh installs to avoid stalls during screenshots

### Docs
- Screenshots refreshed: updated `docs/screenshots/1.3.3/2.png` and regenerated the 3×3 collage with a blue→purple gradient background; updated README and GitHub release assets for GNOME 45–47 and 43–44 releases

## [1.3.2] - 2025-11-27

- UI: Simplified history rows to Copy + More overflow menu.
- UI: Removed duplicate menu title header.
- UI: Pinned chip strip now capped (max 6 chips).
- Stability: Capped clipboard MIME fallback probing; added screenshot-app heuristic to avoid stalls during captures.
- Packaging: Added 43–44 build scripts; kept EGO‑friendly schema handling (no compiled schemas in zips).

### Refinements (no version bump)
- Bottom actions consolidated into a single “Actions” button that opens a compact popup (Clear, Settings, Export/Import, Purge, toggle PRIMARY; classic also includes Pin top/Unpin/Use Enhanced)
- Empty state hint updated: “Use Actions to open settings, import, or clear.”

_No changes yet._

---

## [1.2.17] - 2025-11-21

### Fixed
- Fixed `_decodeClipboardBytes` to properly handle GLib.Bytes objects with `get_data()`/`get_size()` methods
- Resolves issue where clipboard content from `get_content()` (HTML/URI payloads) was not being decoded correctly
- Fixes Codex review feedback about missing GLib.Bytes handling in clipboard decoding
- Security: Fixed clear-text logging of sensitive information in error messages
- Added `_sanitizeLogMessage()` to prevent sensitive clipboard data from being exposed in logs

---

## [1.2.16] - 2025-11-21

### Changed
- Updated PayPal donations field in metadata.json to use PayPal username format (nickotmazgin)

---

## [1.2.15] - 2025-11-21

### Changed
- Updated PayPal donations field in metadata.json to use donation URL instead of email address

---

## [1.2.14] - 2025-11-21

### Removed
- Removed `buildPrefsWidget()` function from prefs.js (not needed for GNOME 45+ packages)

### Added
- Added `donations` field to metadata.json with PayPal support

---

## [1.2.13] - 2025-11-20

### Removed
- Removed all debug/debugging code completely from prefs.js (Diagnostics section, self-check functionality)
- Removed all `_debugLog()` calls and method from extension.js
- Removed unnecessary try/catch blocks that only logged errors (per JustPerfection review feedback)

### Changed
- Simplified error handling: removed try/catch wrappers that only logged; errors now bubble with automatic backtraces in logs
- Removed `enable-debug-logs` setting connection and `_logEnabled` property

### Notes
- All debug logging code has been completely removed as requested
- ByteArray was already removed in 1.2.12
- Packaging and other functionality unchanged

---

## [1.2.12] - 2025-11-20

### Changed
- Removed deprecated ByteArray module usage from the ESM build; switched to TextEncoder/TextDecoder and GLib.Bytes toArray() where needed.
- Reduced additional try/catch wrappers that only logged; simplified context menu styling without try/catch.

### Notes
- Packaging unchanged (flat zip; no compiled schemas), prefs destroy()+super.destroy(), console.* logging remain in place.

---

## [1.2.11] - 2025-11-17

### Changed
- Removed remaining unnecessary try/catch wrappers around UI assembly (pagination/action rows) to simplify code and follow 45+ style guidance.
- Bumped version to 17 (1.2.11).

### Notes
- Packaging, logging, and prefs changes from 1.2.10 remain in effect; no functional changes.

---

## [1.2.10] - 2025-11-17

### Changed
- Removed `schemas/gschemas.compiled` from EGO package for GNOME 45+.
- Removed ExtensionUtils usage in ESM (no `Me`, settings passed from Extension; prefs opened via `Main.extensionManager.openExtensionPrefs`).
- Prefs: use `destroy()` + `super.destroy()`, removed noisy self-check and Me access, simplified 45+ window API.
- Logging: replaced `log()` with `console.*`; `console.debug()` only when debug enabled.
- Reduced unnecessary try/catch and type checks for readability.

### Notes
- Packaging remains flat; required files only (schemas XML, icons included).

---

## [1.2.9] - 2025-11-12

### Changed
- ASCII-only runtime logs: replaced emoji symbols in extension.js debug messages with plain [OK]/[WARN] tags for maximum locale/terminal compatibility.
- Preferences About list: replaced Unicode bullets with ASCII dashes.

### Notes
- No functional changes; packaging and EGO validation unchanged.

---

## [1.2.8] - 2025-11-12

### Fixed
- Ensure Extension subclass constructor(metadata) calls super(metadata) for GNOME 45+ ESM runtime.

### Added
- EGO packaging validator and Makefile target (`make ego-validate`) to lint zip structure and metadata.
- GitHub issue templates: EGO Review Feedback and Release Checklist.

### Changed
- Packaging Makefile consolidated around flat EGO zip + source zip and updated README developer tooling.

---

## [1.2.7] - 2025-11-12

### Changed
- Ported extension runtime to GNOME 45+ ES Modules (ESM) using resource:/// imports; removed legacy imports.* usage in `extension.js`.
- Preferences migrated to libadwaita integration and exported as an ESM `ExtensionPreferences` with `fillPreferencesWindow()`, restoring window header buttons on 45+.
- Trimmed `metadata.json` shell versions to ["45", "46", "47"] per reviewer guidance to avoid advertising untested versions.

### Notes
- This package now targets GNOME Shell 45 and newer. Use an older release/branch for 42–44.

---

## [1.2.6] - 2025-11-10

### Added
- Implemented the GNOME 45+ `fillPreferencesWindow()` path so the GTK4/libadwaita Extensions app can embed ClipFlow Pro’s preferences without falling back to the deprecated GTK3 widget loader.

### Changed
- Re-enabled official GNOME Shell 45–47 support in `metadata.json` after testing indicator, clipboard history, and shortcut handling on those releases.

---

## [1.2.5] - 2025-11-10

### Changed
- Restricted `metadata.json` compatibility list to GNOME Shell 42–44 so the extension is only advertised on versions that have been validated, addressing reviewer feedback about 45+ support.

---

## [1.2.4] - 2025-11-10

### Fixed
- Prevented the `make bump-version` helper from writing non-integer version values to `metadata.json`, which previously produced invalid GNOME extension manifests.
- Hardened clipboard list rendering so entries always appear in the main window even when history data is partially missing or malformed.

### Improved
- Hardened `safe-reload.sh` so it gracefully handles missing tooling (e.g. `jq`, `journalctl`, or the GNOME extensions CLI) while still guiding users through reload troubleshooting.

---

## [1.2.3] - 2025-11-10

### Added
- Preferences toggle (`Use Compact UI Layout`) to switch between the new boxed design and the slimmer legacy styling.

### Changed
- Compact mode inherits the lighter backgrounds, borders, and spacing from the original layout while keeping the new empty-state/scroll fixes.
- Release packaging now ships the extension inside the UUID directory with only compiled locale assets, aligning with extensions.gnome.org requirements.

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
## 1.3.0 — Unified Classic+ and Enhanced, GNOME 43–47

- One UUID across releases: `clipflow-pro@nickotmazgin.github.io`
- Two zips for EGO (same UUID):
  - GNOME 43–44 (legacy GJS) — Classic+ default
  - GNOME 45–47 (ESM) — Enhanced default
- Classic+ (both builds):
  - Pinned strip, Starred section, Others list
  - Quick filters (All / Pinned / Starred) with active highlighting
  - Per‑row actions: Pin, Star, Copy, Copy Cleaned, Delete
  - Show more / Show less
  - Keyboard shortcuts for filters and top item toggles
  - Export / Import, Purge duplicates, Pin Top 3/5, Unpin All
  - Reset to Defaults in Preferences → About → Maintenance
- Enhanced (45+):
  - Per‑row Copy & Copy Cleaned actions
  - Auto‑fallback to Classic if rendering blocked by theme/layout
- Stability:
  - Deferred clipboard monitoring start; throttled xclip/xsel fallbacks
  - Lazy menu build on first open
