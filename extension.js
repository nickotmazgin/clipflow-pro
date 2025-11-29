'use strict';

import St from 'gi://St';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Pango from 'gi://Pango';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const HISTORY_LIMIT_MIN = 10;
const HISTORY_LIMIT_MAX = 100;

// UUID constant used for opening prefs
const UUID = 'clipflow-pro@nickotmazgin.github.io';

var ClipFlowIndicator = GObject.registerClass(
class ClipFlowIndicator extends PanelMenu.Button {
    _init(settings = null) {
        super._init(0.0, _('ClipFlow Pro'));
        
        // Initialize settings (passed from Extension.enable)
        this._settings = settings;
        if (!this._settings) {
            throw new Error('ClipFlow Pro: Settings object is required to initialize the indicator.');
        }
        this._contextMenuManager = null;
        this._contextMenu = null;
        this._contextMenuNotificationItem = null;
        this._contextMenuRecentSection = null;
        this._contextMenuRecentLimit = this._settings.get_int('context-menu-items');
        this._contextMenuOpenChangedId = 0;
        this._menuOpenChangedId = 0;
        this._buttonPressId = 0;
        this._popupMenuId = 0;
        this._menuContainerItem = null;
        this._menuContainerBox = null;
        this._keybindingRegistrations = new Map();
        this._actionModeMask = this._computeActionModeMask();
        this._historyScrollView = null;
        this._historyContainer = null;
        this._paginationBox = null;
        this._paginationLabel = null;
        this._paginationPrevButton = null;
        this._paginationNextButton = null;
        this._historySaveTimeout = 0;
        this._autoClearTimeouts = new Map();
        this._storageDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'clipflow-pro']);
        this._historyFile = GLib.build_filenamev([this._storageDir, 'history.json']);
        this._historySaveDelaySeconds = 1;
        this._autoClearDurationSeconds = 300;
        this._currentPage = 0;
        this._skipCleanupOnDestroy = false;
        this._iconThemeRegistered = false;
        this._icon = null;
        this._panelSignalIds = [];
        this._displaySignalIds = [];
        this._menuRebuildInProgress = false;
        this._useLegacyHistoryRows = this._settings.get_boolean('use-legacy-menu-items');
        // Shell version detection for compatibility defaults
        this._shellMajor = 0;
        try {
            const pkg = String(Config.PACKAGE_VERSION || '0');
            this._shellMajor = parseInt(pkg.split('.')[0]) || 0;
        } catch (_e) {
            this._shellMajor = 0;
        }
        if (this._shellMajor > 0 && this._shellMajor < 45) {
            // Prefer classic/legacy rows on GNOME 43–44 for stability
            this._useLegacyHistoryRows = true;
        }
        this._copyNotifyMinIntervalMs = 1500;
        this._lastCopyNotifyTime = 0;
        this._lastCopyNotifyText = '';
        this._logThrottle = new Map();
        this._logRateLimitMs = 5000;
        this._deferredSourceIds = new Set();
        this._destroyed = false;
        this._clipboardNotifyShown = false;
        this._useCompactUI = this._settings.get_boolean('use-compact-ui');
        this._filterMode = 'all';

        // Initialize clipboard history
        this._clipboardHistory = [];
        this._maxHistory = this._settings.get_int('max-entries');
        this._entriesPerPage = Math.max(5, this._settings.get_int('entries-per-page'));
        this._isMonitoring = false;
        this._clipboard = null;
        this._clipboardOwnerChangeId = 0;
        this._selection = null;
        this._selectionOwnerChangedId = 0;
        this._clipboardCheckTimeout = 0;
        this._clipboardTimeout = null; // Retained for cleanup during transitions
        this._clipboardPollId = 0;
        this._clipboardPollIntervalMs = 750;
        this._clipboardRetryTimeoutId = 0;
        this._clipboardRetryAttempts = 0;
        this._clipboardRetryNotified = false;
        this._lastClipboardText = '';
        this._lastPrimaryText = '';
        this._monitoringResumeTimeoutId = 0;
        this._settingsSignalIds = [];
        this._searchDebounceTimeout = 0;
        this._filteredHistoryCache = null;
        this._filterCacheValid = false;
        this._lastSearchText = null;
        // Avoid excessive MIME probing on non-text clipboards (e.g., screenshots)
        this._maxTextMimeTries = 6; // hard cap for text MIME probing
        this._textMimeTypes = [
            'text/plain',
            'text/plain;charset=utf-8',
            'text/plain;charset=UTF-8',
            'UTF8_STRING',
            'STRING',
            'TEXT',
            'COMPOUND_TEXT',
            'text/uri-list',
            'x-special/gnome-copied-files',
            'text/html',
            'text/html;charset=utf-8',
            'text/html;charset=UTF-8'
        ];
        
        // Validate and sanitize settings on startup
        this._validateSettings();
        
        // Connect to settings changes
        this._settingsSignalIds.push(this._settings.connect('changed::max-entries', () => {
            const newValue = this._settings.get_int('max-entries');
            this._maxHistory = this._clampHistorySize(newValue);
            if (this._maxHistory !== newValue) {
                this._settings.set_int('max-entries', this._maxHistory);
            }
            this._trimHistory();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::show-copy-notifications', () => {
            this._syncContextMenuToggles();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::entries-per-page', () => {
            const newValue = this._settings.get_int('entries-per-page');
            this._entriesPerPage = Math.max(5, Math.min(50, newValue));
            if (this._entriesPerPage !== newValue) {
                this._settings.set_int('entries-per-page', this._entriesPerPage);
            }
            this._currentPage = 0;
            this._refreshHistory();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::auto-clear-sensitive', () => {
            this._updateAutoClearTimers();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::use-compact-ui', () => {
            this._useCompactUI = this._settings.get_boolean('use-compact-ui');
            this._applyUiStyle();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::context-menu-items', () => {
            const newValue = this._settings.get_int('context-menu-items');
            const clamped = Math.max(1, Math.min(20, newValue));
            if (clamped !== newValue) {
                this._settings.set_int('context-menu-items', clamped);
            }
            this._contextMenuRecentLimit = clamped;
            this._populateContextMenuRecentEntries();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::use-legacy-menu-items', () => {
            const val = this._settings.get_boolean('use-legacy-menu-items');
            this._useLegacyHistoryRows = (this._shellMajor > 0 && this._shellMajor < 45) ? true : val;
            this._buildMenu();
        }));
        ['show-menu-shortcut', 'enhanced-copy-shortcut', 'enhanced-paste-shortcut'].forEach(key => {
            this._settingsSignalIds.push(this._settings.connect(`changed::${key}`, () => {
                this._registerKeybindings();
            }));
        });
        
        this._createIcon();
        this._watchPanelForIconSize();
        this._buildContextMenu();
        this._loadHistoryFromDisk();
        this._buildMenu();
        this._startClipboardMonitoring();
        this._registerKeybindings();
        
        // Connect menu open/close signals to refresh history when menu opens
        if (this.menu) {
            if (this._menuOpenChangedId) {
                this.menu.disconnect(this._menuOpenChangedId);
            }
            this._menuOpenChangedId = this.menu.connect('open-state-changed', (menu, open) => {
                if (open && this._historyContainer) {
                    this._refreshHistory();
                }
            });
        }
        
        this._buttonPressId = this.connect('button-press-event', this._onButtonPressEvent.bind(this));
        this._popupMenuId = this.connect('popup-menu', this._onPopupMenu.bind(this));
    }

    _addIndicatorIcon() {
        const icon = new St.Icon({
            style_class: 'system-status-icon clipflow-pro-panel-icon',
            icon_name: 'edit-paste-symbolic'
        });
        icon.set_icon_size(16);
        return icon;
    }

    _createIcon() {
        // Remove existing icon if we're rebuilding
        if (this._icon) {
            const parent = this._icon.get_parent();
            if (parent && typeof parent.remove_child === 'function') {
                parent.remove_child(this._icon);
            }
            this._icon.destroy();
            this._icon = null;
        }

        this._ensureIconThemeRegistered();

        const icon = this._addIndicatorIcon();
        this._icon = icon;

        if (typeof this.add_child === 'function') {
            this.add_child(icon);
        } else if (this.actor && typeof this.actor.add_child === 'function') {
            this.actor.add_child(icon);
        } else if (typeof this.add_actor === 'function') {
            this.add_actor(icon);
        }

        this._updateIconState();
    }

    _resolveActor(target) {
        if (!target || typeof target !== 'object') {
            return null;
        }

        if (typeof target.add_style_class_name === 'function' ||
            typeof target.add_child === 'function' ||
            typeof target.hide === 'function') {
            return target;
        }

        if (target.actor) {
            return this._resolveActor(target.actor);
        }

        if (target.box) {
            return this._resolveActor(target.box);
        }

        if (target._actor) {
            return this._resolveActor(target._actor);
        }

        return null;
    }

    _addStyleClass(target, className) {
        const actor = this._resolveActor(target);
        if (actor && typeof actor.add_style_class_name === 'function') {
            actor.add_style_class_name(className);
        }
    }

    _addActorToUiGroup(target) {
        const actor = this._resolveActor(target);
        if (!actor) {
            return null;
        }

        if (Main.uiGroup && typeof Main.uiGroup.add_child === 'function') {
            Main.uiGroup.add_child(actor);
        } else if (Main.uiGroup && typeof Main.uiGroup.add_actor === 'function') {
            Main.uiGroup.add_actor(actor);
        }

        return actor;
    }

    _getCharacterArray(text) {
        if (!text) {
            return [];
        }

        try {
            return Array.from(text);
        } catch (_error) {
            return String(text).split('');
        }
    }

    _characterLength(text) {
        return this._getCharacterArray(text).length;
    }

    _truncateText(text, limit) {
        if (!text || limit <= 0) {
            return '';
        }

        const chars = this._getCharacterArray(text);
        if (chars.length <= limit) {
            return text;
        }

        return chars.slice(0, limit).join('');
    }

    _normalizeClipboardText(value) {
        if (value === null || value === undefined) {
            return '';
        }

        if (typeof value === 'string') {
            return value;
        }

        // GLib.Bytes or similar object with toArray(): decode as UTF‑8
        try {
            if (value && typeof value.toArray === 'function') {
                const u8 = Uint8Array.from(value.toArray());
                return new TextDecoder('utf-8').decode(u8);
            }
        } catch (_e) { /* fall through */ }

        // Uint8Array: decode as UTF‑8
        try {
            if (value instanceof Uint8Array) {
                return new TextDecoder('utf-8').decode(value);
            }
        } catch (_e) { /* fall through */ }

        const fallback = String(value ?? '');
        const trimmed = fallback.trim();
        if (!trimmed || trimmed === '[object Object]' || trimmed === 'undefined' || trimmed === 'null') {
            return '';
        }
        return fallback;
    }

    _decodeClipboardBytes(bytes, mimetype) {
        if (!bytes) {
            return '';
        }

        let text = '';
        try {
            if (typeof bytes === 'string') {
                text = bytes;
            } else if (bytes && typeof bytes.get_data === 'function' && typeof bytes.get_size === 'function') {
                // GLib.Bytes object: use get_data() and get_size()
                const size = bytes.get_size();
                if (size > 0) {
                    const data = bytes.get_data();
                    if (data) {
                        const u8 = new Uint8Array(data);
                        text = new TextDecoder('utf-8').decode(u8);
                    }
                }
            } else if (bytes && typeof bytes.toArray === 'function') {
                const u8 = Uint8Array.from(bytes.toArray());
                text = new TextDecoder('utf-8').decode(u8);
            } else if (bytes instanceof Uint8Array) {
                text = new TextDecoder('utf-8').decode(bytes);
            }
        } catch (error) {
            // Failed to convert clipboard bytes
        }
        if (!text) {
            return '';
        }

        const mime = String(mimetype || '').toLowerCase();
        const baseMime = mime.split(';')[0];

        if (baseMime === 'x-special/gnome-copied-files' || baseMime === 'text/uri-list') {
            // Convert newline-separated URIs/paths into a user-friendly list
            // Handle Nautilus/Files format: "copy\nfile:///path1\nfile:///path2" or "cut\nfile:///path"
            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const payload = lines
                .filter(line => line !== 'copy' && line !== 'cut') // Skip Nautilus header
                .map(line => {
                    if (line.startsWith('file://')) {
                        try {
                            // Decode URI and remove file:// prefix for clean display
                            return decodeURI(line.replace(/^file:\/\//, ''));
                        } catch (_e) {
                            // Fallback: just strip the prefix if URI decode fails
                            return line.replace(/^file:\/\//, '');
                        }
                    }
                    return line;
                });
            text = payload.join('\n');
        } else if (baseMime === 'text/html') {
            text = this._stripClipboardHtml(text);
        }

        return text;
    }

    _stripClipboardHtml(html) {
        if (!html) {
            return '';
        }

        const sanitize = (input, regex, replacement = '') => {
            let previous = input;
            let current = input;
            do {
                previous = current;
                current = current.replace(regex, replacement);
            } while (current !== previous);
            return current;
        };

        let text = String(html);
        text = sanitize(text, /<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\b[^>]*>/gi);
        text = sanitize(text, /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\b[^>]*>/gi);
        text = sanitize(text, /<br\s*\/?>/gi, '\n');
        text = sanitize(text, /<\/(p|div|li|tr|h[1-6])>/gi, '\n');
        text = sanitize(text, /<td>/gi, '\t');
        text = sanitize(text, /<[^>]+>/g);

        // Collapse excessive whitespace but keep intentional newlines
        text = sanitize(text, /\r/g);
        text = sanitize(text, /\n{3,}/g, '\n\n');
        text = text.replace(/[<>]/g, '');
        return text.trim();
    }

    _hideActor(target) {
        const actor = this._resolveActor(target);
        if (!actor) {
            return;
        }

        if (typeof actor.hide === 'function') {
            actor.hide();
        } else {
            actor.visible = false;
        }
    }
    
    _updateIconState() {
        if (!this._icon) return;
        
        const hasEntries = this._clipboardHistory.length > 0;
        const isMonitoring = this._isMonitoring;
        
        if (!isMonitoring && hasEntries) {
            this._icon.opacity = 160;
        } else {
            this._icon.opacity = 255;
        }
    }

    _computeIconSize() {
        try {
            const override = this._settings.get_int('icon-size-override');
            if (override && override > 0) return override;
            const panel = Main.panel;
            if (!panel) return 16;
            const height = typeof panel.height === 'number' ? panel.height : 24;
            const scale = (global.display && typeof global.display.get_monitor_scale === 'function')
                ? global.display.get_monitor_scale(global.display.get_primary_monitor())
                : 1;
            const size = Math.max(12, Math.min(24, Math.round(height * 0.8 * scale)));
            return size;
        } catch (_e) {
            return 16;
        }
    }

    _setIconSize(size) {
        if (!this._icon) return;
        if (typeof this._icon.set_icon_size === 'function') {
            this._icon.set_icon_size(size);
        } else if ('icon_size' in this._icon) {
            this._icon.icon_size = size;
        }
    }

    _disconnectPanelWatchers() {
        const panel = Main.panel;
        if (panel && Array.isArray(this._panelSignalIds)) {
            this._panelSignalIds.forEach(id => {
                if (typeof id === 'number' && id > 0) {
                    panel.disconnect(id);
                }
            });
        }
        this._panelSignalIds = [];

        const display = global.display;
        if (display && Array.isArray(this._displaySignalIds)) {
            this._displaySignalIds.forEach(id => {
                if (typeof id === 'number' && id > 0) {
                    display.disconnect(id);
                }
            });
        }
        this._displaySignalIds = [];
    }

    _watchPanelForIconSize() {
        const panel = Main.panel;
        if (!panel) return;

        this._disconnectPanelWatchers();
        // Apply immediately
        this._setIconSize(this._computeIconSize());

        const onChange = () => {
            this._setIconSize(this._computeIconSize());
        };

        const id1 = panel.connect('style-changed', onChange);
        if (typeof id1 === 'number' && id1 > 0) this._panelSignalIds.push(id1);

        const id2 = panel.connect('notify::height', onChange);
        if (typeof id2 === 'number' && id2 > 0) this._panelSignalIds.push(id2);

        const display = global.display;
        if (display) {
            const id3 = display.connect('notify::scale-factor', onChange);
            if (typeof id3 === 'number' && id3 > 0) this._displaySignalIds.push(id3);
        }
    }

    _ensureIconThemeRegistered() {
        try {
            if (!this._iconThemeRegistered) {
                // Icons are referenced via Gio.FileIcon; no theme path change needed.
                this._iconThemeRegistered = true;
            }
        } catch (error) {
            console.warn(`ClipFlow Pro: Failed to register icon theme path: ${error}`);
        }
    }


    _logThrottled(key, message, minIntervalMs = this._logRateLimitMs) {
        try {
            const now = GLib.get_monotonic_time();
            const intervalUs = Math.max(0, minIntervalMs) * 1000;
            const lastLog = this._logThrottle.get(key) || 0;
            if (now - lastLog < intervalUs) {
                return;
            }
            this._logThrottle.set(key, now);
            // Sanitize message to prevent logging sensitive data
            const sanitized = this._sanitizeLogMessage(message);
            console.warn(sanitized);
        } catch (error) {
            // Fallback: if throttling fails, log once to avoid silence on critical errors
            // Sanitize to prevent sensitive data exposure
            const sanitized = this._sanitizeLogMessage(message);
            console.warn(sanitized);
        }
    }

    _sanitizeLogMessage(message) {
        if (!message || typeof message !== 'string') {
            return String(message || '');
        }
        // Remove potential sensitive data patterns
        // Limit message length to prevent accidental data exposure
        const maxLength = 200;
        let sanitized = message.substring(0, maxLength);
        // Remove any clipboard-like content that might have leaked into error messages
        // This is a safety measure - error messages should not contain clipboard data
        sanitized = sanitized.replace(/clipboard[:\s]+[^\n]{20,}/gi, 'clipboard: [redacted]');
        return sanitized;
    }

    _clampHistorySize(value) {
        return Math.max(HISTORY_LIMIT_MIN, Math.min(HISTORY_LIMIT_MAX, value));
    }

    _invalidateFilterCache(resetSearch = false) {
        this._filterCacheValid = false;
        this._filteredHistoryCache = null;
        if (resetSearch) {
            this._lastSearchText = null;
        }
    }

    _scheduleIdle(callback, priority = GLib.PRIORITY_DEFAULT_IDLE) {
        let sourceId = 0;
        sourceId = GLib.idle_add(priority, () => {
            this._deferredSourceIds.delete(sourceId);
            return callback();
        });
        if (sourceId) {
            this._deferredSourceIds.add(sourceId);
        }
        return sourceId;
    }

    _scheduleTimeout(delayMs, callback, priority = GLib.PRIORITY_DEFAULT) {
        let sourceId = 0;
        sourceId = GLib.timeout_add(priority, delayMs, () => {
            this._deferredSourceIds.delete(sourceId);
            return callback();
        });
        if (sourceId) {
            this._deferredSourceIds.add(sourceId);
        }
        return sourceId;
    }

    _clearDeferredSources() {
        if (!this._deferredSourceIds) {
            return;
        }
        for (const sourceId of this._deferredSourceIds) {
            GLib.source_remove(sourceId);
        }
        this._deferredSourceIds.clear();
    }

    _destroyActor(actor) {
        if (!actor) {
            return;
        }
        try {
            if (actor._clipflowDestroyed) {
                return;
            }
            if (typeof actor.destroy === 'function') {
                actor.destroy();
            } else if (actor.actor && typeof actor.actor.destroy === 'function') {
                actor.actor.destroy();
            }
            actor._clipflowDestroyed = true;
        } catch (error) {
            // Actor destroy failed
        }
    }

    _validateSettings() {
        try {
            // Validate max-entries (10-100)
            const maxEntries = this._settings.get_int('max-entries');
            const clampedEntries = this._clampHistorySize(maxEntries);
            if (clampedEntries !== maxEntries) {
                this._settings.set_int('max-entries', clampedEntries);
            }
            this._maxHistory = clampedEntries;

            // Validate entries-per-page (5-50)
            const entriesPerPage = this._settings.get_int('entries-per-page');
            if (entriesPerPage < 5 || entriesPerPage > 50) {
                const corrected = Math.max(5, Math.min(50, entriesPerPage));
                this._settings.set_int('entries-per-page', corrected);
                this._entriesPerPage = corrected;
            }

            // Validate max-entry-length (100-10000)
            const maxEntryLength = this._settings.get_int('max-entry-length');
            if (maxEntryLength < 100 || maxEntryLength > 10000) {
                const corrected = Math.max(100, Math.min(10000, maxEntryLength));
                this._settings.set_int('max-entry-length', corrected);
            }

            // Validate min-entry-length (0-100)
            const minEntryLength = this._settings.get_int('min-entry-length');
            if (minEntryLength < 0 || minEntryLength > 100) {
                const corrected = Math.max(0, Math.min(100, minEntryLength));
                this._settings.set_int('min-entry-length', corrected);
            }

            // Validate context-menu-items (1-20)
            const contextMenuItems = this._settings.get_int('context-menu-items');
            if (contextMenuItems < 1 || contextMenuItems > 20) {
                const corrected = Math.max(1, Math.min(20, contextMenuItems));
                this._settings.set_int('context-menu-items', corrected);
                this._contextMenuRecentLimit = corrected;
            }

            // Validate icon-size-override (0-64)
            const iconSizeOverride = this._settings.get_int('icon-size-override');
            if (iconSizeOverride < 0 || iconSizeOverride > 64) {
                this._settings.set_int('icon-size-override', 0);
            }

            // Validate copied-preview-length (5-200)
            const previewLength = this._settings.get_int('copied-preview-length');
            if (previewLength < 5 || previewLength > 200) {
                const corrected = Math.max(5, Math.min(200, previewLength));
                this._settings.set_int('copied-preview-length', corrected);
            }

            // Validate pause-duration-minutes (1-120)
            const pauseMinutes = this._settings.get_int('pause-duration-minutes');
            if (pauseMinutes < 1 || pauseMinutes > 120) {
                const corrected = Math.max(1, Math.min(120, pauseMinutes));
                this._settings.set_int('pause-duration-minutes', corrected);
            }
        } catch (error) {
            console.warn(`ClipFlow Pro: Error validating settings: ${error}`);
        }
    }

    // Safe settings access with fallback defaults
    _safeGetInt(key, defaultValue) {
        try {
            if (!this._settings) {
                return defaultValue;
            }
            return this._settings.get_int(key);
        } catch (error) {
            return defaultValue;
        }
    }

    _safeGetBoolean(key, defaultValue) {
        try {
            if (!this._settings) {
                return defaultValue;
            }
            return this._settings.get_boolean(key);
        } catch (error) {
            return defaultValue;
        }
    }

    _safeGetString(key, defaultValue) {
        try {
            if (!this._settings) {
                return defaultValue;
            }
            return this._settings.get_string(key) || defaultValue;
        } catch (error) {
            return defaultValue;
        }
    }

    _buildMenu() {
        // Clear existing menu
        this.menu.removeAll();
        
        // Add ClipFlow-specific style class to menu to scope CSS properly
        if (this.menu && typeof this.menu.add_style_class_name === 'function') {
            this.menu.add_style_class_name('clipflow-menu');
        } else if (this.menu && this.menu.actor && typeof this.menu.actor.add_style_class_name === 'function') {
            this.menu.actor.add_style_class_name('clipflow-menu');
        }
        
        // Optional header removed to avoid duplicate title text and reduce visual clutter
        
        if (this._menuContainerItem) {
            this._menuContainerItem.destroy();
            this._menuContainerItem = null;
            this._menuContainerBox = null;
        }

        this._menuContainerItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });
        const container = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });
        if (typeof container.set_spacing === 'function')
            container.set_spacing(10);
        container.add_style_class_name('clipflow-main-container');
        // GNOME 45+ removed .actor; support both
        if (typeof this._menuContainerItem.add_child === 'function') {
            this._menuContainerItem.add_child(container);
            this._menuContainerItem.x_expand = true;
            this._menuContainerItem.y_expand = true;
        } else if (this._menuContainerItem.actor && typeof this._menuContainerItem.actor.add_child === 'function') {
            this._menuContainerItem.actor.add_child(container);
            this._menuContainerItem.actor.x_expand = true;
            this._menuContainerItem.actor.y_expand = true;
        }
        this.menu.addMenuItem(this._menuContainerItem);
        this._menuContainerBox = container;
        this._applyUiStyle();

        const searchRow = this._createSearchRow();
        container.add_child(searchRow);

        // History container and pagination
        this._historyScrollView = new St.ScrollView({
            style_class: 'clipflow-history-scroll',
            overlay_scrollbars: false,
            x_expand: true,
            y_expand: true
        });
        if (typeof this._historyScrollView.set_margin_right === 'function') {
            this._historyScrollView.set_margin_right(10);
        }
        if (typeof this._historyScrollView.set_margin_bottom === 'function') {
            this._historyScrollView.set_margin_bottom(8);
        }

        if (typeof this._historyScrollView.set_policy === 'function') {
            if (St.PolicyType) {
                this._historyScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
            } else if (Clutter.PolicyType) {
                this._historyScrollView.set_policy(Clutter.PolicyType.NEVER, Clutter.PolicyType.AUTOMATIC);
            }
        }

        this._historyContainer = new St.BoxLayout({
            vertical: true,
            x_expand: true
        });
        if (typeof this._historyContainer.add_style_class_name === 'function') {
            this._historyContainer.add_style_class_name('clipflow-history-list');
        }
        if (typeof this._historyContainer.set_spacing === 'function') {
            this._historyContainer.set_spacing(4);
        } else if (typeof this._historyContainer.get_layout_manager === 'function') {
            const layout = this._historyContainer.get_layout_manager();
            if (layout && 'spacing' in layout)
                layout.spacing = 4;
        }

        if (typeof this._historyScrollView.set_child === 'function') {
            this._historyScrollView.set_child(this._historyContainer);
        } else if (typeof this._historyScrollView.add_child === 'function') {
            this._historyScrollView.add_child(this._historyContainer);
        } else {
            this._historyScrollView.add_actor(this._historyContainer);
        }

        container.add_child(this._historyScrollView);

        const paginationRow = this._createPaginationControls();
        if (paginationRow)
            container.add_child(paginationRow);

        const actionRow = this._createActionButtons();
        if (actionRow)
            container.add_child(actionRow);

        // Load initial history - ensure container exists first
        if (this._historyContainer) {
            this._refreshHistory();
        }
    }

    _buildContextMenu() {
        if (this._contextMenu) {
            if (this._contextMenuOpenChangedId) {
                this._contextMenu.disconnect(this._contextMenuOpenChangedId);
                this._contextMenuOpenChangedId = 0;
            }
            this._contextMenu.destroy();
            this._contextMenu = null;
        }

        if (!this._contextMenuManager) {
            this._contextMenuManager = new PopupMenu.PopupMenuManager(this);
        }

        this._contextMenu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
        const contextMenuActor = this._addActorToUiGroup(this._contextMenu);
        this._addStyleClass(contextMenuActor, 'clipflow-context-menu');
        this._hideActor(contextMenuActor);
        this._contextMenuManager.addMenu(this._contextMenu);

        this._contextMenuNotificationItem = new PopupMenu.PopupSwitchMenuItem(
            _('Show Notifications'),
            this._settings.get_boolean('show-copy-notifications')
        );
        this._applyContextMenuItemStyle(this._contextMenuNotificationItem);
        this._contextMenuNotificationItem.connect('toggled', (_item, state) => {
            if (this._settings.get_boolean('show-copy-notifications') !== state) {
                this._settings.set_boolean('show-copy-notifications', state);
            }
        });
        this._contextMenu.addMenuItem(this._contextMenuNotificationItem);

        const recentHeader = new PopupMenu.PopupMenuItem(_('Recent Clips'), {
            reactive: false,
            can_focus: false
        });
        recentHeader.setSensitive(false);
        this._addStyleClass(recentHeader, 'clipflow-context-header');
        this._contextMenu.addMenuItem(recentHeader);

        this._contextMenuRecentSection = new PopupMenu.PopupMenuSection();
        this._contextMenu.addMenuItem(this._contextMenuRecentSection);

        this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const openClipboardItem = this._contextMenu.addAction(_('Open Clipboard Menu'), () => {
            this._contextMenu.close();
            this.menu.open(true);
        });
        this._applyContextMenuItemStyle(openClipboardItem);

        const togglePrimaryItem = this._contextMenu.addAction(_('Capture PRIMARY Selection'), () => {
            const current = this._settings.get_boolean('capture-primary');
            this._settings.set_boolean('capture-primary', !current);
            this._syncContextMenuToggles();
        });
        this._applyContextMenuItemStyle(togglePrimaryItem);

        const settingsItem = this._contextMenu.addAction(_('Settings'), () => {
            this._openPreferencesTab('general');
        });
        this._applyContextMenuItemStyle(settingsItem);

        const aboutItem = this._contextMenu.addAction(_('About ClipFlow Pro'), () => {
            this._openPreferencesTab('about');
        });
        this._applyContextMenuItemStyle(aboutItem);

        const clearHistoryItem = this._contextMenu.addAction(_('Clear All History'), () => {
            this._clearAllHistory();
        });
        this._applyContextMenuItemStyle(clearHistoryItem);

        const copyLastItem = this._contextMenu.addAction(_('Copy Last Entry'), () => {
            if (this._clipboardHistory.length > 0) {
                this._copyToClipboard(this._clipboardHistory[0].text);
            } else {
                Main.notify('ClipFlow Pro', _('No clipboard entries yet'));
            }
        });
        this._applyContextMenuItemStyle(copyLastItem);

        const pauseLabel = _('Pause Monitoring for %d min').format(Math.max(1, this._settings.get_int('pause-duration-minutes')));
        const pauseItem = this._contextMenu.addAction(pauseLabel, () => {
            const minutes = Math.max(1, this._settings.get_int('pause-duration-minutes'));
            this._pauseMonitoring(minutes);
        });
        this._applyContextMenuItemStyle(pauseItem);

        this._contextMenuOpenChangedId = this._contextMenu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen) {
                this.menu.close();
                this._syncContextMenuToggles();
            }
        });

        if (this._menuOpenChangedId) {
            this.menu.disconnect(this._menuOpenChangedId);
        }
        this._menuOpenChangedId = this.menu.connect('open-state-changed', (_menu, isOpen) => {
            if (isOpen && this._contextMenu && this._contextMenu.isOpen) {
                this._contextMenu.close();
            }
            // Refresh history when menu opens to ensure latest entries are shown
            if (isOpen) {
                this._refreshHistory();
                // Focus search entry for immediate typing
                if (this._searchEntry && typeof this._searchEntry.grab_key_focus === 'function') {
                    this._scheduleIdle(() => {
                        try {
                            this._searchEntry.grab_key_focus();
                        } catch (_e) {
                            // Best effort - some Shell versions may not support this
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                }
            }
            // Clear search when menu closes
            if (!isOpen && this._searchEntry) {
                this._searchEntry.clutter_text.set_text('');
            }
        });

        this._populateContextMenuRecentEntries();
    }

    _syncContextMenuToggles() {
        if (this._contextMenuNotificationItem && typeof this._contextMenuNotificationItem.setToggleState === 'function') {
            this._contextMenuNotificationItem.setToggleState(this._settings.get_boolean('show-copy-notifications'));
        }
    }

    _populateContextMenuRecentEntries() {
        if (!this._contextMenuRecentSection) {
            return;
        }

        if (typeof this._contextMenuRecentSection.removeAll === 'function') {
            this._contextMenuRecentSection.removeAll();
        } else if (this._contextMenuRecentSection.actor && typeof this._contextMenuRecentSection.actor.destroy_all_children === 'function') {
            this._contextMenuRecentSection.actor.destroy_all_children();
        }

        const recentEntries = this._clipboardHistory.slice(0, this._contextMenuRecentLimit);
        if (recentEntries.length === 0) {
            const emptyItem = new PopupMenu.PopupMenuItem(_('No clipboard entries yet'), {
                reactive: false,
                can_focus: false
            });
            emptyItem.setSensitive(false);
            this._applyContextMenuItemStyle(emptyItem);
            this._contextMenuRecentSection.addMenuItem(emptyItem);
            return;
        }

        recentEntries.forEach((item, index) => {
            const label = this._formatContextMenuEntry(item, index);
            const entryItem = new PopupMenu.PopupMenuItem(label);
            this._applyContextMenuItemStyle(entryItem);
            entryItem.connect('activate', () => {
                this._copyToClipboard(item.text);
                if (this._contextMenu) {
                    this._contextMenu.close();
                }
            });
            this._contextMenuRecentSection.addMenuItem(entryItem);
        });
    }

    _formatContextMenuEntry(item, index) {
        let raw = '';
        if (item) {
            if (item.preview) {
                raw = item.preview;
            } else if (item.text) {
                raw = item.text;
            }
        }
        const singleLine = raw.replace(/\s+/g, ' ').trim();
        const maxLength = 60;
        let display = singleLine;
        const displayChars = this._getCharacterArray(display);
        if (displayChars.length > maxLength) {
            display = `${displayChars.slice(0, maxLength - 3).join('')}...`;
        }
        return `${index + 1}. ${display || _('(Empty entry)')}`;
    }

    _applyContextMenuItemStyle(menuItem) {
        if (!menuItem)
            return;
        menuItem.add_style_class_name?.('clipflow-context-item');
        menuItem.actor?.add_style_class_name?.('clipflow-context-item');
    }

    _openContextMenu() {
        if (!this._contextMenu) {
            return;
        }

        this._populateContextMenuRecentEntries();
        this._syncContextMenuToggles();

        if (this._contextMenu.isOpen) {
            this._contextMenu.close();
        } else {
            this._contextMenu.open(true);
        }
    }

    _onButtonPressEvent(_actor, event) {
        if (!event) {
            return Clutter.EVENT_PROPAGATE;
        }

        const button = event.get_button();
        if (button === Clutter.BUTTON_SECONDARY) {
            this._openContextMenu();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onPopupMenu() {
        this._openContextMenu();
    }

    _createSearchRow() {
        const searchContainer = new St.BoxLayout({
            vertical: false,
            x_expand: true,
        });
        if (typeof searchContainer.set_spacing === 'function') {
            searchContainer.set_spacing(8);
        } else if (typeof searchContainer.get_layout_manager === 'function') {
            const layout = searchContainer.get_layout_manager();
            if (layout && 'spacing' in layout)
                layout.spacing = 8;
        }
        searchContainer.add_style_class_name('clipflow-search-container');
        searchContainer.set_margin_bottom(6);
        
        this._searchEntry = new St.Entry({
            hint_text: _('Search clipboard history…'),
            can_focus: true,
            x_expand: true
        });
        
        this._searchEntry.add_style_class_name('clipflow-search');
        this._searchEntry.clutter_text.set_max_length(100);
        if (typeof this._searchEntry.clutter_text.set_single_line_mode === 'function') {
            this._searchEntry.clutter_text.set_single_line_mode(true);
        }
        
        this._searchEntry.clutter_text.connect('text-changed', () => {
            // Debounce search for better performance
            if (this._searchDebounceTimeout) {
                GLib.source_remove(this._searchDebounceTimeout);
            }
            this._searchDebounceTimeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT, 150, () => {
                    this._searchDebounceTimeout = 0;
                    this._filterHistory();
                    return GLib.SOURCE_REMOVE;
                }
            );
        });
        
        // Add keyboard shortcut hint
        this._searchEntry.clutter_text.connect('key-press-event', (actor, event) => {
            const key = event.get_key_symbol();
            if (key === Clutter.KEY_Escape) {
                this._searchEntry.clutter_text.set_text('');
                this._searchEntry.clutter_text.emit('text-changed');
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        
        searchContainer.add_child(this._searchEntry);
        // Quick filter buttons: All / Pinned / Starred
        const mkFilterBtn = (label, mode) => {
            const b = new St.Button({ label, style_class: 'clipflow-button' });
            b.add_style_class_name('clipflow-button-secondary');
            b.connect('clicked', () => { this._filterMode = mode; this._filterHistory(); });
            return b;
        };
        searchContainer.add_child(mkFilterBtn(_('All'), 'all'));
        searchContainer.add_child(mkFilterBtn(_('Pinned'), 'pinned'));
        searchContainer.add_child(mkFilterBtn(_('Starred'), 'starred'));

        return searchContainer;
    }

    _createActionButtons() {
        // Single, spacious button that opens a compact actions menu
        const buttonContainer = new St.BoxLayout({ vertical: false, x_expand: true });
        buttonContainer.add_style_class_name('clipflow-action-container');

        const menuButton = new St.Button({
            label: _('Menu'),
            style_class: 'clipflow-button'
        });
        menuButton.add_style_class_name('clipflow-button-secondary');
        menuButton.set_accessible_name(_('Open actions menu'));
        menuButton.connect('clicked', () => this._openMainActionsMenu(menuButton));

        buttonContainer.add_child(menuButton);
        buttonContainer.set_margin_top(8);
        return buttonContainer;
    }

    _openMainActionsMenu(anchor) {
        try {
            // Close the main list menu to avoid overlap, then open a lightweight actions menu
            if (this.menu && this.menu.isOpen) this.menu.close();

            const menu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
            const menuActor = this._addActorToUiGroup(menu);
            this._hideActor(menuActor);
            if (!this._contextMenuManager) this._contextMenuManager = new PopupMenu.PopupMenuManager(this);
            this._contextMenuManager.addMenu(menu);

            const add = (label, cb) => { const item = menu.addAction(label, cb); this._applyContextMenuItemStyle(item); };

            add(_('Clear All'), () => this._clearAllHistory());
            add(_('Settings'), () => this._openSettings());
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            add(_('Export'), () => this._exportHistoryToDesktop?.());
            add(_('Import'), () => this._importHistoryFromDesktop?.());
            add(_('Purge Duplicates'), () => this._purgeDuplicates?.());

            const togglePrimaryLabel = this._settings.get_boolean('capture-primary') ? _('Disable Capture PRIMARY') : _('Enable Capture PRIMARY');
            add(togglePrimaryLabel, () => {
                const current = this._settings.get_boolean('capture-primary');
                this._settings.set_boolean('capture-primary', !current);
            });

            menu.connect('open-state-changed', (_m, open) => {
                if (!open) {
                    this._contextMenuManager.removeMenu(menu);
                    menu.destroy();
                }
            });
            menu.open(true);
        } catch (_e) {
            // As a fallback, use the existing panel context menu
            this._openContextMenu();
        }
    }

    prepareForReposition() {
        this._skipCleanupOnDestroy = true;
        this._flushHistorySave();
    }

    _createPaginationControls() {
        if (this._paginationBox) {
            this._paginationBox.destroy();
            this._paginationBox = null;
            this._paginationLabel = null;
            this._paginationPrevButton = null;
            this._paginationNextButton = null;
        }

        this._paginationBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'clipflow-pagination'
        });

        if (typeof this._paginationBox.set_spacing === 'function') {
            this._paginationBox.set_spacing(8);
        } else if (typeof this._paginationBox.get_layout_manager === 'function') {
            const layout = this._paginationBox.get_layout_manager();
            if (layout && 'spacing' in layout)
                layout.spacing = 8;
        }

        const buttonStyle = 'clipflow-pagination-button';

        this._paginationPrevButton = new St.Button({
            label: _('Prev'),
            style_class: buttonStyle
        });
        this._paginationPrevButton.set_accessible_name(_('Previous page'));
        this._paginationPrevButton.connect('clicked', () => {
            this._changePage(-1);
        });

        this._paginationNextButton = new St.Button({
            label: _('Next'),
            style_class: buttonStyle
        });
        this._paginationNextButton.set_accessible_name(_('Next page'));
        this._paginationNextButton.connect('clicked', () => {
            this._changePage(1);
        });

        this._paginationLabel = new St.Label({
            text: _('Page 1 of 1'),
            style_class: 'clipflow-pagination-label',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._paginationBox.add_child(this._paginationPrevButton);
        this._paginationBox.add_child(this._paginationLabel);
        this._paginationBox.add_child(this._paginationNextButton);

        return this._paginationBox;
    }

    _changePage(step) {
        const filtered = this._getFilteredHistory();
        const totalPages = Math.max(1, Math.ceil(filtered.length / this._entriesPerPage));
        const targetPage = Math.min(Math.max(this._currentPage + step, 0), totalPages - 1);
        if (targetPage === this._currentPage) {
            return;
        }
        this._currentPage = targetPage;
        this._refreshHistory();
    }

    _updatePaginationControls(totalEntries, totalPages) {
        if (!this._paginationBox) {
            this._createPaginationControls();
        }

        if (!this._paginationLabel || !this._paginationPrevButton || !this._paginationNextButton) {
            return;
        }

        const humanPage = totalPages === 0 ? 0 : this._currentPage + 1;
        this._paginationLabel.set_text(_('Page %d of %d').format(humanPage, Math.max(1, totalPages)));

        const prevEnabled = this._currentPage > 0;
        const nextEnabled = this._currentPage < totalPages - 1;

        if (typeof this._paginationPrevButton.set_sensitive === 'function') {
            this._paginationPrevButton.set_sensitive(prevEnabled);
        } else {
            this._paginationPrevButton.reactive = prevEnabled;
            this._paginationPrevButton.can_focus = prevEnabled;
            this._paginationPrevButton.opacity = prevEnabled ? 255 : 120;
        }

        if (typeof this._paginationNextButton.set_sensitive === 'function') {
            this._paginationNextButton.set_sensitive(nextEnabled);
        } else {
            this._paginationNextButton.reactive = nextEnabled;
            this._paginationNextButton.can_focus = nextEnabled;
            this._paginationNextButton.opacity = nextEnabled ? 255 : 120;
        }

        const showPagination = totalEntries > this._entriesPerPage;
        if (this._paginationBox) {
            this._paginationBox.visible = showPagination;
        }
    }

    _ensureStorageDir() {
        try {
            if (!GLib.file_test(this._storageDir, GLib.FileTest.IS_DIR)) {
                const result = GLib.mkdir_with_parents(this._storageDir, 0o700);
                if (typeof result === 'number' && result !== 0) {
                    throw new Error(`Failed to create storage directory: ${this._storageDir}`);
                }
            }
            // Ensure directory permissions are secure (user-only access)
            try {
                const file = Gio.File.new_for_path(this._storageDir);
                if (file.query_exists(null)) {
                    file.set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
                }
            } catch (permError) {
                // Directory exists even if permissions couldn't be set
            }
        } catch (error) {
            console.warn(`ClipFlow Pro: Failed to ensure storage directory: ${error}`);
            throw error; // Re-throw so caller knows directory creation failed
        }
    }

    _loadHistoryFromDisk() {
        try {
            const file = Gio.File.new_for_path(this._historyFile);
            if (!file.query_exists(null)) {
                this._clipboardHistory = [];
                return;
            }

            const [, contents] = GLib.file_get_contents(this._historyFile);
            if (!contents) {
                this._clipboardHistory = [];
                return;
            }

            let raw = '';
            try {
                if (typeof contents === 'string') {
                    raw = contents;
                } else if (contents && typeof contents.toArray === 'function') {
                    raw = new TextDecoder('utf-8').decode(Uint8Array.from(contents.toArray()));
                } else if (contents instanceof Uint8Array) {
                    raw = new TextDecoder('utf-8').decode(contents);
                }
            } catch (_e) { raw = ''; }
            if (!raw) {
                this._clipboardHistory = [];
                return;
            }

            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (jsonError) {
                console.warn(`ClipFlow Pro: Failed to parse history JSON (file may be corrupted): ${jsonError.message}`);
                // Backup the corrupted file before resetting
                try {
                    const backupFile = Gio.File.new_for_path(this._historyFile + '.corrupted.' + Date.now());
                    if (file.query_exists(null)) {
                        file.copy(backupFile, Gio.FileCopyFlags.NONE, null, null);
                    }
                } catch (backupError) {
                    // Failed to backup corrupted history
                }
                this._clipboardHistory = [];
                return;
            }

            if (!Array.isArray(parsed)) {
                console.warn(`ClipFlow Pro: History file does not contain an array, resetting history`);
                this._clipboardHistory = [];
                return;
            }

            const maxEntryLengthSetting = this._settings ? this._settings.get_int('max-entry-length') : 1000;
            const maxEntryLength = Math.max(100, Math.min(10000, maxEntryLengthSetting || 1000));

            const loaded = parsed
                .map(entry => {
                    try {
                        const rawText = this._normalizeClipboardText(entry.text);
                        const cleanedText = typeof rawText === 'string' ? rawText.trim() : '';
                        if (!cleanedText) {
                            return null;
                        }

                        let cappedText = cleanedText;
                        if (this._characterLength(cappedText) > maxEntryLength) {
                            cappedText = this._truncateText(cappedText, maxEntryLength);
                        }
                        const charLength = this._characterLength(cappedText);

                        const timestampUnix = typeof entry.timestampUnix === 'number'
                            ? entry.timestampUnix
                            : (entry.timestamp ? Number(entry.timestamp) : Date.now() / 1000);
                        const timestamp = GLib.DateTime.new_from_unix_local(timestampUnix) || GLib.DateTime.new_now_local();

                        const preview = charLength > 80 ? `${this._truncateText(cappedText, 80)}...` : cappedText;

                        return {
                            text: cappedText,
                            timestamp,
                            timestampUnix,
                            preview,
                            id: entry.id || GLib.uuid_string_random(),
                            pinned: Boolean(entry.pinned),
                            starred: Boolean(entry.starred),
                            length: charLength,
                            sensitive: Boolean(entry.sensitive),
                            contentType: entry.contentType || this._detectContentType(cappedText)
                        };
                    } catch (error) {
                        console.warn(`ClipFlow Pro: Failed to parse history entry: ${error}`);
                        return null;
                    }
                })
                .filter(Boolean);

            this._clipboardHistory = loaded;
            this._trimHistory(true);
            this._currentPage = 0;
            this._updateAutoClearTimers();
            this._invalidateFilterCache(true);
        } catch (error) {
            console.warn(`ClipFlow Pro: Failed to load history: ${error}`);
            this._clipboardHistory = [];
        }
    }

    _queueHistorySave() {
        if (this._historySaveTimeout) {
            GLib.source_remove(this._historySaveTimeout);
            this._historySaveTimeout = 0;
        }

        this._historySaveTimeout = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            this._historySaveDelaySeconds,
            () => {
                this._historySaveTimeout = 0;
                this._writeHistoryToDisk();
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _cancelHistorySaveTimeout() {
        if (this._historySaveTimeout) {
            GLib.source_remove(this._historySaveTimeout);
            this._historySaveTimeout = 0;
        }
    }

    _flushHistorySave() {
        this._cancelHistorySaveTimeout();
        this._writeHistoryToDisk();
    }

    _writeHistoryToDisk() {
        try {
            try {
                this._ensureStorageDir();
            } catch (dirError) {
                console.warn(`ClipFlow Pro: Cannot save history - storage directory unavailable: ${dirError.message}`);
                return; // Cannot save without storage directory
            }
            const serialised = this._clipboardHistory.map(item => ({
                id: item.id,
                text: item.text,
                timestampUnix: typeof item.timestampUnix === 'number' ? item.timestampUnix : item.timestamp.to_unix(),
                pinned: Boolean(item.pinned),
                starred: Boolean(item.starred),
                sensitive: Boolean(item.sensitive)
            }));

            const payload = JSON.stringify(serialised);
            const success = GLib.file_set_contents(this._historyFile, payload);
            if (!success) {
                throw new Error('Failed to write history file');
            }
            
            // Set secure file permissions (user read/write only, mode 0600)
            try {
                const file = Gio.File.new_for_path(this._historyFile);
                if (file.query_exists(null)) {
                    file.set_attribute_uint32('unix::mode', 0o600, Gio.FileQueryInfoFlags.NONE, null);
                }
            } catch (permError) {
                // File was written successfully
            }
        } catch (error) {
            console.warn(`ClipFlow Pro: Failed to save history: ${error}`);
        }
    }

    _clearHistoryStorage() {
        try {
            this._cancelHistorySaveTimeout();
            const file = Gio.File.new_for_path(this._historyFile);
            if (file.query_exists(null)) {
                file.delete(null);
            }
        } catch (error) {
            console.warn(`ClipFlow Pro: Failed to clear history storage: ${error}`);
        }
    }

    _scheduleAutoClear(historyItem) {
        if (!historyItem || !historyItem.id) {
            return;
        }

        if (!this._settings.get_boolean('auto-clear-sensitive') || !historyItem.sensitive) {
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const expiry = (typeof historyItem.timestampUnix === 'number'
            ? historyItem.timestampUnix
            : historyItem.timestamp.to_unix()) + this._autoClearDurationSeconds;
        const remaining = Math.max(0, expiry - now);

        if (remaining <= 0) {
            this._removeHistoryItemById(historyItem.id);
            return;
        }

        this._clearAutoClearTimer(historyItem.id);

        const timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, remaining, () => {
            this._autoClearTimeouts.delete(historyItem.id);
            this._removeHistoryItemById(historyItem.id);
            return GLib.SOURCE_REMOVE;
        });

        this._autoClearTimeouts.set(historyItem.id, timeoutId);
    }

    _clearAutoClearTimer(itemId) {
        if (!this._autoClearTimeouts.has(itemId)) {
            return;
        }

        const timeoutId = this._autoClearTimeouts.get(itemId);
        if (timeoutId) {
            GLib.source_remove(timeoutId);
        }
        this._autoClearTimeouts.delete(itemId);
    }

    _clearAllAutoClearTimers() {
        for (const timeoutId of this._autoClearTimeouts.values()) {
            if (timeoutId) {
                GLib.source_remove(timeoutId);
            }
        }
        this._autoClearTimeouts.clear();
    }

    _updateAutoClearTimers() {
        this._clearAllAutoClearTimers();
        if (!this._settings.get_boolean('auto-clear-sensitive')) {
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const toRemove = [];

        this._clipboardHistory.forEach(item => {
            if (!item.sensitive) {
                return;
            }

            const timestampUnix = typeof item.timestampUnix === 'number'
                ? item.timestampUnix
                : item.timestamp.to_unix();
            const expiry = timestampUnix + this._autoClearDurationSeconds;
            if (expiry <= now) {
                toRemove.push(item.id);
            } else {
                const remaining = expiry - now;
                const timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, remaining, () => {
                    this._autoClearTimeouts.delete(item.id);
                    this._removeHistoryItemById(item.id);
                    return GLib.SOURCE_REMOVE;
                });
                this._autoClearTimeouts.set(item.id, timeoutId);
            }
        });

        if (toRemove.length > 0) {
            toRemove.forEach(id => this._removeHistoryItemById(id, false));
            this._refreshHistory();
        }
    }

    _removeHistoryItemById(itemId, refresh = true) {
        if (!itemId) {
            return;
        }

        const index = this._clipboardHistory.findIndex(entry => entry.id === itemId);
        if (index === -1) {
            return;
        }

        this._clearAutoClearTimer(itemId);
        this._clipboardHistory.splice(index, 1);
        this._invalidateFilterCache();
        if (refresh) {
            this._populateContextMenuRecentEntries();
            this._refreshHistory();
        }
        this._queueHistorySave();
    }
    _startClipboardMonitoring() {
        if (this._isMonitoring) {
            return;
        }

        this._clipboard = this._obtainClipboardInterface();
        if (!this._clipboard) {
            this._logThrottled('clipboard-interface-unavailable', 'ClipFlow Pro: Clipboard interface unavailable – monitoring disabled.');
            this._syncContextMenuToggles();
            this._notifyClipboardUnavailable();
            this._scheduleClipboardRetry('interface-unavailable');
            return;
        }

        this._clipboardNotifyShown = false;
        this._clearClipboardRetry();
        this._isMonitoring = true;
        this._lastClipboardText = null;
        this._lastPrimaryText = null;

        // Wire up clipboard signals and selection monitor first
        this._connectClipboardSignals();
        this._connectSelectionMonitor();
        this._startClipboardPolling();
        this._syncContextMenuToggles();
        this._updateIconState();
        
        // Warm-poll: grab whatever is currently in the clipboard after connections are established
        // This ensures the menu isn't blank on the very first copy after enable/login
        this._scheduleIdle(() => {
            this._checkClipboard('warm-start');
            return GLib.SOURCE_REMOVE;
        });

        // Perform an initial check, as the owner might not change if text is already present
        this._scheduleTimeout(500, () => {
            this._checkClipboard('startup');
            return GLib.SOURCE_REMOVE;
        });
    }

    _obtainClipboardInterface() {
        const candidates = [];

        if (St && St.Clipboard && typeof St.Clipboard.get_default === 'function') {
            candidates.push(() => St.Clipboard.get_default());
        }

        if (St && St.Clipboard && typeof St.Clipboard.get_for_display === 'function' &&
            typeof global !== 'undefined' && global && global.display) {
            candidates.push(() => St.Clipboard.get_for_display(global.display));
        }

        for (const getClipboard of candidates) {
            try {
                const clipboard = getClipboard();
                if (clipboard) {
                    return clipboard;
                }
            } catch (error) {
                // Clipboard candidate failed
            }
        }
        return null;
    }

    _scheduleClipboardRetry(reason = 'unknown') {
        if (this._clipboardRetryTimeoutId) {
            return;
        }

        this._clipboardRetryAttempts += 1;
        if (this._clipboardRetryAttempts >= 5 && !this._clipboardRetryNotified) {
            this._clipboardRetryNotified = true;
            Main.notify('ClipFlow Pro', _('Waiting for clipboard service… Some desktop environments delay availability after login.'));
        }

        const baseDelayMs = Math.max(500, this._clipboardPollIntervalMs);
        const retryDelayMs = Math.min(12000, baseDelayMs * Math.pow(2, Math.max(0, this._clipboardRetryAttempts - 1)));
        this._clipboardRetryTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, retryDelayMs, () => {
            this._clipboardRetryTimeoutId = 0;

            if (this._isMonitoring) {
                return GLib.SOURCE_REMOVE;
            }

            this._startClipboardMonitoring();
            return GLib.SOURCE_REMOVE;
        });
    }

    _clearClipboardRetry() {
        if (this._clipboardRetryTimeoutId) {
            GLib.source_remove(this._clipboardRetryTimeoutId);
            this._clipboardRetryTimeoutId = 0;
        }
        this._clipboardRetryAttempts = 0;
        this._clipboardRetryNotified = false;
    }

    _connectClipboardSignals() {
        if (!this._clipboard || typeof this._clipboard.connect !== 'function') {
            return;
        }

        if (this._clipboardOwnerChangeId > 0) {
            return;
        }

        const candidateSignals = [
            'owner-change',
            'owner-changed',
            'changed',
            'notify::owner'
        ];

        for (const signal of candidateSignals) {
            try {
                const handlerId = this._clipboard.connect(signal, this._onClipboardOwnerChanged.bind(this));
                if (typeof handlerId === 'number' && handlerId > 0) {
                    this._clipboardOwnerChangeId = handlerId;
                    return;
                }
            } catch (error) {
            }
        }

    }

    _connectSelectionMonitor() {
        try {
            if (Meta && typeof Meta.is_wayland_compositor === 'function' && Meta.is_wayland_compositor()) {
                return;
            }

            const display = global.display;
            if (!display || typeof display.get_selection !== 'function') {
                return;
            }

            if (!Meta || !Meta.SelectionType) {
                return;
            }

            const typeEnums = Meta.SelectionType;
            const clipboardEnum = typeEnums.CLIPBOARD ?? typeEnums.SELECTION_CLIPBOARD;
            const primaryEnum = typeEnums.PRIMARY ?? typeEnums.SELECTION_PRIMARY;
            if (clipboardEnum === undefined) {
                return;
            }

            const selection = display.get_selection();
            if (!selection) {
                return;
            }

            if (this._selection && this._selectionOwnerChangedId) {
                this._disconnectSelectionMonitor();
            }

            this._selection = selection;
            this._selectionOwnerChangedId = selection.connect('owner-changed', (_sel, selectionType) => {
                if (!this._isMonitoring) {
                    return;
                }

                try {
                    const isClipboardChange = selectionType === clipboardEnum;
                    const isPrimaryChange = primaryEnum !== undefined && selectionType === primaryEnum;
                    if (isClipboardChange || (isPrimaryChange && this._settings.get_boolean('capture-primary'))) {
                        this._checkClipboard('selection');
                    }
                } catch (error) {
                }
            });
        } catch (error) {
        }
    }

    _disconnectSelectionMonitor() {
        if (this._selection && this._selectionOwnerChangedId) {
            this._selection.disconnect(this._selectionOwnerChangedId);
        }
        this._selectionOwnerChangedId = 0;
        this._selection = null;
    }

    _stopClipboardMonitoring() {
        this._clearClipboardRetry();

        if (!this._isMonitoring) {
            return;
        }


        this._stopClipboardPolling();

        this._disconnectClipboardSignals();
        this._disconnectSelectionMonitor();

        if (this._clipboardCheckTimeout > 0) {
            GLib.source_remove(this._clipboardCheckTimeout);
            this._clipboardCheckTimeout = 0;
        }

        // Also clean up the old polling timeout if it exists
        if (this._clipboardTimeout) {
            GLib.source_remove(this._clipboardTimeout);
            this._clipboardTimeout = null;
        }

        this._clipboard = null;
        this._isMonitoring = false;
        this._syncContextMenuToggles();
        this._updateIconState();
    }

    _disconnectClipboardSignals() {
        if (this._clipboardOwnerChangeId > 0 && this._clipboard) {
            this._clipboard.disconnect(this._clipboardOwnerChangeId);
        }
        this._clipboardOwnerChangeId = 0;
    }

    _startClipboardPolling() {
        this._stopClipboardPolling();

        const interval = Math.max(250, this._clipboardPollIntervalMs);
        this._clipboardPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            if (!this._isMonitoring) {
                this._clipboardPollId = 0;
                return GLib.SOURCE_REMOVE;
            }

            this._checkClipboard('poll');
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopClipboardPolling() {
        if (this._clipboardPollId > 0) {
            GLib.source_remove(this._clipboardPollId);
            this._clipboardPollId = 0;
        }
    }

    _onClipboardOwnerChanged() {
        if (this._clipboardCheckTimeout > 0) {
            GLib.source_remove(this._clipboardCheckTimeout);
        }

        // Add a small delay to debounce and prevent capturing intermediate selections
        this._clipboardCheckTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            this._checkClipboard('owner-change');
            this._clipboardCheckTimeout = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _checkClipboard(source = 'owner-change') {
        
        if (!this._isMonitoring) {
            return;
        }

        if (!this._clipboard) {
            this._scheduleClipboardRetry('clipboard-null');
            return;
        }

        try {
            if (typeof this._clipboard.get_text !== 'function' ||
                typeof this._clipboard.get_content !== 'function') {
                this._scheduleClipboardRetry('missing-getters');
                return;
            }

            this._consumeClipboardSelection(St.ClipboardType.CLIPBOARD, 'clipboard');

            if (this._settings.get_boolean('capture-primary')) {
                this._consumeClipboardSelection(St.ClipboardType.PRIMARY, 'primary');
            } else {
            }
        } catch (e) {
            // Only log error type, not message which might contain sensitive data
            const errorType = e?.name || e?.constructor?.name || 'Error';
            this._logThrottled('clipboard-check-error', `ClipFlow Pro: Error checking clipboard: ${errorType}`);
            if (e.stack) {
            }
            this._scheduleClipboardRetry('clipboard-check-error');
        }
    }

    _consumeClipboardSelection(clipboardType, sourceLabel) {
        if (!this._clipboard) {
            return;
        }

        if (!this._isMonitoring) {
            return;
        }

        const handleResult = text => {
            if (text && typeof text === 'string' && text.trim().length > 0) {
                this._handleClipboardText(text, sourceLabel);
            } else {
            }
        };

        try {
            this._clipboard.get_text(clipboardType, (_clip, text) => {
                
                if (text && typeof text === 'string' && text.trim().length > 0) {
                    handleResult(text);
                    return;
                }

                this._fallbackFetchClipboardText(clipboardType, sourceLabel, handleResult);
            });
        } catch (error) {
            // Only log error type, not message which might contain sensitive data
            const errorType = error?.name || error?.constructor?.name || 'Error';
            this._logThrottled(`clipboard-get-text-${sourceLabel}`, `ClipFlow Pro: get_text error for ${sourceLabel}: ${errorType}`);
            this._fallbackFetchClipboardText(clipboardType, sourceLabel, handleResult);
        }
    }

    _fallbackFetchClipboardText(clipboardType, sourceLabel, callback, index = 0) {
        if (!this._clipboard) {
            return;
        }

        if (!Array.isArray(this._textMimeTypes)) {
            return;
        }

        // Dynamically cap probing attempts depending on context
        let maxTries = Math.min(this._textMimeTypes.length, Math.max(1, this._maxTextMimeTries));
        if (sourceLabel === 'primary') {
            // PRIMARY often changes rapidly and frequently contains non-text
            maxTries = Math.min(maxTries, 4);
        }
        if (this._isLikelyScreenshotApp()) {
            // When a screenshot tool is focused, probing many MIME types can stall
            maxTries = Math.min(maxTries, 2);
        }
        if (index >= maxTries) {
            return;
        }

        const mimetype = this._textMimeTypes[index];
        try {
            this._clipboard.get_content(clipboardType, mimetype, (_clip, bytes) => {
                try {
                    let decoded = '';
                    const byteSize = bytes && typeof bytes.get_size === 'function' ? bytes.get_size() : 0;
                    if (bytes && byteSize > 0) {
                        decoded = this._decodeClipboardBytes(bytes, mimetype);
                    }
                    if (decoded) {
                        callback(decoded);
                        return;
                    }
                } catch (conversionError) {
                }

                this._fallbackFetchClipboardText(clipboardType, sourceLabel, callback, index + 1);
            });
        } catch (error) {
            this._fallbackFetchClipboardText(clipboardType, sourceLabel, callback, index + 1);
        }
    }

    _isLikelyScreenshotApp() {
        try {
            const tracker = Shell.WindowTracker.get_default();
            const app = tracker && tracker.focus_app ? tracker.focus_app : null;
            const id = (app && (app.get_id?.() || app.get_name?.() || '')) || '';
            const nid = id.toLowerCase();
            // Common screenshot helper ids/names
            return (
                nid.includes('screenshot') ||
                nid.includes('flameshot') ||
                nid.includes('shutter') ||
                nid.includes('ksnip')
            );
        } catch (_e) {
            return false;
        }
    }

    _handleClipboardText(rawText, source = 'owner-change') {
        
        const text = this._normalizeClipboardText(rawText);
        if (!text || typeof text !== 'string') {
            return;
        }

        const trimmedText = text.trim();
        if (!trimmedText || trimmedText.length === 0) {
            return;
        }


        // Quick duplicate check: skip if same as last captured text (prevents rapid duplicate captures)
        // BUT: Only do this check AFTER we've confirmed the text passed all filters in _processClipboardText
        // This prevents blocking valid entries that were filtered out previously
        const lastText = (source === 'clipboard') ? this._lastClipboardText : this._lastPrimaryText;
        if (lastText === trimmedText) {
            return;
        }

        
        // Process first, update cache only if successfully added
        // We'll update the cache in _addToHistory after confirmation
        const previousHistoryLength = this._clipboardHistory.length;
        this._processClipboardText(trimmedText, source);
        
        // Only update cache if a new entry was actually added
        if (this._clipboardHistory.length > previousHistoryLength) {
            if (source === 'clipboard') {
                this._lastClipboardText = trimmedText;
            } else if (source === 'primary') {
                this._lastPrimaryText = trimmedText;
            }
        }
    }

    _processClipboardText(text, source = 'clipboard') {
        if (!text) {
            return;
        }

        const cleanedText = text.trim();
        if (!cleanedText) {
            return;
        }

        const charLength = this._characterLength(cleanedText);
        const isSensitive = this._isSensitiveContent(cleanedText);
        if (isSensitive && this._safeGetBoolean('ignore-passwords', false)) {
            return;
        }

        // Check ignore apps
        try {
            const tracker = Shell.WindowTracker.get_default();
            const app = tracker && tracker.focus_app ? tracker.focus_app : null;
            const appName = app ? (app.get_name?.() || app.get_id?.() || '') : '';
            const ignoreRaw = this._safeGetString('ignore-apps', '');
            if (ignoreRaw && appName) {
                const list = ignoreRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                const current = appName.toLowerCase();
                if (list.some(token => current.includes(token))) {
                    return;
                }
            }
        } catch (_e) {
            // best-effort
        }

        // Minimum length - use safe access with default of 0 (accept all entries)
        const minLen = Math.max(0, Math.min(100, this._safeGetInt('min-entry-length', 0)));
        if (charLength < minLen) {
            return;
        }

        // Duplicate handling - early exit optimization
        // Check most recent entry first (common case)
        if (this._clipboardHistory.length > 0 && this._clipboardHistory[0].text === cleanedText) {
            const mode = this._settings.get_string('dedupe-mode');
            if (mode === 'promote') {
                const item = this._clipboardHistory[0];
                item.timestamp = GLib.DateTime.new_now_local();
                item.timestampUnix = item.timestamp.to_unix();
                this._queueHistorySave();
                this._refreshHistory();
            } else {
            }
            return;
        }

        // Check remaining history if not the most recent
        const duplicateIndex = this._findDuplicateIndex(cleanedText);
        if (duplicateIndex !== -1) {
            const mode = this._settings.get_string('dedupe-mode');
            if (mode === 'promote') {
                const item = this._clipboardHistory.splice(duplicateIndex, 1)[0];
                item.timestamp = GLib.DateTime.new_now_local();
                item.timestampUnix = item.timestamp.to_unix();
                this._clipboardHistory.unshift(item);
                this._queueHistorySave();
                this._refreshHistory();
            } else {
            }
            return;
        }

        this._addToHistory(cleanedText, { source, sensitive: isSensitive });
    }
    
    _isSensitiveContent(text) {
        if (!text) {
            return false;
        }

        const trimmed = text.trim();
        if (trimmed.length <= 6) {
            return false;
        }

        const lower = trimmed.toLowerCase();
        const looksLikePassword = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(trimmed) &&
            (lower.includes('password') || lower.includes('passwd') || lower.includes('secret'));

        return looksLikePassword;
    }

    _computeActionModeMask() {
        try {
            if (Shell && Shell.ActionMode) {
                if (Shell.ActionMode.ALL !== undefined) {
                    return Shell.ActionMode.ALL;
                }

                const mask = Object.keys(Shell.ActionMode)
                    .map(key => Shell.ActionMode[key])
                    .filter(value => typeof value === 'number')
                    .reduce((accumulator, value) => accumulator | value, 0);

                if (mask > 0) {
                    return mask;
                }

                if (Shell.ActionMode.NORMAL !== undefined) {
                    return Shell.ActionMode.NORMAL;
                }
            }
        } catch (error) {
            console.warn(`ClipFlow Pro: Unable to determine action mode mask: ${error}`);
        }

        return 0;
    }

    _registerKeybindings() {
        this._unregisterKeybindings();

        const register = (name, handler) => {
            if (!this._settings || !name || typeof handler !== 'function') {
                return;
            }

            const modeMask = this._actionModeMask || this._computeActionModeMask();
            if (!modeMask) {
                return;
            }
            this._actionModeMask = modeMask;
            const callback = () => {
                try {
                    handler();
                } catch (error) {
            console.warn(`ClipFlow Pro: Keybinding ${name} handler failed: ${error}`);
                }
            };

            try {
                if (Main.wm && typeof Main.wm.addKeybinding === 'function') {
                    const success = Main.wm.addKeybinding(
                        name,
                        this._settings,
                        Meta.KeyBindingFlags.NONE,
                        modeMask,
                        callback
                    );
                    if (success) {
                        this._keybindingRegistrations.set(name, 'wm');
                        return;
                    }
                }
            } catch (error) {
                console.warn(`ClipFlow Pro: Failed to register keybinding ${name} via Main.wm: ${error}`);
            }

            try {
                if (global.display && typeof global.display.add_keybinding === 'function') {
                    global.display.add_keybinding(
                        name,
                        this._settings,
                        Meta.KeyBindingFlags.NONE,
                        modeMask,
                        callback
                    );
                    this._keybindingRegistrations.set(name, 'display');
                }
            } catch (error) {
                console.warn(`ClipFlow Pro: Failed to register keybinding ${name} via global.display: ${error}`);
            }
        };

        register('show-menu-shortcut', this._handleShowMenuShortcut.bind(this));
        register('enhanced-copy-shortcut', this._handleEnhancedCopyShortcut.bind(this));
        register('enhanced-paste-shortcut', this._handleEnhancedPasteShortcut.bind(this));
        // Classic quick filters and top toggles
        register('classic-filter-all-shortcut', () => this._handleFilterShortcut('all'));
        register('classic-filter-pinned-shortcut', () => this._handleFilterShortcut('pinned'));
        register('classic-filter-starred-shortcut', () => this._handleFilterShortcut('starred'));
        register('classic-toggle-pin-top-shortcut', () => this._toggleTopItem('pin'));
        register('classic-toggle-star-top-shortcut', () => this._toggleTopItem('star'));
    }

    _handleFilterShortcut(mode) {
        this._filterMode = mode;
        this._filterHistory();
        if (this.menu && !this.menu.isOpen) this.menu.open(true);
    }

    _toggleTopItem(kind) {
        if (!Array.isArray(this._clipboardHistory) || this._clipboardHistory.length === 0) return;
        const item = this._clipboardHistory[0];
        if (!item) return;
        if (kind === 'pin') item.pinned = !item.pinned;
        if (kind === 'star') item.starred = !item.starred;
        this._queueHistorySave();
        this._refreshHistory();
    }

    _unregisterKeybindings() {
        if (!this._keybindingRegistrations || this._keybindingRegistrations.size === 0) {
            return;
        }

        for (const [name, method] of this._keybindingRegistrations.entries()) {
            try {
                if (method === 'wm' && Main.wm && typeof Main.wm.removeKeybinding === 'function') {
                    Main.wm.removeKeybinding(name);
                } else if (method === 'display' && global.display && typeof global.display.remove_keybinding === 'function') {
                    global.display.remove_keybinding(name);
                } else if (Main.wm && typeof Main.wm.removeKeybinding === 'function') {
                    Main.wm.removeKeybinding(name);
                } else if (global.display && typeof global.display.remove_keybinding === 'function') {
                    global.display.remove_keybinding(name);
                }
            } catch (error) {
                console.warn(`ClipFlow Pro: Failed to remove keybinding ${name}: ${error}`);
            }
        }

        this._keybindingRegistrations.clear();
    }

    _handleShowMenuShortcut() {
        if (!this.menu) {
            return;
        }

        if (this.menu.isOpen) {
            this.menu.close();
        } else {
            this.menu.open(true);
        }
    }

    _handleEnhancedCopyShortcut() {
        try {
            const clipboard = St.Clipboard.get_default();
            clipboard.get_text(St.ClipboardType.PRIMARY, (_clip, primaryText) => {
                const primary = primaryText ? primaryText.trim() : '';
                if (primary) {
                    this._copyToClipboard(primary);
                    return;
                }

                clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clipboard, clipboardText) => {
                    const cleaned = clipboardText ? clipboardText.trim() : '';
                    if (cleaned) {
                        this._copyToClipboard(cleaned);
                    }
                });
            });
        } catch (error) {
            console.warn(`ClipFlow Pro: Enhanced copy shortcut failed: ${error}`);
        }
    }

    _handleEnhancedPasteShortcut() {
        try {
            const clipboard = St.Clipboard.get_default();
            clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clip, clipboardText) => {
                if (!clipboardText) {
                    return;
                }

                const sanitized = this._sanitizeForPaste(clipboardText);
                if (!sanitized) {
                    return;
                }

                const changed = sanitized !== clipboardText;
                this._copyToClipboard(sanitized, !changed);
                if (changed) {
                    Main.notify('ClipFlow Pro', _('Cleaned text ready to paste. Use your paste shortcut in the target app.'));
                }
            });
        } catch (error) {
            console.warn(`ClipFlow Pro: Enhanced paste shortcut failed: ${error}`);
        }
    }

    _sanitizeForPaste(text) {
        if (!text) {
            return '';
        }

        return text
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    _findDuplicateIndex(text) {
        // Skip first entry since we already checked it
        if (this._clipboardHistory.length <= 1) {
            return -1;
        }
        // Check remaining entries starting from index 1
        for (let i = 1; i < this._clipboardHistory.length; i++) {
            if (this._clipboardHistory[i].text === text) {
                return i;
            }
        }
        return -1;
    }

    _detectContentType(text) {
        if (!text || text.length === 0) {
            return 'text';
        }

        // URL detection
        if (/^https?:\/\//.test(text.trim())) {
            return 'url';
        }

        // Email detection
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) {
            return 'email';
        }

        // File path detection (Unix and Windows)
        if (/^(\/|\.\.?\/|[A-Z]:\\)/.test(text.trim())) {
            return 'path';
        }

        // Code detection (function definitions, etc.)
        if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(text.trim())) {
            return 'code';
        }

        // JSON detection
        if (/^[\s]*[\{\[]/.test(text) && /[\}\]]/.test(text)) {
            try {
                JSON.parse(text);
                return 'json';
            } catch (e) {
                // Not valid JSON
            }
        }

        return 'text';
    }

    _addToHistory(text, options = {}) {
        // Validate text length
        const maxLength = this._settings.get_int('max-entry-length');
        let charLength = this._characterLength(text);
        if (charLength > maxLength) {
            text = this._truncateText(text, maxLength);
            charLength = maxLength;
        }
        
        const timestamp = GLib.DateTime.new_now_local();
        const timestampUnix = timestamp.to_unix();
        const contentType = this._detectContentType(text);
        const preview = charLength > 80 ? `${this._truncateText(text, 80)}...` : text;
        const historyItem = {
            text: text,
            timestamp: timestamp,
            timestampUnix,
            preview,
            id: GLib.uuid_string_random(), // Add unique ID for better tracking
            pinned: false,
            starred: false,
            length: charLength,
            sensitive: Boolean(options.sensitive),
            contentType: contentType
        };
        
        this._clipboardHistory.unshift(historyItem);
        this._currentPage = 0;
        this._trimHistory();
        this._scheduleAutoClear(historyItem);
        this._queueHistorySave();
        this._updateIconState();
        this._invalidateFilterCache();
        this._refreshHistory();
    }
    
    _trimHistory(skipSave = false) {
        const limit = this._maxHistory;
        if (!limit || this._clipboardHistory.length <= limit) {
            return;
        }

        let modified = false;
        for (let index = this._clipboardHistory.length - 1; this._clipboardHistory.length > limit && index >= 0; index--) {
            const item = this._clipboardHistory[index];
            if (item && !item.pinned) {
                this._clearAutoClearTimer(item.id);
                this._clipboardHistory.splice(index, 1);
                modified = true;
            }
        }

        if (this._clipboardHistory.length > limit) {
            const removed = this._clipboardHistory.slice(limit);
            removed.forEach(item => this._clearAutoClearTimer(item.id));
            this._clipboardHistory = this._clipboardHistory.slice(0, limit);
            modified = true;
        }

        if (modified) {
            this._invalidateFilterCache();
            if (!skipSave) {
                this._queueHistorySave();
            }
        }
    }

    _refreshHistory() {
        if (!this._historyContainer) {
            return;
        }

        this._clearHistoryContainer();
        
        const filteredHistory = this._getFilteredHistory();
        const sortedHistory = this._sortHistory(filteredHistory);
        // Group by pinned/starred for Classic-like sections even in ESM
        const pinned = sortedHistory.filter(i => i && i.pinned);
        const starred = sortedHistory.filter(i => i && i.starred && !i.pinned);
        const othersAll = sortedHistory.filter(i => i && !i.pinned && !i.starred);
        const othersTotal = othersAll.length;
        const totalEntries = sortedHistory.length;
        const pageSize = Math.max(1, this._entriesPerPage);
        this._setHistoryScrollHidden(othersTotal <= pageSize);
        const totalPages = othersTotal === 0 ? 0 : Math.ceil(othersTotal / pageSize);
        if (totalPages > 0 && this._currentPage > totalPages - 1) {
            this._currentPage = totalPages - 1;
        }
        if (totalPages === 0) {
            this._currentPage = 0;
        }
        
        if (sortedHistory.length === 0) {
            const hasSearchFilter = this._searchEntry && this._getSearchText().trim();
            this._showEmptyState(hasSearchFilter);
            this._updatePaginationControls(0, 0);
            this._populateContextMenuRecentEntries();
            return;
        }
        // Pinned strip at top (respect hide-pinned)
        const hidePinned = (() => { try { return this._settings.get_boolean('hide-pinned'); } catch (_e) { return false; } })();
        if (pinned.length > 0 && !hidePinned) {
            const strip = new St.BoxLayout({ vertical: false });
            const label = new St.Label({ text: `${_('Pinned')} (${pinned.length}):`, style_class: 'clipflow-history-meta' });
            strip.add_child(label);
            // Keep the chip strip compact to avoid visual overload
            pinned.slice(0, 6).forEach(p => {
                const preview = this._truncateText(this._safeHistoryText(p) || p.preview || _('(Empty)'), 18);
                const btn = new St.Button({ label: preview, style_class: 'clipflow-button' });
                btn.add_style_class_name('clipflow-button-secondary');
                btn.connect('clicked', () => this._activateHistoryItem(p));
                strip.add_child(btn);
            });
            this._historyContainer.add_child(strip);
            this._historyContainer.add_child(new St.BoxLayout({ vertical: false }));
        }
        // Starred section (respect hide-starred)
        const hideStarred = (() => { try { return this._settings.get_boolean('hide-starred'); } catch (_e) { return false; } })();
        if (starred.length > 0 && !hideStarred) {
            const header = new St.Label({ text: `${_('Starred')} (${starred.length})`, style_class: 'clipflow-history-meta' });
            this._historyContainer.add_child(header);
            starred.forEach((s, idx) => this._createHistoryItem(s, idx + 1));
            this._historyContainer.add_child(new St.BoxLayout({ vertical: false }));
        }

        // Others with pagination
        const startIndex = this._currentPage * pageSize;
        const visibleOthers = othersAll.slice(startIndex, startIndex + pageSize);
        visibleOthers.forEach((item, index) => {
            this._createHistoryItem(item, startIndex + index + 1);
        });
        this._updatePaginationControls(totalEntries, totalPages);
        this._populateContextMenuRecentEntries();
        const renderedCount = this._historyContainer && this._historyContainer.get_children ? this._historyContainer.get_children().length : (visibleOthers.length + pinned.length + starred.length);

        if (!this._menuRebuildInProgress && sortedHistory.length > 0 && renderedCount === 0) {
            this._menuRebuildInProgress = true;
            this._scheduleIdle(() => {
                try {
                    this._buildMenu();
                } catch (error) {
                } finally {
                    this._menuRebuildInProgress = false;
                }
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _setHistoryScrollHidden(hidden) {
        if (!this._historyScrollView) {
            return;
        }

        const className = 'clipflow-scrollbar-hidden';
        if (hidden) {
            if (typeof this._historyScrollView.add_style_class_name === 'function') {
                this._historyScrollView.add_style_class_name(className);
            }
        } else if (typeof this._historyScrollView.remove_style_class_name === 'function') {
            this._historyScrollView.remove_style_class_name(className);
        }

        if (typeof this._historyScrollView.set_policy === 'function') {
            const policyEnum = St.PolicyType ?? Clutter.PolicyType;
            if (policyEnum) {
                const verticalPolicy = hidden ? policyEnum.NEVER : policyEnum.AUTOMATIC;
                this._historyScrollView.set_policy(policyEnum.NEVER, verticalPolicy);
            }
        }
    }

    _showEmptyState(hasSearchFilter) {
        if (!this._historyContainer) {
            return;
        }

        const wrapper = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true,
            style_class: 'clipflow-empty-wrapper'
        });

        const icon = new St.Icon({
            icon_name: hasSearchFilter ? 'system-search-symbolic' : 'edit-copy-symbolic',
            icon_size: 32,
            style_class: 'clipflow-empty-icon'
        });
        wrapper.add_child(icon);

        const title = new St.Label({
            text: hasSearchFilter ? _('No matches found') : _('Nothing copied yet'),
            style_class: 'clipflow-empty-text'
        });
        wrapper.add_child(title);

        const hint = new St.Label({
            text: hasSearchFilter
                ? _('Try a different term or clear the filter to see all items.')
                : _('Copy something and it will appear here instantly.'),
            style_class: 'clipflow-empty-hint'
        });
        hint.clutter_text.set_line_wrap(true);
        hint.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        wrapper.add_child(hint);

        // Reset UI mode button to Classic when empty
        const resetButton = new St.Button({ label: _('Reset to Classic UI'), style_class: 'clipflow-button' });
        resetButton.add_style_class_name('clipflow-button-secondary');
        resetButton.connect('clicked', () => {
            if (this._settings && typeof this._settings.set_string === 'function')
                this._settings.set_string('rendering-mode', 'classic');
            this._filterHistory();
        });
        wrapper.add_child(resetButton);

        this._historyContainer.add_child(wrapper);
    }

    _notifyClipboardUnavailable() {
        if (this._clipboardNotifyShown) {
            return;
        }
        this._clipboardNotifyShown = true;
        Main.notify('ClipFlow Pro', _('Clipboard service not available yet. Waiting for GNOME Shell to grant access.'));
    }

    _applyUiStyle() {
        if (!this._menuContainerBox) {
            return;
        }
        const className = 'clipflow-compact';
        if (this._useCompactUI) {
            this._menuContainerBox.add_style_class_name(className);
        } else {
            this._menuContainerBox.remove_style_class_name(className);
        }
    }

    _clearHistoryContainer() {
        if (!this._historyContainer) {
            return;
        }
        const children = this._historyContainer.get_children ? [...this._historyContainer.get_children()] : [];
        children.forEach(child => {
            try {
                if (child && typeof child.destroy === 'function') {
                    child.destroy();
                }
            } catch (error) {
            }
        });

        if (typeof this._historyContainer.remove_all_children === 'function') {
            this._historyContainer.remove_all_children();
        }
    }

    _getFilteredHistory() {
        if (!this._searchEntry) {
            const base = this._clipboardHistory;
            if (this._filterMode === 'pinned') return base.filter(i => i && i.pinned);
            if (this._filterMode === 'starred') return base.filter(i => i && i.starred);
            return base;
        }

        const searchText = this._getSearchText().toLowerCase();
        
        if (!searchText) {
            const base = this._clipboardHistory;
            if (this._filterMode === 'pinned') return base.filter(i => i && i.pinned);
            if (this._filterMode === 'starred') return base.filter(i => i && i.starred);
            return base;
        }
        
        // Use cache if available and search hasn't changed
        if (this._filterCacheValid && this._filteredHistoryCache && 
            this._lastSearchText === searchText) {
            return this._filteredHistoryCache;
        }
        
        // Filter and cache result
        const filtered = this._clipboardHistory.filter(item => {
            if (!item) {
                return false;
            }

            const haystack = this._safeHistoryText(item);
            if (!haystack) {
                return false;
            }

            try {
                return haystack.toLowerCase().includes(searchText);
            } catch (error) {
                return false;
            }
        });
        const post = (this._filterMode === 'pinned') ? filtered.filter(i => i && i.pinned) : (this._filterMode === 'starred') ? filtered.filter(i => i && i.starred) : filtered;
        this._filteredHistoryCache = post;
        this._lastSearchText = searchText;
        this._filterCacheValid = true;

        return post;
    }

    _safeHistoryText(item) {
        if (!item) {
            return '';
        }

        if (typeof item.text === 'string' && item.text.trim()) {
            return item.text;
        }

        if (typeof item.preview === 'string' && item.preview.trim()) {
            return item.preview;
        }

        return '';
    }

    _getSearchText() {
        if (!this._searchEntry)
            return '';
        if (typeof this._searchEntry.get_text === 'function')
            return this._searchEntry.get_text() || '';
        if (typeof this._searchEntry.text === 'string')
            return this._searchEntry.text || '';
        if (this._searchEntry.clutter_text && typeof this._searchEntry.clutter_text.get_text === 'function')
            return this._searchEntry.clutter_text.get_text() || '';
        return '';
    }

    _filterHistory() {
        this._invalidateFilterCache(true);
        this._currentPage = 0;
        this._refreshHistory();
    }

    _sortHistory(entries) {
        if (!entries || entries.length === 0) {
            return [];
        }

        return entries.slice().sort((a, b) => {
            if (a.pinned !== b.pinned) {
                return a.pinned ? -1 : 1;
            }
            if (a.starred !== b.starred) {
                return a.starred ? -1 : 1;
            }

            const aTime = this._coerceTimestamp(a);
            const bTime = this._coerceTimestamp(b);
            return bTime - aTime;
        });
    }

    _coerceTimestamp(item) {
        if (!item) {
            return 0;
        }

        try {
            if (typeof item.timestampUnix === 'number' && Number.isFinite(item.timestampUnix)) {
                return item.timestampUnix;
            }

            if (item.timestamp instanceof GLib.DateTime) {
                return item.timestamp.to_unix();
            }

            if (typeof item.timestampHumanReadable === 'string' && item.timestampHumanReadable.trim()) {
                const parsed = Date.parse(item.timestampHumanReadable);
                if (!Number.isNaN(parsed)) {
                    return Math.floor(parsed / 1000);
                }
            }
        } catch (error) {
        }

        return 0;
    }

    _createHistoryItem(item, displayIndex) {
        if (!this._historyContainer) {
            return;
        }

        if (this._shouldUseLegacyHistoryRows()) {
            this._createLegacyHistoryItem(item, displayIndex);
            return;
        }

        try {
            const row = new St.BoxLayout({
                style_class: 'clipflow-history-item',
                x_expand: true,
                y_expand: false,
                reactive: true,
                can_focus: true,
                track_hover: true
            });
            row.y_align = Clutter.ActorAlign.CENTER;
            const accessibleName = this._safeHistoryText(item) || _('Clipboard entry');
            row.set_accessible_name(accessibleName);

            if (item.contentType && item.contentType !== 'text') {
                row.add_style_class_name(`clipflow-type-${item.contentType}`);
            }
            if (item.pinned) {
                row.add_style_class_name('pinned');
            }
            if (item.starred) {
                row.add_style_class_name('starred');
            }

            if (typeof row.set_spacing === 'function') {
                row.set_spacing(10);
            } else if (typeof row.get_layout_manager === 'function') {
                const layout = row.get_layout_manager();
                if (layout && 'spacing' in layout)
                    layout.spacing = 10;
            }
            const supportsClickAction = typeof row.add_action === 'function' &&
                Clutter && typeof Clutter.ClickAction === 'function';
            if (supportsClickAction) {
                const clickAction = new Clutter.ClickAction();
                clickAction.connect('clicked', () => {
                    this._activateHistoryItem(item);
                });
                row.add_action(clickAction);
            } else {
                row.connect('button-release-event', (_actor, event) => {
                    if (event.get_button && event.get_button() === 1) {
                        this._activateHistoryItem(item);
                        return Clutter.EVENT_STOP;
                    }
                    return Clutter.EVENT_PROPAGATE;
                });
            }

            if (this._settings.get_boolean('show-numbers')) {
                const numberLabel = new St.Label({
                    text: `${displayIndex}.`,
                    style_class: 'clipflow-index clipflow-history-number'
                });
                row.add_child(numberLabel);
            }

            this._appendHistoryBadges(row, item);

            const contentBox = new St.BoxLayout({
                vertical: false,
                x_expand: true,
                y_expand: false
            });
            if (typeof contentBox.set_spacing === 'function') {
                contentBox.set_spacing(8);
            } else if (typeof contentBox.get_layout_manager === 'function') {
                const layout = contentBox.get_layout_manager();
                if (layout && 'spacing' in layout)
                    layout.spacing = 8;
            }

            const showPreview = this._settings.get_boolean('show-preview');
            const showTimestamps = this._settings.get_boolean('show-timestamps');
            const shouldShowText = showPreview || !showTimestamps;

            if (shouldShowText) {
                const baseText = showPreview ? this._safeHistoryText(item) : (item.preview || '');
                const text = baseText || _('(Empty entry)');
                const textLabel = new St.Label({
                    text,
                    style_class: 'clipflow-text clipflow-history-text',
                    x_expand: true,
                    y_expand: false
                });
                if (textLabel.clutter_text) {
                    textLabel.clutter_text.set_single_line_mode(true);
                    textLabel.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
                }
                contentBox.add_child(textLabel);
            } else {
                contentBox.set_x_expand(true);
            }

            if (showTimestamps) {
                const tsLabel = this._createTimestampLabel(item);
                if (tsLabel) {
                    contentBox.add_child(tsLabel);
                }
            }

            row.add_child(contentBox);

            const actionBox = this._createHistoryActionBox(item);
            row.add_child(actionBox);

            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button && event.get_button() === 3) {
                    this._openHistoryItemContextMenu(item, row);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            row.connect('key-press-event', (_actor, event) => {
                const key = event.get_key_symbol();
                if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter || key === Clutter.KEY_space) {
                    this._activateHistoryItem(item);
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            this._historyContainer.add_child(row);
        } catch (error) {
        }
    }

    _shouldUseLegacyHistoryRows() {
        return this._useLegacyHistoryRows === true;
    }

    _appendHistoryBadges(row, item) {
        if (!item || (!item.pinned && !item.starred)) {
            return;
        }

        const badgeBox = new St.BoxLayout({
            vertical: false,
            style_class: 'clipflow-row-badges'
        });
        if (typeof badgeBox.set_spacing === 'function') {
            badgeBox.set_spacing(4);
        }
        if (item.pinned) {
            badgeBox.add_child(new St.Icon({
                icon_name: 'emblem-important-symbolic',
                icon_size: 14,
                style_class: 'clipflow-badge-icon pin'
            }));
        }
        if (item.starred) {
            badgeBox.add_child(new St.Icon({
                icon_name: 'emblem-favorite-symbolic',
                icon_size: 14,
                style_class: 'clipflow-badge-icon star'
            }));
        }
        row.add_child(badgeBox);
    }

    _createHistoryActionBox(item) {
        // Minimal, tidy actions: Copy + overflow menu
        const actionBox = new St.BoxLayout({
            vertical: false,
            style_class: 'clipflow-history-actions',
            x_align: Clutter.ActorAlign.END
        });
        if (typeof actionBox.set_spacing === 'function') {
            actionBox.set_spacing(6);
        } else if (typeof actionBox.get_layout_manager === 'function') {
            const layout = actionBox.get_layout_manager();
            if (layout && 'spacing' in layout)
                layout.spacing = 6;
        }

        // Primary quick action: copy
        const copyButton = new St.Button({
            style_class: 'clipflow-action-button',
            child: new St.Icon({ icon_name: 'edit-copy-symbolic', icon_size: 14 }),
            reactive: true, can_focus: false, track_hover: true
        });
        copyButton.set_accessible_name(_('Copy this entry'));
        copyButton.connect('button-release-event', () => {
            this._copyToClipboard(item.text);
            return Clutter.EVENT_STOP;
        });

        // Overflow: pin/star/clean copy/delete in a small menu
        const moreButton = new St.Button({
            style_class: 'clipflow-action-button',
            child: new St.Icon({ icon_name: 'open-menu-symbolic', icon_size: 14 }),
            reactive: true, can_focus: false, track_hover: true
        });
        moreButton.set_accessible_name(_('More actions'));
        moreButton.connect('button-release-event', () => {
            this._openHistoryItemContextMenu(item, moreButton);
            return Clutter.EVENT_STOP;
        });

        actionBox.add_child(copyButton);
        actionBox.add_child(moreButton);
        return actionBox;
    }

    _createLegacyHistoryItem(item, displayIndex) {
        if (!this._historyContainer) {
            return;
        }

        const historyRow = new St.BoxLayout({
            vertical: false,
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: 'clipflow-history-item',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true
        });

        const accessibleName = this._safeHistoryText(item) || _('Clipboard entry');
        historyRow.set_accessible_name(accessibleName);

        if (item.contentType && item.contentType !== 'text') {
            historyRow.add_style_class_name(`clipflow-type-${item.contentType}`);
        }
        if (item.pinned) {
            historyRow.add_style_class_name('pinned');
        }
        if (item.starred) {
            historyRow.add_style_class_name('starred');
        }

        if (typeof historyRow.set_spacing === 'function') {
            historyRow.set_spacing(12);
        } else if (typeof historyRow.get_layout_manager === 'function') {
            const layout = historyRow.get_layout_manager();
            if (layout && 'spacing' in layout)
                layout.spacing = 12;
        }

        if (this._settings.get_boolean('show-numbers')) {
            const numberBadge = new St.Label({
                text: `${displayIndex}.`,
                style_class: 'clipflow-history-number'
            });
            historyRow.add_child(numberBadge);
        }

        this._appendHistoryBadges(historyRow, item);

        const contentBox = new St.BoxLayout({
            vertical: true,
            x_expand: true
        });

        if (typeof contentBox.set_spacing === 'function') {
            contentBox.set_spacing(2);
        } else if (typeof contentBox.get_layout_manager === 'function') {
            const layout = contentBox.get_layout_manager();
            if (layout && 'spacing' in layout)
                layout.spacing = 2;
        }

        const showPreview = this._settings.get_boolean('show-preview');
        const showTimestamps = this._settings.get_boolean('show-timestamps');

        if (showPreview) {
            const textLabel = new St.Label({
                text: this._safeHistoryText(item) || _('(Empty entry)'),
                style_class: 'clipflow-history-text',
                x_expand: true
            });
            textLabel.clutter_text?.set_line_wrap(true);
            textLabel.clutter_text?.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            contentBox.add_child(textLabel);
        }

        if (showTimestamps) {
            const timestampLabel = this._createTimestampLabel(item);
            if (timestampLabel) {
                contentBox.add_child(timestampLabel);
            }
        }

        if (!showPreview && !showTimestamps) {
            const fallbackLabel = new St.Label({
                text: this._safeHistoryText(item) || _('(Empty entry)'),
                style_class: 'clipflow-history-text',
                x_expand: true
            });
            fallbackLabel.clutter_text?.set_line_wrap(true);
            fallbackLabel.clutter_text?.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            contentBox.add_child(fallbackLabel);
        }

        historyRow.add_child(contentBox);

        const actionBox = this._createHistoryActionBox(item);
        historyRow.add_child(actionBox);

        historyRow.connect('button-release-event', (_actor, event) => {
            const button = event.get_button ? event.get_button() : 0;
            if (button === 1) {
                this._activateHistoryItem(item);
                return Clutter.EVENT_STOP;
            }
            if (button === 3) {
                this._openHistoryItemContextMenu(item, historyRow);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        historyRow.connect('key-press-event', (_actor, event) => {
            const key = event.get_key_symbol();
            if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter || key === Clutter.KEY_space) {
                this._activateHistoryItem(item);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._historyContainer.add_child(historyRow);
    }

    _activateHistoryItem(item) {
        if (!item) {
            return;
        }

        this._copyToClipboard(item.text);
        if (this._settings.get_boolean('promote-on-copy')) {
            const index = this._clipboardHistory.findIndex(entry => entry.id === item.id);
            if (index !== -1) {
                const moved = this._clipboardHistory.splice(index, 1)[0];
                moved.timestamp = GLib.DateTime.new_now_local();
                moved.timestampUnix = moved.timestamp.to_unix();
                this._clipboardHistory.unshift(moved);
                this._queueHistorySave();
                this._refreshHistory();
            }
        }

        if (this.menu && typeof this.menu.close === 'function') {
            this.menu.close();
        }
    }

    _createTimestampLabel(item) {
        let formatted = '';
        try {
            let timestamp = null;
            if (item.timestamp instanceof GLib.DateTime) {
                timestamp = item.timestamp;
            } else {
                const unix = this._coerceTimestamp(item);
                if (unix > 0) {
                    timestamp = GLib.DateTime.new_from_unix_local(unix);
                }
            }
            if (timestamp && typeof timestamp.format === 'function') {
                formatted = timestamp.format('%m/%d %H:%M');
            }
            if (!formatted && item.timestampHumanReadable) {
                formatted = item.timestampHumanReadable;
            }
        } catch (e) {
        }

        if (formatted) {
            const characterCount = typeof item.length === 'number'
                ? item.length
                : (typeof item.text === 'string' ? item.text.length : 0);
            if (characterCount > 0) {
                formatted = `${formatted} • ${characterCount} chars`;
            }
        }

        if (!formatted) {
            return null;
        }

        const label = new St.Label({
            text: formatted,
            style_class: 'clipflow-ts clipflow-history-meta',
            x_expand: false,
            y_expand: false
        });
        label.clutter_text?.set_single_line_mode(true);
        label.clutter_text?.set_ellipsize(Pango.EllipsizeMode.END);
        return label;
    }

    _openHistoryItemContextMenu(item, actor) {
        const menu = this._createHistoryItemContextMenu(item);
        this._contextMenuManager.addMenu(menu);

        menu.connect('open-state-changed', (self, isOpen) => {
            if (!isOpen) {
                this._contextMenuManager.removeMenu(menu);
                menu.destroy();
            }
        });

        menu.open(true);
    }

    _createHistoryItemContextMenu(item) {
        const menu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
        const menuActor = this._addActorToUiGroup(menu);
        this._hideActor(menuActor);

        const pinLabel = item.pinned ? _('Unpin') : _('Pin');
        const pinItem = menu.addAction(pinLabel, () => {
            this._togglePinItem(item.id);
        });
        this._applyContextMenuItemStyle(pinItem);

        const starLabel = item.starred ? _('Unstar') : _('Star');
        const starItem = menu.addAction(starLabel, () => {
            this._toggleStarItem(item.id);
        });
        this._applyContextMenuItemStyle(starItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const deleteItem = menu.addAction(_('Delete'), () => {
            this._removeHistoryItemById(item.id);
        });
        this._applyContextMenuItemStyle(deleteItem);

        return menu;
    }

    _toggleStarItem(itemId) {
        const target = this._clipboardHistory.find(historyItem => historyItem.id === itemId);
        if (!target) {
            return;
        }

        target.starred = !target.starred;
        this._queueHistorySave();
        this._refreshHistory();
    }

    _togglePinItem(itemId) {
        const target = this._clipboardHistory.find(historyItem => historyItem.id === itemId);
        if (!target) {
            return;
        }

        target.pinned = !target.pinned;
        this._queueHistorySave();
        this._refreshHistory();
    }

    _copyToClipboard(text, showToast = true) {
        const wantToast = (() => {
            try {
                return this._settings.get_boolean('show-copy-notifications');
            } catch (_e) {
                return true;
            }
        })();
        const wantPreview = (() => {
            try {
                return this._settings.get_boolean('show-copied-preview');
            } catch (_e) {
                return true;
            }
        })();
        const previewLength = (() => {
            try {
                return this._settings.get_int('copied-preview-length');
            } catch (_e) {
                return 30;
            }
        })();

        try {
            const clipboard = St.Clipboard.get_default();
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
            clipboard.set_text(St.ClipboardType.PRIMARY, text);
            const cached = typeof text === 'string' ? text.trim() : '';
            this._lastClipboardText = cached;
            this._lastPrimaryText = cached;
            const now = GLib.get_monotonic_time();
            const intervalUs = Math.max(0, this._copyNotifyMinIntervalMs) * 1000;
            const allowNotify = cached !== this._lastCopyNotifyText || (now - this._lastCopyNotifyTime) >= intervalUs;

            if (showToast && wantToast && allowNotify) {
                let message = _('Text copied to clipboard');
                if (wantPreview) {
                    const max = Math.max(5, previewLength);
                    const cachedChars = this._getCharacterArray(cached);
                    const preview = cachedChars.length > max
                        ? `${cachedChars.slice(0, max - 3).join('')}...`
                        : cached;
                    if (preview) message = _('Copied: %s').format(preview);
                }
                Main.notify('ClipFlow Pro', message);
                this._lastCopyNotifyTime = now;
                this._lastCopyNotifyText = cached;
            }
        } catch (e) {
            if (wantToast)
                Main.notify('ClipFlow Pro', _('Failed to copy text'));
        }
    }

    _clearAllHistory() {
        this._clearAllAutoClearTimers();
        this._clipboardHistory = [];
        this._currentPage = 0;
        this._invalidateFilterCache(true);
        this._updateIconState();
        this._populateContextMenuRecentEntries();
        this._refreshHistory();
        this._queueHistorySave();
        Main.notify('ClipFlow Pro', _('History cleared'));
    }

    _pauseMonitoring(minutes) {
        const durationMin = Math.max(1, minutes);
        this._stopClipboardMonitoring();
        if (this._monitoringResumeTimeoutId) {
            GLib.source_remove(this._monitoringResumeTimeoutId);
            this._monitoringResumeTimeoutId = 0;
        }
        const seconds = durationMin * 60;
        this._monitoringResumeTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            this._monitoringResumeTimeoutId = 0;
            this._startClipboardMonitoring();
            return GLib.SOURCE_REMOVE;
        });
        Main.notify('ClipFlow Pro', _('Monitoring paused for %d minutes').format(durationMin));
    }

    _openSettings() {
        this._openPreferencesTab('general');
    }

    _openPreferencesTab(target = 'general') {
        try {
            this._setPrefsTarget(target);
            Main.extensionManager?.openExtensionPrefs?.(UUID, '', null);
        } catch (e) {
            Main.notify('ClipFlow Pro', _('Settings not available'));
        }
    }

    _setPrefsTarget(target) {
        try {
            const schema = this._settings.settings_schema;
            if (schema && typeof schema.has_key === 'function' && schema.has_key('target-prefs-tab')) {
                this._settings.set_string('target-prefs-tab', target);
            }
        } catch (e) {
            console.warn(`ClipFlow Pro: Unable to set target preferences tab: ${e.message}`);
        }
    }

    destroy() {
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;

        this._stopClipboardMonitoring();

        // Disconnect panel-related listeners
        this._disconnectPanelWatchers();

        if (this.menu && typeof this.menu.removeAll === 'function') {
            try {
                this.menu.removeAll();
            } catch (error) {
            console.warn(`ClipFlow Pro: Failed to clear menu: ${error.message}`);
            }
        }

        if (this._icon) {
            const parent = this._icon.get_parent();
            if (parent && typeof parent.remove_child === 'function') {
                parent.remove_child(this._icon);
            }
            this._icon.destroy();
            this._icon = null;
        }
        
        if (this._buttonPressId) {
            this.disconnect(this._buttonPressId);
            this._buttonPressId = 0;
        }

        if (this._popupMenuId) {
            this.disconnect(this._popupMenuId);
            this._popupMenuId = 0;
        }

        if (this._menuOpenChangedId && this.menu) {
            this.menu.disconnect(this._menuOpenChangedId);
            this._menuOpenChangedId = 0;
        }

        if (this._contextMenu) {
            if (this._contextMenuOpenChangedId) {
                this._contextMenu.disconnect(this._contextMenuOpenChangedId);
                this._contextMenuOpenChangedId = 0;
            }
            this._contextMenu.destroy();
            this._contextMenu = null;
        }
        this._contextMenuManager = null;
        this._contextMenuNotificationItem = null;
        this._contextMenuRecentSection = null;
        if (this._menuContainerItem) {
            // CRITICAL: Remove child before destroying St.Bin parent to avoid crash
            if (this._menuContainerBox) {
                try {
                    if (typeof this._menuContainerItem.remove_child === 'function') {
                        this._menuContainerItem.remove_child(this._menuContainerBox);
                    } else if (this._menuContainerItem.actor && typeof this._menuContainerItem.actor.remove_child === 'function') {
                        this._menuContainerItem.actor.remove_child(this._menuContainerBox);
                    }
                    this._menuContainerBox.destroy();
                } catch (e) {
                    console.warn(`ClipFlow Pro: Error removing menu container box: ${e.message}`);
                }
                this._menuContainerBox = null;
            }
            this._menuContainerItem.destroy();
            this._menuContainerItem = null;
        }
        this._clearHistoryContainer();
        this._destroyActor(this._historyContainer);
        this._historyContainer = null;
        this._destroyActor(this._historyScrollView);
        this._historyScrollView = null;
        this._destroyActor(this._paginationBox);
        this._paginationBox = null;
        this._destroyActor(this._paginationLabel);
        this._paginationLabel = null;
        this._destroyActor(this._paginationPrevButton);
        this._paginationPrevButton = null;
        this._destroyActor(this._paginationNextButton);
        this._paginationNextButton = null;
        this._destroyActor(this._searchEntry);
        this._searchEntry = null;
        this._unregisterKeybindings();
        this._clearAllAutoClearTimers();
        this._cancelHistorySaveTimeout();

        // Clean up monitoring resume timeout
        if (this._monitoringResumeTimeoutId) {
            GLib.source_remove(this._monitoringResumeTimeoutId);
            this._monitoringResumeTimeoutId = 0;
        }
        
        // Clean up search debounce
        if (this._searchDebounceTimeout) {
            GLib.source_remove(this._searchDebounceTimeout);
            this._searchDebounceTimeout = 0;
        }

        const shouldClearHistory = this._settings.get_boolean('clear-on-logout') && !this._skipCleanupOnDestroy;
        if (shouldClearHistory) {
            this._clearHistoryStorage();
        } else {
            this._flushHistorySave();
        }

        // Disconnect settings
        if (this._settingsSignalIds && this._settingsSignalIds.length > 0) {
            this._settingsSignalIds.forEach(id => this._settings.disconnect(id));
            this._settingsSignalIds = [];
        }
        
        // Clear pointers
        this._lastClipboardText = '';
        this._skipCleanupOnDestroy = false;
        this._clearDeferredSources();
        super.destroy();
    }
});

export default class ClipFlowProExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._settings = null;
        this._panelPositionChangedId = 0;
        this._pendingAttachIdleId = 0;
    }

    _clearPendingAttachIdle() {
        if (this._pendingAttachIdleId) {
            GLib.source_remove(this._pendingAttachIdleId);
            this._pendingAttachIdleId = 0;
        }
    }

    _disconnectPanelPositionWatcher() {
        if (this._settings && this._panelPositionChangedId) {
            this._settings.disconnect(this._panelPositionChangedId);
            this._panelPositionChangedId = 0;
        }
    }

    _destroyIndicator() {
        if (!this._indicator) {
            return;
        }
        this._indicator.destroy();
        this._indicator = null;
    }

    enable() {
        try {
            // No-op: GNOME Shell initiates translations via gettext-domain in metadata
            this._clearPendingAttachIdle();
            this._disconnectPanelPositionWatcher();
            this._destroyIndicator();

            const settings = this.getSettings();
            if (!settings)
                throw new Error('Settings schema not found.');
            this._settings = settings;

            // Heuristic: prefer right placement if Zorin taskbar is present
            const schemaSource = Gio.SettingsSchemaSource.get_default();
            const shellSchema = schemaSource?.lookup('org.gnome.shell', true);
            if (shellSchema) {
                const shellSettings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
                const extList = shellSettings.get_strv('enabled-extensions') || [];
                if (extList.indexOf('zorin-taskbar@zorinos.com') !== -1) {
                    const current = this._settings.get_string('panel-position');
                    if (current !== 'right' && current !== 'left') {
                        this._settings.set_string('panel-position', 'right');
                    }
                }
            }
            const panelPosition = this._normalizePanelPosition(this._settings.get_string('panel-position'));
            this._indicator = new ClipFlowIndicator(this._settings);
            this._attachIndicatorWithFallback(panelPosition);

            this._panelPositionChangedId = this._settings.connect('changed::panel-position', () => {
                this._relocateIndicator();
            });

        } catch (e) {
            throw e;
        }
    }

    disable() {
        this._clearPendingAttachIdle();
        this._disconnectPanelPositionWatcher();
        this._destroyIndicator();
        this._settings = null;
    }

    _relocateIndicator() {
        const newPosition = this._normalizePanelPosition(this._settings ? this._settings.get_string('panel-position') : 'right');
        this._clearPendingAttachIdle();
        if (this._indicator) {
            if (typeof this._indicator.prepareForReposition === 'function') {
                this._indicator.prepareForReposition();
            }
            this._destroyIndicator();
        }

        this._indicator = new ClipFlowIndicator(this._settings);
        this._attachIndicatorWithFallback(newPosition);
    }

    _normalizePanelPosition(position) {
        const validPositions = new Set(['left', 'center', 'right']);
        if (typeof position === 'string' && validPositions.has(position)) {
            return position;
        }

        console.warn(`ClipFlow Pro: Invalid panel-position '${position}', defaulting to 'right'.`);
        if (this._settings) {
            this._settings.set_string('panel-position', 'right');
        }
        return 'right';
    }

    _attachIndicatorWithFallback(preferred) {
        try {
            this._clearPendingAttachIdle();
            const positions = ['right', 'center', 'left'];
            const startIndex = Math.max(0, positions.indexOf(preferred));
            const ordered = [...positions.slice(startIndex), ...positions.slice(0, startIndex)];

            for (const pos of ordered) {
                try {
                    Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, pos);
                    // Give Shell a tick to attach
                    let idleId = 0;
                    idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        this._pendingAttachIdleId = 0;
                        const indicator = this._indicator;
                        if (!indicator) {
                            return GLib.SOURCE_REMOVE;
                        }
                        const hasParent = Boolean((indicator.get_parent && indicator.get_parent()) || (indicator.actor && indicator.actor.get_parent && indicator.actor.get_parent()));
                        if (!hasParent && indicator._createIcon) {
                            indicator._createIcon();
                        }
                        return GLib.SOURCE_REMOVE;
                    });
                    this._pendingAttachIdleId = idleId;
                    return;
                } catch (error) {
                    console.warn(`ClipFlow Pro: Failed to attach indicator to '${pos}': ${error}`);
                    continue;
                }
            }
            console.warn('ClipFlow Pro: Unable to attach indicator to any panel position.');
        } catch (e) {
            console.warn(`ClipFlow Pro: attach fallback error: ${e.message}`);
        }
    }
}
