'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, GObject, GLib, Gio, Clutter, Meta, Shell, Pango} = imports.gi;
let Gtk = null; try { Gtk = imports.gi.Gtk; } catch (_e) { Gtk = null; }

const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

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
        // GNOME 43 compatibility: prefer legacy rows unless user explicitly enables new rows
        this._useLegacyHistoryRows = this._settings.get_boolean('use-legacy-menu-items');
        if (this._useLegacyHistoryRows === false) {
            // Force legacy rows by default on GNOME 43 for better compatibility
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
        // Rendering/compatibility settings
        this._renderingMode = this._safeGetString('rendering-mode', 'auto');
        this._classicMaxRows = this._safeGetInt('classic-max-rows', 50);
        this._disableCss = this._safeGetBoolean('disable-css', false);
        this._warnConflicts = this._safeGetBoolean('warn-conflicts', true);
        // Limit how many MIME fallbacks we try to avoid stalls on non‑text clipboards
        this._maxTextMimeTries = 6;
        // GNOME 43 stability: prefer Classic in Auto; Enhanced only when explicitly selected
        this._forceClassicList = (this._renderingMode === 'classic' || this._renderingMode === 'auto');
        this._autoFallbackApplied = false;
        this._classicShowCount = 0; // for "Show more" in classic mode
        this._classicFilterMode = 'all';
        // Classic popup-item rows fallback for GNOME 43 to avoid any actor layout/theme issues
        this._classicRowsEnabled = true;

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
        // Reduced polling interval for better responsiveness, especially on Wayland
        // GNOME 43 Wayland requires very aggressive polling due to clipboard API limitations
        // Note: Actual polling interval is set in _startClipboardPolling() based on Wayland detection
        this._clipboardPollIntervalMs = 500; // Base interval, adjusted dynamically for Wayland
        // Throttle external spawn fallbacks to avoid stressing the shell at startup
        this._spawnGuardMs = 5000;
        this._lastSpawnTimeMs = 0;
        this._spawnInFlight = false;
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
        this._settingsSignalIds.push(this._settings.connect('changed::pause-on-lock', () => {
            this._pauseOnLock = this._safeGetBoolean('pause-on-lock', false);
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::clear-on-lock', () => {
            this._clearOnLock = this._safeGetBoolean('clear-on-lock', false);
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::copy-as-plain-text', () => {
            this._copyAsPlain = this._safeGetBoolean('copy-as-plain-text', false);
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
            this._useLegacyHistoryRows = this._settings.get_boolean('use-legacy-menu-items');
            this._buildMenu();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::rendering-mode', () => {
            this._renderingMode = this._safeGetString('rendering-mode', 'auto');
            this._forceClassicList = (this._renderingMode === 'classic');
            this._autoFallbackApplied = false;
            this._buildMenu();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::classic-max-rows', () => {
            this._classicMaxRows = this._safeGetInt('classic-max-rows', 50);
            this._buildMenu();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::disable-css', () => {
            this._disableCss = this._safeGetBoolean('disable-css', false);
            this._buildMenu();
        }));
        ['show-menu-shortcut', 'enhanced-copy-shortcut', 'enhanced-paste-shortcut'].forEach(key => {
            this._settingsSignalIds.push(this._settings.connect(`changed::${key}`, () => {
                this._registerKeybindings();
            }));
        });
        
        // Defaults for lock behavior + copy sanitize
        this._pauseOnLock = this._safeGetBoolean('pause-on-lock', false);
        this._clearOnLock = this._safeGetBoolean('clear-on-lock', false);
        this._copyAsPlain = this._safeGetBoolean('copy-as-plain-text', false);

        this._createIcon();
        this._watchPanelForIconSize();
        this._buildContextMenu();
        this._loadHistoryFromDisk();
        this._menuBuilt = false;
        // Defer menu build and clipboard monitoring to reduce startup risk
        this._scheduleTimeout(400, () => { try { this._startClipboardMonitoring(); } catch (_e) {} return GLib.SOURCE_REMOVE; });
        this._registerKeybindings();
        this._connectLockSignals();
        
        // Connect menu open/close signals to refresh history when menu opens
        if (this.menu) {
            if (this._menuOpenChangedId) {
                this.menu.disconnect(this._menuOpenChangedId);
            }
            this._menuOpenChangedId = this.menu.connect('open-state-changed', (menu, open) => {
                console.log(`ClipFlow Pro: Menu open-state-changed (open: ${open}, container exists: ${!!this._historyContainer})`);
                if (open) {
                    if (!this._menuBuilt) {
                        try { this._buildMenu(); this._menuBuilt = true; } catch (_e) {}
                    }
                    if (this._forceClassicList) {
                        try { if (this._searchEntry?.clutter_text?.set_text) this._searchEntry.clutter_text.set_text(''); } catch (_e) {}
                        this._lastSearchText = '';
                        // Rebuild entire menu to reflect latest history
                        this._buildMenu();
                    } else if (this._historyContainer) {
                        console.log(`ClipFlow Pro: Menu opened - refreshing history (current children: ${this._historyContainer.get_children ? this._historyContainer.get_children().length : 0})`);
                        this._refreshHistory();
                    }
                }
            });
        }
        
        this._buttonPressId = this.connect('button-press-event', this._onButtonPressEvent.bind(this));
        this._popupMenuId = this.connect('popup-menu', this._onPopupMenu.bind(this));
    }

    _connectLockSignals() {
        this._lockSignals = this._lockSignals || [];
        const shield = Main.screenShield;
        if (!shield) return;
        const onLocked = () => {
            if (this._clearOnLock) this._clearAllHistory();
            if (this._pauseOnLock) {
                this._pausedByLock = true;
                this._stopClipboardMonitoring();
            }
        };
        const onUnlocked = () => {
            if (this._pausedByLock) {
                this._pausedByLock = false;
                this._startClipboardMonitoring();
            }
        };
        const id1 = shield.connect('locked', onLocked);
        const id2 = shield.connect('unlocked', onUnlocked);
        if (id1) this._lockSignals.push([shield, id1]);
        if (id2) this._lockSignals.push([shield, id2]);
    }

    _disconnectLockSignals() {
        if (!this._lockSignals) return;
        for (const [obj, id] of this._lockSignals) {
            obj.disconnect(id);
        }
        this._lockSignals = [];
    }

    _addIndicatorIcon() {
        const icon = new St.Icon({
            style_class: 'system-status-icon clipflow-pro-panel-icon',
            icon_name: 'edit-paste-symbolic'
        });
        if (typeof icon.set_icon_size === 'function') {
            icon.set_icon_size(16);
        }
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
        try {
            const panel = Main.panel;
            if (panel && Array.isArray(this._panelSignalIds)) {
                this._panelSignalIds.forEach(id => {
                    if (typeof id === 'number' && id > 0) {
                        try { panel.disconnect(id); } catch (_e) {}
                    }
                });
            }
        } catch (_e) {}
        this._panelSignalIds = [];

        try {
            const display = global.display;
            if (display && Array.isArray(this._displaySignalIds)) {
                this._displaySignalIds.forEach(id => {
                    if (typeof id === 'number' && id > 0) {
                        try { display.disconnect(id); } catch (_e) {}
                    }
                });
            }
        } catch (_e) {}
        this._displaySignalIds = [];
    }

    _watchPanelForIconSize() {
        try {
            const panel = Main.panel;
            if (!panel) return;

            this._disconnectPanelWatchers();
            // Apply immediately
            this._setIconSize(this._computeIconSize());

            const onChange = () => {
                this._setIconSize(this._computeIconSize());
            };

            try {
                const id = panel.connect('style-changed', onChange);
                if (typeof id === 'number' && id > 0) {
                    this._panelSignalIds.push(id);
                }
            } catch (_e) {}

            try {
                const id = panel.connect('notify::height', onChange);
                if (typeof id === 'number' && id > 0) {
                    this._panelSignalIds.push(id);
                }
            } catch (_e) {}

            const display = global.display;
        if (display) {
            try {
                const id = display.connect('notify::scale-factor', onChange);
                if (typeof id === 'number' && id > 0) {
                    this._displaySignalIds.push(id);
                }
            } catch (_e) {}
        }
        } catch (_e) {
            // no-op
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
        if (!this._disableCss) {
            if (this.menu && typeof this.menu.add_style_class_name === 'function') {
                this.menu.add_style_class_name('clipflow-menu');
            } else if (this.menu && this.menu.actor && typeof this.menu.actor.add_style_class_name === 'function') {
                this.menu.actor.add_style_class_name('clipflow-menu');
            }
        }
        
        // Header removed to avoid duplicate title rows and reduce clutter

        // Classic, no-container fallback path
        if (this._forceClassicList) {
            this._buildClassicListMenu();
            return;
        }
        
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
        // GNOME 43 uses .actor property for PopupBaseMenuItem
        // Try .actor first (GNOME 43), then direct add_child (GNOME 45+)
        let containerAdded = false;
        if (this._menuContainerItem.actor && typeof this._menuContainerItem.actor.add_child === 'function') {
            this._menuContainerItem.actor.add_child(container);
            this._menuContainerItem.actor.x_expand = true;
            this._menuContainerItem.actor.y_expand = true;
            containerAdded = true;
            console.log('ClipFlow Pro: Added container via .actor (GNOME 43 style)');
        } else if (typeof this._menuContainerItem.add_child === 'function') {
            this._menuContainerItem.add_child(container);
            this._menuContainerItem.x_expand = true;
            this._menuContainerItem.y_expand = true;
            containerAdded = true;
            console.log('ClipFlow Pro: Added container via add_child (GNOME 45+ style)');
        } else if (typeof this._menuContainerItem.add_actor === 'function') {
            this._menuContainerItem.add_actor(container);
            containerAdded = true;
            console.log('ClipFlow Pro: Added container via add_actor (fallback)');
        }
        
        if (!containerAdded) {
            console.error('ClipFlow Pro: ERROR - Failed to add container to menu item!');
        }
        this.menu.addMenuItem(this._menuContainerItem);
        this._menuContainerBox = container;
        this._applyUiStyle();
        
        // GNOME 43 compatibility: Ensure menu item is properly set up
        console.log(`ClipFlow Pro: Menu container item added. Container children: ${container.get_children ? container.get_children().length : 0}`);
        if (this._menuContainerItem.actor) {
            console.log(`ClipFlow Pro: Menu item has .actor property (GNOME 43 style)`);
        }
        if (typeof this._menuContainerItem.add_child === 'function') {
            console.log(`ClipFlow Pro: Menu item supports add_child()`);
        }

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
            console.log('ClipFlow Pro: Set container as child of ScrollView (set_child)');
        } else if (typeof this._historyScrollView.add_child === 'function') {
            this._historyScrollView.add_child(this._historyContainer);
            console.log('ClipFlow Pro: Added container to ScrollView (add_child)');
        } else {
            this._historyScrollView.add_actor(this._historyContainer);
            console.log('ClipFlow Pro: Added container to ScrollView (add_actor)');
        }

        container.add_child(this._historyScrollView);
        console.log(`ClipFlow Pro: ScrollView added to container. ScrollView children: ${this._historyScrollView.get_children ? this._historyScrollView.get_children().length : 0}, Container children: ${container.get_children ? container.get_children().length : 0}`);
        
        // Verify the connection
        const scrollViewChildren = this._historyScrollView.get_children ? this._historyScrollView.get_children() : [];
        const hasContainer = scrollViewChildren.some(child => child === this._historyContainer);
        console.log(`ClipFlow Pro: ScrollView contains history container: ${hasContainer}`);

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

    _buildClassicListMenu() {
        try {
            // Render a simple list of items directly as PopupMenu items (no custom container/pagination)
            const showNumbers = this._safeGetBoolean('show-numbers', true);
            const showPreview = this._safeGetBoolean('show-preview', true);
            const showTimestamps = this._safeGetBoolean('show-timestamps', true);

            // No header here either – keep classic list minimalist

            // Add a lightweight search row
            try {
                const searchItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
                const searchBox = new St.BoxLayout({ vertical: false });
                const entry = new St.Entry({ hint_text: _('Search clipboard history…') });
                this._searchEntry = entry;
                entry.clutter_text.set_single_line_mode?.(true);
                entry.clutter_text.connect('text-changed', () => {
                    // Reset classic show count on new search
                    this._classicShowCount = 0;
                    // Rebuild classic list to reflect filter
                    this._buildMenu();
                });
                searchBox.add_child(entry);
                // Quick filter buttons: All / Pinned / Starred
                const mkFilterBtn = (label, mode) => {
                    const b = new St.Button({ label, style_class: 'clipflow-button' });
                    b.add_style_class_name('clipflow-button-secondary');
                    if (this._classicFilterMode === mode) b.add_style_class_name('active');
                    b.connect('clicked', () => { this._classicFilterMode = mode; this._classicShowCount = 0; this._buildMenu(); });
                    return b;
                };
                searchBox.add_child(mkFilterBtn(_('All'), 'all'));
                searchBox.add_child(mkFilterBtn(_('Pinned'), 'pinned'));
                searchBox.add_child(mkFilterBtn(_('Starred'), 'starred'));
                // Add toggle to Enhanced UI inside Classic search row
                const toggle = new St.Button({ label: _('Use Enhanced UI'), style_class: 'clipflow-button' });
                toggle.add_style_class_name('clipflow-button-secondary');
                toggle.connect('clicked', () => {
                    this._settings.set_string('rendering-mode', 'enhanced');
                    this._renderingMode = 'enhanced';
                    this._forceClassicList = false;
                    this._autoFallbackApplied = false;
                    this._buildMenu();
                });
                searchBox.add_child(toggle);
                if (searchItem.actor?.add_child) searchItem.actor.add_child(searchBox);
                else searchItem.add_child?.(searchBox);
                this.menu.addMenuItem(searchItem);
            } catch (_e) {}

            // Filtered list and section splits
            const base = this._getFilteredHistory();
            const filtered = this._classicFilterMode === 'starred'
                ? base.filter(item => item && item.starred)
                : this._classicFilterMode === 'pinned'
                ? base.filter(item => item && item.pinned)
                : base;
            const pinned = filtered.filter(i => i && i.pinned);
            const starred = filtered.filter(i => i && i.starred && !i.pinned);
            const othersAll = filtered.filter(i => i && !i.pinned && !i.starred);
            const limitBase = Math.max(10, Math.min(200, this._classicMaxRows || 50));
            const batch = (this._classicShowCount && this._classicShowCount > 0) ? (limitBase + this._classicShowCount) : limitBase;
            const others = othersAll.slice(0, batch);
            let displayIndex = 1;
            if (pinned.length === 0 && starred.length === 0 && others.length === 0) {
                const emptyItem = new PopupMenu.PopupMenuItem(_('Nothing copied yet'), { reactive: false, can_focus: false });
                emptyItem.setSensitive(false);
                this.menu.addMenuItem(emptyItem);
                return;
            }
            // Pinned strip (respect hide-pinned)
            const hidePinned = this._safeGetBoolean('hide-pinned', false);
            if (pinned.length > 0 && !hidePinned) {
                const pinItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
                const pinBox = new St.BoxLayout({ vertical: false });
                const pinLabel = new St.Label({ text: `${_('Pinned') } (${pinned.length}):`, style_class: 'clipflow-history-meta' });
                pinBox.add_child(pinLabel);
                pinned.slice(0, 6).forEach(p => {
                    const preview = this._truncateText(this._safeHistoryText(p) || p.preview || _('(Empty)'), 18);
                    const b = new St.Button({ label: preview, style_class: 'clipflow-button' });
                    b.add_style_class_name('clipflow-button-secondary');
                    b.connect('clicked', () => this._activateHistoryItem(p));
                    pinBox.add_child(b);
                });
                if (pinItem.actor?.add_child) pinItem.actor.add_child(pinBox); else pinItem.add_child?.(pinBox);
                this.menu.addMenuItem(pinItem);
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            // Starred section (respect hide-starred)
            const hideStarred = this._safeGetBoolean('hide-starred', false);
            if (starred.length > 0 && !hideStarred) {
                const secHeader = new PopupMenu.PopupMenuItem(`${_('Starred')} (${starred.length})`, { reactive: false, can_focus: false });
                secHeader.setSensitive(false);
                this.menu.addMenuItem(secHeader);
                starred.forEach(s => { this._addClassicRowWithActions(s, displayIndex++, { showNumbers, showPreview, showTimestamps }); });
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            // Others
            others.forEach(o => { this._addClassicRowWithActions(o, displayIndex++, { showNumbers, showPreview, showTimestamps }); });

            // Show more button when more results exist
            if (othersAll.length > others.length) {
                const remaining = othersAll.length - others.length;
                const moreLabel = _('Show more (%s)');
                const btn = new PopupMenu.PopupMenuItem(moreLabel.format(remaining));
                btn.connect('activate', () => {
                    this._classicShowCount = (this._classicShowCount || 0) + (this._classicMaxRows || 50);
                    this._buildMenu();
                });
                this.menu.addMenuItem(btn);
            } else if (this._classicShowCount > 0 && othersAll.length > 0) {
                const less = new PopupMenu.PopupMenuItem(_('Show less'));
                less.connect('activate', () => {
                    this._classicShowCount = 0;
                    this._buildMenu();
                });
                this.menu.addMenuItem(less);
            }

            // Action bar (Clear, Settings, Export, Import, Purge, UI toggle)
            try {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                const actionsItem = new PopupMenu.PopupBaseMenuItem({ reactive: false, can_focus: false });
                const box = new St.BoxLayout({ vertical: false });
                const mkBtn = (label, cb, danger = false) => {
                    const b = new St.Button({ label, style_class: 'clipflow-button' });
                    if (danger) b.add_style_class_name('clipflow-button-danger'); else b.add_style_class_name('clipflow-button-secondary');
                    b.connect('clicked', cb);
                    return b;
                };
                const clearB = mkBtn(_('Clear All'), () => this._clearAllHistory(), true);
                const settingsB = mkBtn(_('Settings'), () => this._openSettings());
                const exportB = mkBtn(_('Export'), () => this._exportHistoryToDesktop());
                const importB = mkBtn(_('Import'), () => this._importHistoryFromDesktop());
                const purgeB = mkBtn(_('Purge Duplicates'), () => this._purgeDuplicates());
                const pin3B = mkBtn(_('Pin Top 3'), () => this._pinTopN(3));
                const pin5B = mkBtn(_('Pin Top 5'), () => this._pinTopN(5));
                const unpinB = mkBtn(_('Unpin All'), () => this._unpinAll());
                const uiB = mkBtn(_('Use Enhanced UI'), () => { this._settings.set_string('rendering-mode', 'enhanced'); this._renderingMode='enhanced'; this._forceClassicList=false; this._autoFallbackApplied=false; this._buildMenu(); });
                [clearB, settingsB, exportB, importB, purgeB, pin3B, pin5B, unpinB, uiB].forEach(b => box.add_child(b));
                if (actionsItem.actor?.add_child) actionsItem.actor.add_child(box); else actionsItem.add_child?.(box);
                this.menu.addMenuItem(actionsItem);
            } catch (_e) {}
        } catch (error) {
            console.error(`ClipFlow Pro: Error building classic list menu: ${error.message}`);
        }
    }

    _pinTopN(n) {
        try {
            const list = this._getFilteredHistory();
            const limit = Math.min(Math.max(0, n|0), list.length);
            for (let i = 0; i < limit; i++) {
                if (list[i]) list[i].pinned = true;
            }
            this._queueHistorySave();
            this._refreshHistory();
        } catch (_e) {}
    }

    _unpinAll() {
        try {
            this._clipboardHistory.forEach(item => { if (item) item.pinned = false; });
            this._queueHistorySave();
            this._refreshHistory();
        } catch (_e) {}
    }

    _addClassicRowWithActions(item, displayIndex, opts) {
        const showNumbers = !!opts?.showNumbers;
        const showPreview = !!opts?.showPreview;
        const showTimestamps = !!opts?.showTimestamps;
        const base = showPreview ? (this._safeHistoryText(item) || _('(Empty entry)')) : (item.preview || this._safeHistoryText(item) || _('(Empty entry)'));
        const text = this._truncateText(base, 200);
        const rowItem = new PopupMenu.PopupBaseMenuItem({ reactive: true, can_focus: true });
        const row = new St.BoxLayout({ vertical: false });
        if (showNumbers) {
            const num = new St.Label({ text: `${displayIndex}.`, style_class: 'clipflow-history-number' });
            row.add_child(num);
        }
        const textLabel = new St.Label({ text, style_class: 'clipflow-history-text', x_expand: true });
        textLabel.clutter_text?.set_single_line_mode(true);
        textLabel.clutter_text?.set_ellipsize(Pango.EllipsizeMode.END);
        row.add_child(textLabel);
        if (showTimestamps) {
            const ts = this._createTimestampLabel(item);
            if (ts) row.add_child(ts);
        }
        const actions = new St.BoxLayout({ vertical: false, style_class: 'clipflow-history-actions' });
        const mkIconBtn = (icon, cb) => {
            const b = new St.Button({ style_class: 'clipflow-action-button' });
            const ic = new St.Icon({ icon_name: icon, icon_size: 14 });
            b.set_child(ic);
            b.connect('clicked', cb);
            return b;
        };
        // Keep only Copy + overflow
        actions.add_child(mkIconBtn('edit-copy-symbolic', () => this._copyToClipboard(item.text)));
        actions.add_child(mkIconBtn('open-menu-symbolic', () => this._openHistoryItemContextMenu(item, rowItem.actor || rowItem)));
        row.add_child(actions);
        (rowItem.actor || rowItem).connect?.('button-release-event', (_a, ev) => {
            const button = ev.get_button ? ev.get_button() : 0;
            if (button === 1) { this._activateHistoryItem(item); return Clutter.EVENT_STOP; }
            if (button === 3) { this._openHistoryItemContextMenu(item, rowItem.actor || rowItem); return Clutter.EVENT_STOP; }
            return Clutter.EVENT_PROPAGATE;
        });
        if (rowItem.actor?.add_child) rowItem.actor.add_child(row); else rowItem.add_child?.(row);
        this.menu.addMenuItem(rowItem);
        console.log('ClipFlow Pro: Classic row added (with actions)');
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
        if (button === Clutter.BUTTON_PRIMARY) {
            this._openMainMenuWithFallback();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onPopupMenu() {
        // Treat popup-menu (keyboard) as primary open of main menu with fallback
        this._openMainMenuWithFallback();
    }

    _openMainMenuWithFallback() {
        try {
            if (!this.menu) return;
            if (!this._menuBuilt) {
                try { this._buildMenu(); this._menuBuilt = true; } catch (_e) {}
            }
            try { this.menu.open(true); } catch (_e) {}
            // If menu fails to open, fall back to context menu
            this._scheduleTimeout(140, () => {
                try {
                    if (!this.menu.isOpen) {
                        this._openContextMenu();
                    }
                } catch (_e) {
                    this._openContextMenu();
                }
                return GLib.SOURCE_REMOVE;
            });
        } catch (_e) {
            this._openContextMenu();
        }
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

        return searchContainer;
    }

    _createActionButtons() {
        const buttonContainer = new St.BoxLayout({
            vertical: false,
            x_expand: true
        });
        buttonContainer.add_style_class_name('clipflow-action-container');
        
        // Clear button
        const clearButton = new St.Button({
            label: _('Clear All'),
            style_class: 'clipflow-button',
            x_expand: true
        });
        clearButton.add_style_class_name('clipflow-button-danger');
        clearButton.set_accessible_name(_('Clear all clipboard history'));
        clearButton.connect('clicked', () => {
            this._clearAllHistory();
        });
        buttonContainer.add_child(clearButton);

        const spacer = new St.Widget({
            reactive: false,
            can_focus: false
        });
        if (typeof spacer.set_x_expand === 'function') {
            spacer.set_x_expand(false);
        }
        if (typeof spacer.set_y_expand === 'function') {
            spacer.set_y_expand(false);
        }
        if (typeof spacer.set_width === 'function') {
            spacer.set_width(16);
        } else if (typeof spacer.set_style === 'function') {
            spacer.set_style('min-width: 16px;');
        }
        spacer.add_style_class_name('clipflow-action-spacer');
        buttonContainer.add_child(spacer);
        
        // Settings button
        const settingsButton = new St.Button({
            label: _('Settings'),
            style_class: 'clipflow-button',
            x_expand: true
        });
        settingsButton.add_style_class_name('clipflow-button-secondary');
        settingsButton.set_accessible_name(_('Open ClipFlow Pro settings'));
        settingsButton.connect('clicked', () => {
            this._openSettings();
        });
        buttonContainer.add_child(settingsButton);

        // UI mode toggle button (Enhanced <> Classic)
        const uiButton = new St.Button({
            label: this._renderingMode === 'classic' ? _('Use Enhanced UI') : _('Use Classic UI'),
            style_class: 'clipflow-button',
            x_expand: true
        });
        uiButton.add_style_class_name('clipflow-button-secondary');
        uiButton.set_accessible_name(_('Switch UI rendering mode'));
        uiButton.connect('clicked', () => {
            try {
                const target = (this._renderingMode === 'classic') ? 'enhanced' : 'classic';
                this._settings.set_string('rendering-mode', target);
                this._renderingMode = target;
                this._forceClassicList = (target === 'classic');
                this._autoFallbackApplied = false;
                this._buildMenu();
            } catch (_e) {}
        });
        buttonContainer.add_child(uiButton);
        buttonContainer.set_margin_top(8);
        // Secondary actions row (Export / Import / Purge)
        const secondary = new St.BoxLayout({ vertical: false, x_expand: true });
        secondary.add_style_class_name('clipflow-action-container');
        const mkBtn = (label, cb) => {
            const b = new St.Button({ label, style_class: 'clipflow-button', x_expand: true });
            b.add_style_class_name('clipflow-button-secondary');
            b.connect('clicked', cb);
            return b;
        };
        const exportBtn = mkBtn(_('Export'), () => this._exportHistoryToDesktop());
        const importBtn = mkBtn(_('Import'), () => this._importHistoryFromDesktop());
        const purgeBtn = mkBtn(_('Purge Duplicates'), () => this._purgeDuplicates());
        secondary.add_child(exportBtn);
        secondary.add_child(importBtn);
        secondary.add_child(purgeBtn);

        const wrapper = new St.BoxLayout({ vertical: true, x_expand: true });
        wrapper.add_child(buttonContainer);
        wrapper.add_child(secondary);
        return wrapper;
    }

    _exportHistoryToDesktop() {
        try {
            const desktop = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) || GLib.get_home_dir();
            const ts = GLib.DateTime.new_now_local().format('%Y%m%d_%H%M%S');
            const path = GLib.build_filenamev([desktop, `clipflow-pro-history-${ts}.json`]);
            const serialised = this._clipboardHistory.map(item => ({
                id: item.id,
                text: item.text,
                timestampUnix: typeof item.timestampUnix === 'number' ? item.timestampUnix : item.timestamp.to_unix(),
                pinned: !!item.pinned,
                starred: !!item.starred,
                sensitive: !!item.sensitive
            }));
            const payload = JSON.stringify(serialised, null, 2);
            const ok = GLib.file_set_contents(path, payload);
            if (ok) Main.notify('ClipFlow Pro', _('Exported history to Desktop.'));
        } catch (e) {
            Main.notify('ClipFlow Pro', _('Export failed.'));
        }
    }

    _importHistoryFromDesktop() {
        try {
            const desktop = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) || GLib.get_home_dir();
            // Look for latest clipflow-pro-history*.json
            const dir = Gio.File.new_for_path(desktop);
            const enumerator = dir.enumerate_children('standard::name,standard::type,time::modified', Gio.FileQueryInfoFlags.NONE, null);
            let target = null; let latest = 0;
            for (let info = enumerator.next_file(null); info; info = enumerator.next_file(null)) {
                try {
                    const name = info.get_name();
                    if (!name.startsWith('clipflow-pro-history') || !name.endsWith('.json')) continue;
                    const mtime = info.get_attribute_uint64('time::modified');
                    if (mtime > latest) { latest = mtime; target = name; }
                } catch (_e) {}
            }
            if (!target) { Main.notify('ClipFlow Pro', _('No history file found on Desktop.')); return; }
            const path = GLib.build_filenamev([desktop, target]);
            const [ok, data] = GLib.file_get_contents(path);
            if (!ok || !data) { Main.notify('ClipFlow Pro', _('Import failed.')); return; }
            const parsed = JSON.parse(data.toString());
            if (!Array.isArray(parsed)) { Main.notify('ClipFlow Pro', _('Invalid history file.')); return; }
            // Merge unique by text (newest first)
            const seen = new Set(this._clipboardHistory.map(i => i.text));
            let added = 0;
            for (const e of parsed) {
                if (e && typeof e.text === 'string' && !seen.has(e.text)) {
                    seen.add(e.text);
                    this._addToHistory(e.text, { sensitive: !!e.sensitive });
                    added++;
                }
            }
            if (added > 0) {
                this._queueHistorySave();
                this._refreshHistory();
                Main.notify('ClipFlow Pro', _('Imported %d entries.').format(added));
            } else {
                Main.notify('ClipFlow Pro', _('Nothing to import.'));
            }
        } catch (e) {
            Main.notify('ClipFlow Pro', _('Import failed.'));
        }
    }

    _purgeDuplicates() {
        try {
            const seen = new Set();
            const before = this._clipboardHistory.length;
            const result = [];
            for (const item of this._clipboardHistory) {
                const key = item.text || '';
                if (!seen.has(key)) { seen.add(key); result.push(item); }
            }
            this._clipboardHistory = result;
            const after = result.length;
            if (after < before) {
                this._queueHistorySave();
                this._refreshHistory();
                Main.notify('ClipFlow Pro', _('Removed %d duplicates.').format(before - after));
            } else {
                Main.notify('ClipFlow Pro', _('No duplicates found.'));
            }
        } catch (_e) {
            Main.notify('ClipFlow Pro', _('Purge failed.'));
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

        // Verify clipboard has required methods
        if (typeof this._clipboard.get_text !== 'function' && typeof this._clipboard.get_content !== 'function') {
            this._logThrottled('clipboard-missing-methods', 'ClipFlow Pro: Clipboard interface missing required methods.');
            this._clipboard = null;
            this._scheduleClipboardRetry('missing-methods');
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
        // On Wayland, do this more aggressively since selection monitor is disabled
        const isWayland = Meta && typeof Meta.is_wayland_compositor === 'function' && Meta.is_wayland_compositor();
        const warmStartDelay = isWayland ? 100 : 0;
        
        this._scheduleIdle(() => {
            this._checkClipboard('warm-start');
            return GLib.SOURCE_REMOVE;
        });

        // Perform an initial check, as the owner might not change if text is already present
        // On Wayland, check sooner and more frequently - GNOME 43 Wayland needs multiple attempts
        const startupDelay = isWayland ? 100 : 500;
        this._scheduleTimeout(startupDelay, () => {
            this._checkClipboard('startup');
            return GLib.SOURCE_REMOVE;
        });
        
        // On Wayland, do additional startup checks since clipboard may not be ready immediately
        if (isWayland) {
            this._scheduleTimeout(300, () => {
                this._checkClipboard('startup-delayed');
                return GLib.SOURCE_REMOVE;
            });
            this._scheduleTimeout(600, () => {
                this._checkClipboard('startup-delayed-2');
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _obtainClipboardInterface() {
        const candidates = [];
        const isWayland = Meta && typeof Meta.is_wayland_compositor === 'function' && Meta.is_wayland_compositor();

        // For GNOME 43 Wayland, try multiple methods more aggressively
        if (St && St.Clipboard && typeof St.Clipboard.get_for_display === 'function' &&
            typeof global !== 'undefined' && global && global.display) {
            // Try this first on Wayland
            candidates.push(() => St.Clipboard.get_for_display(global.display));
        }

        if (St && St.Clipboard && typeof St.Clipboard.get_default === 'function') {
            candidates.push(() => St.Clipboard.get_default());
        }

        // Try Gtk.Clipboard as fallback (if available)
        if (Gtk && Gtk.Clipboard && typeof Gtk.Clipboard.get_default === 'function') {
            try {
                const gtkClipboard = Gtk.Clipboard.get_default(Gtk.Display.get_default());
                if (gtkClipboard && typeof gtkClipboard.wait_for_text === 'function') {
                    console.log('ClipFlow Pro: Gtk.Clipboard available as fallback');
                    // Note: Gtk.Clipboard has different API, would need adapter
                }
            } catch (_e) {
                // Gtk not available or failed
            }
        }

        // Try direct access via global.display for Wayland compatibility
        if (typeof global !== 'undefined' && global && global.display && 
            St && St.Clipboard && typeof St.Clipboard.get_for_display === 'function') {
            try {
                const clipboard = St.Clipboard.get_for_display(global.display);
                if (clipboard) {
                    // Verify it has the methods we need
                    if (typeof clipboard.get_text === 'function' || typeof clipboard.get_content === 'function') {
                        console.log('ClipFlow Pro: Obtained clipboard via get_for_display (Wayland)');
                        return clipboard;
                    }
                }
            } catch (error) {
                console.warn(`ClipFlow Pro: Failed to get clipboard via get_for_display: ${error.message}`);
            }
        }

        for (const getClipboard of candidates) {
            try {
                const clipboard = getClipboard();
                if (clipboard) {
                    // Check for either get_text or get_content
                    if (typeof clipboard.get_text === 'function' || typeof clipboard.get_content === 'function') {
                        console.log(`ClipFlow Pro: Obtained clipboard interface (Wayland: ${isWayland})`);
                        return clipboard;
                    }
                }
            } catch (error) {
                console.warn(`ClipFlow Pro: Clipboard candidate failed: ${error.message}`);
            }
        }
        
        console.error(`ClipFlow Pro: Failed to obtain clipboard interface (Wayland: ${isWayland})`);
        if (isWayland) {
            console.error('ClipFlow Pro: GNOME 43 Wayland has known clipboard API limitations. Consider using X11 session.');
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
                console.log('ClipFlow Pro: Selection monitor skipped (Wayland)');
                return;
            }

            const display = global.display;
            if (!display || typeof display.get_selection !== 'function') {
                console.warn('ClipFlow Pro: Display does not support get_selection()');
                return;
            }

            if (!Meta || !Meta.SelectionType) {
                console.warn('ClipFlow Pro: Meta.SelectionType not available');
                return;
            }

            const typeEnums = Meta.SelectionType;
            const clipboardEnum = typeEnums.CLIPBOARD ?? typeEnums.SELECTION_CLIPBOARD;
            const primaryEnum = typeEnums.PRIMARY ?? typeEnums.SELECTION_PRIMARY;
            if (clipboardEnum === undefined) {
                console.warn('ClipFlow Pro: Clipboard enum not found in Meta.SelectionType');
                return;
            }

            const selection = display.get_selection();
            if (!selection || typeof selection.connect !== 'function') {
                console.warn('ClipFlow Pro: Selection object not available or missing connect()');
                return;
            }

            if (this._selection && this._selectionOwnerChangedId) {
                this._disconnectSelectionMonitor();
            }

            this._selection = selection;
            console.log(`ClipFlow Pro: Connected to X11 selection monitor (clipboard: ${clipboardEnum}, primary: ${primaryEnum})`);
            this._selectionOwnerChangedId = selection.connect('owner-changed', (_sel, selectionType) => {
                if (!this._isMonitoring) {
                    return;
                }

                try {
                    const isClipboardChange = selectionType === clipboardEnum;
                    const isPrimaryChange = primaryEnum !== undefined && selectionType === primaryEnum;
                    if (isClipboardChange || (isPrimaryChange && this._settings.get_boolean('capture-primary'))) {
                        console.log(`ClipFlow Pro: Selection owner changed (type: ${selectionType}, clipboard: ${isClipboardChange}, primary: ${isPrimaryChange})`);
                        this._checkClipboard('selection');
                    }
                } catch (error) {
                    console.warn(`ClipFlow Pro: Error in selection owner-changed handler: ${error.message}`);
                }
            });
        } catch (error) {
            console.error(`ClipFlow Pro: Failed to connect selection monitor: ${error.message}`);
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
        try {
            this._clearClipboardRetry();
        } catch (_e) {}

        if (!this._isMonitoring) {
            return;
        }

        try {
            this._stopClipboardPolling();
        } catch (e) {
            console.warn(`ClipFlow Pro: Error stopping clipboard polling: ${e.message}`);
        }

        try {
            this._disconnectClipboardSignals();
        } catch (e) {
            console.warn(`ClipFlow Pro: Error disconnecting clipboard signals: ${e.message}`);
        }
        
        try {
            this._disconnectSelectionMonitor();
        } catch (e) {
            console.warn(`ClipFlow Pro: Error disconnecting selection monitor: ${e.message}`);
        }

        if (this._clipboardCheckTimeout > 0) {
            try {
                GLib.source_remove(this._clipboardCheckTimeout);
            } catch (_e) {}
            this._clipboardCheckTimeout = 0;
        }

        // Also clean up the old polling timeout if it exists
        if (this._clipboardTimeout) {
            try {
                GLib.source_remove(this._clipboardTimeout);
            } catch (_e) {}
            this._clipboardTimeout = null;
        }

        this._clipboard = null;
        this._isMonitoring = false;
        
        try {
            this._syncContextMenuToggles();
        } catch (_e) {}
        
        try {
            this._updateIconState();
        } catch (_e) {}
    }

    _disconnectClipboardSignals() {
        if (this._clipboardOwnerChangeId > 0 && this._clipboard) {
            this._clipboard.disconnect(this._clipboardOwnerChangeId);
        }
        this._clipboardOwnerChangeId = 0;
    }

    _startClipboardPolling() {
        this._stopClipboardPolling();

        // On Wayland, use very aggressive polling since selection monitor is disabled
        // GNOME 43 Wayland has unreliable clipboard events, so we poll every 200ms
        const isWayland = Meta && typeof Meta.is_wayland_compositor === 'function' && Meta.is_wayland_compositor();
        const baseInterval = isWayland ? 200 : this._clipboardPollIntervalMs; // 200ms for Wayland, 500ms for X11
        const interval = Math.max(200, baseInterval); // Minimum 200ms
        
        console.log(`ClipFlow Pro: Starting clipboard polling (interval: ${interval}ms, Wayland: ${isWayland})`);
        
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
        console.log('ClipFlow Pro: Clipboard owner changed (St.Clipboard signal)');
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
            console.warn('ClipFlow Pro: Clipboard is null in _checkClipboard');
            this._scheduleClipboardRetry('clipboard-null');
            return;
        }

        try {
            if (typeof this._clipboard.get_text !== 'function' ||
                typeof this._clipboard.get_content !== 'function') {
                console.warn('ClipFlow Pro: Clipboard missing required methods');
                this._scheduleClipboardRetry('missing-getters');
                return;
            }

            // Check if ClipboardType constants exist
            let clipboardType = 0; // Default CLIPBOARD
            let primaryType = 1; // Default PRIMARY
            
            if (St && St.ClipboardType) {
                clipboardType = St.ClipboardType.CLIPBOARD !== undefined ? St.ClipboardType.CLIPBOARD : 0;
                primaryType = St.ClipboardType.PRIMARY !== undefined ? St.ClipboardType.PRIMARY : 1;
            }

            this._consumeClipboardSelection(clipboardType, 'clipboard');

            if (this._settings.get_boolean('capture-primary')) {
                this._consumeClipboardSelection(primaryType, 'primary');
            }
        } catch (e) {
            // Only log error type, not message which might contain sensitive data
            const errorType = e?.name || e?.constructor?.name || 'Error';
            console.error(`ClipFlow Pro: Error checking clipboard (${source}): ${errorType} - ${e.message}`);
            this._logThrottled('clipboard-check-error', `ClipFlow Pro: Error checking clipboard: ${errorType}`);
            this._scheduleClipboardRetry('clipboard-check-error');
        }
    }

    _consumeClipboardSelection(clipboardType, sourceLabel) {
        if (!this._clipboard) {
            console.warn(`ClipFlow Pro: Clipboard is null in _consumeClipboardSelection (${sourceLabel})`);
            return;
        }

        if (!this._isMonitoring) {
            return;
        }

        const handleResult = text => {
            if (text && typeof text === 'string' && text.trim().length > 0) {
                console.log(`ClipFlow Pro: Captured text from ${sourceLabel} (${text.length} chars): ${text.substring(0, 50)}...`);
                try {
                    this._handleClipboardText(text, sourceLabel);
                } catch (error) {
                    console.error(`ClipFlow Pro: Error in _handleClipboardText: ${error.message}`);
                    console.error(`ClipFlow Pro: Stack: ${error.stack}`);
                }
            } else {
                console.log(`ClipFlow Pro: Empty text from ${sourceLabel}`);
            }
        };

        try {
            console.log(`ClipFlow Pro: Calling get_text for ${sourceLabel} (clipboardType: ${clipboardType})`);
            // Ensure callback is always called, even if get_text fails silently
            let callbackCalled = false;
            const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                if (!callbackCalled) {
                    callbackCalled = true;
                    console.warn(`ClipFlow Pro: get_text callback timeout for ${sourceLabel} (clipboardType: ${clipboardType}), using fallback`);
                    // If callback wasn't called within 1 second, try fallback
                    this._fallbackFetchClipboardText(clipboardType, sourceLabel, handleResult);
                }
                return GLib.SOURCE_REMOVE;
            });

            this._clipboard.get_text(clipboardType, (_clip, text) => {
                callbackCalled = true;
                GLib.source_remove(timeoutId);
                
                console.log(`ClipFlow Pro: get_text callback fired for ${sourceLabel} (text type: ${typeof text}, isString: ${typeof text === 'string'}, value: ${text ? (typeof text === 'string' ? text.substring(0, 30) : String(text).substring(0, 30)) : 'null'}...)`);
                
                // Handle both string and object types (X11 might return different types)
                let textValue = text;
                if (text && typeof text !== 'string') {
                    // Try to convert object to string
                    if (typeof text.toString === 'function') {
                        textValue = text.toString();
                        console.log(`ClipFlow Pro: Converted object to string via toString(): "${textValue.substring(0, 30)}..."`);
                    } else if (text.value && typeof text.value === 'string') {
                        textValue = text.value;
                        console.log(`ClipFlow Pro: Extracted string from object.value: "${textValue.substring(0, 30)}..."`);
                    } else {
                        textValue = String(text);
                        console.log(`ClipFlow Pro: Converted object to string via String(): "${textValue.substring(0, 30)}..."`);
                    }
                }
                
                if (textValue && typeof textValue === 'string' && textValue.trim().length > 0) {
                    handleResult(textValue);
                    return;
                }

                console.log(`ClipFlow Pro: get_text returned empty/null for ${sourceLabel}, trying fallback`);
                
                // If get_text provided no data, try robust fallbacks
                const isWayland = Meta && typeof Meta.is_wayland_compositor === 'function' && Meta.is_wayland_compositor();
                if (!isWayland) {
                    // On X11, try xclip first; if that yields nothing, use get_content with multiple mimetypes
                    const gotViaXclip = this._tryXclipFallback(sourceLabel, handleResult);
                    if (!gotViaXclip) {
                        this._fallbackFetchClipboardText(clipboardType, sourceLabel, handleResult);
                    }
                } else {
                    // On Wayland, go straight to get_content with multiple mimetypes
                    this._fallbackFetchClipboardText(clipboardType, sourceLabel, handleResult);
                }
            });
        } catch (error) {
            // Only log error type, not message which might contain sensitive data
            const errorType = error?.name || error?.constructor?.name || 'Error';
            console.error(`ClipFlow Pro: get_text exception for ${sourceLabel}: ${errorType} - ${error.message}`);
            this._logThrottled(`clipboard-get-text-${sourceLabel}`, `ClipFlow Pro: get_text error for ${sourceLabel}: ${errorType}`);
            this._fallbackFetchClipboardText(clipboardType, sourceLabel, handleResult);
        }
    }

    _tryXclipFallback(sourceLabel, callback) {
        // On X11, use xclip command as fallback when St.Clipboard fails
        // Returns true if content was obtained and callback invoked; false otherwise
        try {
            const now = Date.now();
            if (this._spawnInFlight || (now - this._lastSpawnTimeMs) < this._spawnGuardMs) {
                return false;
            }
            this._spawnInFlight = true;
            this._lastSpawnTimeMs = now;
            const selection = sourceLabel === 'primary' ? 'primary' : 'clipboard';
            console.log(`ClipFlow Pro: Trying xclip fallback for ${sourceLabel} (selection: ${selection})`);
            const [success, stdout, _stderr] = GLib.spawn_command_line_sync(`xclip -selection ${selection} -o`);
            this._spawnInFlight = false;
            if (success && stdout && stdout.length > 0) {
                const text = stdout.toString().trim();
                if (text && text.length > 0) {
                    console.log(`ClipFlow Pro: xclip fallback succeeded for ${sourceLabel} (${text.length} chars): "${text.substring(0, 50)}..."`);
                    callback(text);
                    return true;
                }
            }
            console.log(`ClipFlow Pro: xclip fallback yielded no data for ${sourceLabel} (success: ${success}, stdout length: ${stdout ? stdout.length : 0})`);
            // Try xsel as an additional fallback on X11-only systems
            try {
                console.log(`ClipFlow Pro: Trying xsel fallback for ${sourceLabel} (selection: ${selection})`);
                const [ok, out, _err] = GLib.spawn_command_line_sync(`xsel --${selection} -o`);
                if (ok && out && out.length > 0) {
                    const text2 = out.toString().trim();
                    if (text2 && text2.length > 0) {
                        console.log(`ClipFlow Pro: xsel fallback succeeded for ${sourceLabel} (${text2.length} chars): "${text2.substring(0, 50)}..."`);
                        callback(text2);
                        return true;
                    }
                }
                console.log(`ClipFlow Pro: xsel fallback yielded no data for ${sourceLabel}`);
            } catch (err2) {
                console.warn(`ClipFlow Pro: xsel fallback error for ${sourceLabel}: ${err2.message}`);
            }
        } catch (error) {
            this._spawnInFlight = false;
            console.warn(`ClipFlow Pro: xclip fallback error for ${sourceLabel}: ${error.message}`);
        }
        return false;
    }

    _copySanitized(text) {
        try {
            const cleaned = this._sanitizePlainText(text);
            this._copyToClipboard(cleaned, true);
        } catch (_e) {
            this._copyToClipboard(text, true);
        }
    }

    _fallbackFetchClipboardText(clipboardType, sourceLabel, callback, index = 0) {
        if (!this._clipboard) {
            console.warn(`ClipFlow Pro: Fallback failed - clipboard is null (${sourceLabel}, mimetype index: ${index})`);
            return;
        }

        if (!Array.isArray(this._textMimeTypes)) {
            return;
        }

        // Cap probing attempts by context
        let maxTries = Math.min(this._textMimeTypes.length, Math.max(1, this._maxTextMimeTries));
        if (sourceLabel === 'primary') {
            maxTries = Math.min(maxTries, 4);
        }
        if (this._isLikelyScreenshotApp()) {
            maxTries = Math.min(maxTries, 2);
        }
        if (index >= maxTries) {
            console.warn(`ClipFlow Pro: Fallback exhausted all mimetypes for ${sourceLabel}`);
            return;
        }

        const mimetype = this._textMimeTypes[index];
        console.log(`ClipFlow Pro: Trying fallback get_content for ${sourceLabel} with mimetype: ${mimetype} (index: ${index})`);
        try {
            this._clipboard.get_content(clipboardType, mimetype, (_clip, bytes) => {
                try {
                    let decoded = '';
                    const byteSize = bytes && typeof bytes.get_size === 'function' ? bytes.get_size() : 0;
                    console.log(`ClipFlow Pro: get_content returned ${byteSize} bytes for ${mimetype} (${sourceLabel})`);
                    if (bytes && byteSize > 0) {
                        decoded = this._decodeClipboardBytes(bytes, mimetype);
                        if (decoded) {
                            console.log(`ClipFlow Pro: Successfully decoded ${decoded.length} chars from ${mimetype} (${sourceLabel})`);
                            callback(decoded);
                            return;
                        }
                    }
                } catch (conversionError) {
                    console.warn(`ClipFlow Pro: Error decoding ${mimetype} (${sourceLabel}): ${conversionError.message}`);
                }

                this._fallbackFetchClipboardText(clipboardType, sourceLabel, callback, index + 1);
            });
        } catch (error) {
            console.warn(`ClipFlow Pro: get_content exception for ${mimetype} (${sourceLabel}): ${error.message}`);
            this._fallbackFetchClipboardText(clipboardType, sourceLabel, callback, index + 1);
        }
    }

    _isLikelyScreenshotApp() {
        try {
            const tracker = Shell.WindowTracker.get_default();
            const app = tracker && tracker.focus_app ? tracker.focus_app : null;
            const id = (app && (app.get_id?.() || app.get_name?.() || '')) || '';
            const nid = id.toLowerCase();
            return nid.includes('screenshot') || nid.includes('flameshot') || nid.includes('shutter') || nid.includes('ksnip');
        } catch (_e) {
            return false;
        }
    }

    _handleClipboardText(rawText, source = 'owner-change') {
        console.log(`ClipFlow Pro: _handleClipboardText called (source: ${source}, rawText type: ${typeof rawText}, length: ${rawText ? rawText.length : 0})`);
        
        const text = this._normalizeClipboardText(rawText);
        if (!text || typeof text !== 'string') {
            console.warn(`ClipFlow Pro: Text normalization failed or returned invalid type (type: ${typeof text})`);
            return;
        }

        const trimmedText = text.trim();
        if (!trimmedText || trimmedText.length === 0) {
            console.warn(`ClipFlow Pro: Text is empty after trim (original length: ${text.length})`);
            return;
        }
        
        console.log(`ClipFlow Pro: Processing text: "${trimmedText.substring(0, 50)}..." (length: ${trimmedText.length})`);


        // Quick duplicate check: skip if same as last captured text (prevents rapid duplicate captures)
        // BUT: Only do this check AFTER we've confirmed the text passed all filters in _processClipboardText
        // This prevents blocking valid entries that were filtered out previously
        const lastText = (source === 'clipboard') ? this._lastClipboardText : this._lastPrimaryText;
        if (lastText === trimmedText) {
            console.log(`ClipFlow Pro: Skipping duplicate text (same as last ${source}): "${trimmedText.substring(0, 30)}..."`);
            return;
        }

        
        // Process first, update cache only if successfully added
        // We'll update the cache in _addToHistory after confirmation
        const previousHistoryLength = this._clipboardHistory.length;
        console.log(`ClipFlow Pro: Before _processClipboardText - history length: ${previousHistoryLength}`);
        this._processClipboardText(trimmedText, source);
        const newHistoryLength = this._clipboardHistory.length;
        console.log(`ClipFlow Pro: After _processClipboardText - history length: ${newHistoryLength} (added: ${newHistoryLength > previousHistoryLength})`);
        
        // Only update cache if a new entry was actually added
        if (this._clipboardHistory.length > previousHistoryLength) {
            if (source === 'clipboard') {
                this._lastClipboardText = trimmedText;
            } else if (source === 'primary') {
                this._lastPrimaryText = trimmedText;
            }
            console.log(`ClipFlow Pro: Updated last text cache for ${source}`);
        } else {
            console.warn(`ClipFlow Pro: No entry added to history (was filtered or duplicate)`);
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
            console.log(`ClipFlow Pro: Text filtered out (sensitive content): "${cleanedText.substring(0, 30)}..."`);
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
            console.log(`ClipFlow Pro: Text filtered out (too short: ${charLength} < ${minLen}): "${cleanedText.substring(0, 30)}..."`);
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

        console.log(`ClipFlow Pro: Adding to history: "${cleanedText.substring(0, 50)}..." (length: ${cleanedText.length}, sensitive: ${isSensitive})`);
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
        register('classic-filter-all-shortcut', () => this._handleFilterShortcut('all'));
        register('classic-filter-pinned-shortcut', () => this._handleFilterShortcut('pinned'));
        register('classic-filter-starred-shortcut', () => this._handleFilterShortcut('starred'));
        register('classic-toggle-pin-top-shortcut', () => this._toggleTopItem('pin'));
        register('classic-toggle-star-top-shortcut', () => this._toggleTopItem('star'));
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
        if (!this.menu) return;
        if (this.menu.isOpen) { this.menu.close(); return; }
        this._openMainMenuWithFallback();
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
        const lengthBeforeTrim = this._clipboardHistory.length;
        console.log(`ClipFlow Pro: History now has ${lengthBeforeTrim} entries (added: "${historyItem.text.substring(0, 40)}...")`);
        this._currentPage = 0;
        this._trimHistory();
        const lengthAfterTrim = this._clipboardHistory.length;
        console.log(`ClipFlow Pro: After trim - history length: ${lengthAfterTrim} (was: ${lengthBeforeTrim})`);
        if (lengthAfterTrim < lengthBeforeTrim) {
            console.warn(`ClipFlow Pro: Entry was trimmed! Check max-entries setting (current: ${this._maxHistory})`);
        }
        this._scheduleAutoClear(historyItem);
        this._queueHistorySave();
        this._updateIconState();
        this._invalidateFilterCache();
        // Force UI refresh - use idle to ensure it happens after current operations
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._refreshHistory();
            return GLib.SOURCE_REMOVE;
        });
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
            console.warn('ClipFlow Pro: _refreshHistory called but _historyContainer is null');
            return;
        }

        this._clearHistoryContainer();
        
        const filteredHistory = this._getFilteredHistory();
        const sortedHistory = this._sortHistory(filteredHistory);
        const totalEntries = sortedHistory.length;
        console.log(`ClipFlow Pro: Refreshing history - Total: ${this._clipboardHistory.length}, Filtered: ${filteredHistory.length}, Sorted: ${sortedHistory.length}`);
        const pageSize = Math.max(1, this._entriesPerPage);
        this._setHistoryScrollHidden(totalEntries <= pageSize);
        const totalPages = totalEntries === 0 ? 0 : Math.ceil(totalEntries / pageSize);
        if (totalPages > 0 && this._currentPage > totalPages - 1) {
            this._currentPage = totalPages - 1;
        }
        if (totalPages === 0) {
            this._currentPage = 0;
        }
        
        if (totalEntries === 0) {
            const hasSearchFilter = this._searchEntry && this._getSearchText().trim();
            this._showEmptyState(hasSearchFilter);
            this._updatePaginationControls(0, 0);
            this._populateContextMenuRecentEntries();
            return;
        }

        const startIndex = this._currentPage * pageSize;
        const visibleEntries = sortedHistory.slice(startIndex, startIndex + pageSize);

        console.log(`ClipFlow Pro: Creating ${visibleEntries.length} visible entries (startIndex: ${startIndex}, pageSize: ${pageSize})`);
        console.log(`ClipFlow Pro: Container exists: ${!!this._historyContainer}, ScrollView exists: ${!!this._historyScrollView}`);
        if (this._historyContainer) {
            const childrenBefore = this._historyContainer.get_children ? this._historyContainer.get_children().length : 0;
            console.log(`ClipFlow Pro: Container children before: ${childrenBefore}`);
        }
        
        if (visibleEntries.length === 0) {
            console.warn(`ClipFlow Pro: WARNING - No visible entries to create! sortedHistory.length: ${sortedHistory.length}, startIndex: ${startIndex}, pageSize: ${pageSize}`);
        }
        
        visibleEntries.forEach((item, index) => {
            console.log(`ClipFlow Pro: Creating item ${index + 1}/${visibleEntries.length}: "${item.text.substring(0, 40)}..."`);
            this._createHistoryItem(item, startIndex + index + 1);
        });
        this._updatePaginationControls(totalEntries, totalPages);
        this._populateContextMenuRecentEntries();
        const renderedCount = this._historyContainer && this._historyContainer.get_children ? this._historyContainer.get_children().length : 0;
        console.log(`ClipFlow Pro: After creating items - renderedCount: ${renderedCount}, expected: ${visibleEntries.length}`);
        if (renderedCount !== visibleEntries.length && visibleEntries.length > 0) {
            console.error(`ClipFlow Pro: ERROR - Mismatch! Expected ${visibleEntries.length} items but only ${renderedCount} in container!`);
        }
        if (this._historyContainer) {
            const isVisible = this._historyContainer.visible !== false;
            const opacity = this._historyContainer.opacity !== undefined ? this._historyContainer.opacity : 255;
            console.log(`ClipFlow Pro: Container visibility - visible: ${isVisible}, opacity: ${opacity}`);
            if (!isVisible || opacity === 0) {
                console.error(`ClipFlow Pro: ERROR - Container is not visible!`);
            }
        }

        // Auto-fallback: if we rendered nothing in enhanced mode but have entries, switch to classic rows
        try {
            if (!this._forceClassicList && this._renderingMode === 'auto' && !this._autoFallbackApplied) {
                const hasEntries = sortedHistory.length > 0;
                const containerVisible = this._historyContainer && this._historyContainer.visible !== false && (this._historyContainer.opacity ?? 255) > 0;
                if (hasEntries && (renderedCount === 0 || !containerVisible)) {
                    this._autoFallbackApplied = true;
                    this._forceClassicList = true;
                    console.warn('ClipFlow Pro: Auto fallback to classic rows due to render mismatch');
                    this._buildMenu();
                    return;
                }
                // Deferred size check: if children height is effectively zero, fallback
                const checkId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
                    try {
                        if (this._forceClassicList || this._autoFallbackApplied) return GLib.SOURCE_REMOVE;
                        const kids = this._historyContainer?.get_children?.() || [];
                        if (kids.length > 0) {
                            const first = kids[0];
                            const box = first.get_allocation_box?.();
                            const h = box ? Math.max(0, (box.y2 - box.y1)) : (first.height ?? 0);
                            if (h <= 2) {
                                this._autoFallbackApplied = true;
                                this._forceClassicList = true;
                                console.warn('ClipFlow Pro: Auto fallback to classic rows due to zero-height items');
                                this._buildMenu();
                            }
                        }
                    } catch (_e) {}
                    return GLib.SOURCE_REMOVE;
                });
                this._deferredSourceIds?.add?.(checkId);
            }
        } catch (_e) {}

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

        // Add Reset UI mode button to quickly switch to Classic
        try {
            const resetButton = new St.Button({ label: _('Reset to Classic UI'), style_class: 'clipflow-button' });
            resetButton.add_style_class_name('clipflow-button-secondary');
            resetButton.connect('clicked', () => { try { this._settings.set_string('rendering-mode', 'classic'); this._forceClassicList = true; this._buildMenu(); } catch (_e) {} });
            wrapper.add_child(resetButton);
        } catch (_e) {}

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
            console.warn('ClipFlow Pro: _clearHistoryContainer - container is null');
            return;
        }
        const childrenBefore = this._historyContainer.get_children ? this._historyContainer.get_children().length : 0;
        console.log(`ClipFlow Pro: Clearing history container (children before: ${childrenBefore})`);
        
        const children = this._historyContainer.get_children ? [...this._historyContainer.get_children()] : [];
        children.forEach(child => {
            try {
                if (child && typeof child.destroy === 'function') {
                    child.destroy();
                }
            } catch (error) {
                console.warn(`ClipFlow Pro: Error destroying child: ${error.message}`);
            }
        });

        if (typeof this._historyContainer.remove_all_children === 'function') {
            this._historyContainer.remove_all_children();
        }
        
        const childrenAfter = this._historyContainer.get_children ? this._historyContainer.get_children().length : 0;
        console.log(`ClipFlow Pro: Container cleared (children after: ${childrenAfter})`);
    }

    _getFilteredHistory() {
        if (!this._searchEntry) {
            return this._clipboardHistory;
        }

        const searchText = this._getSearchText().toLowerCase();
        
        if (!searchText) {
            return this._clipboardHistory;
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
        this._filteredHistoryCache = filtered;
        this._lastSearchText = searchText;
        this._filterCacheValid = true;

        return filtered;
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
        try {
            if (!this._searchEntry)
                return '';
            if (typeof this._searchEntry.get_text === 'function')
                return this._searchEntry.get_text() || '';
            if (typeof this._searchEntry.text === 'string')
                return this._searchEntry.text || '';
            if (this._searchEntry.clutter_text && typeof this._searchEntry.clutter_text.get_text === 'function')
                return this._searchEntry.clutter_text.get_text() || '';
        } catch (_e) {}
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
        console.log(`ClipFlow Pro: _createHistoryItem called (displayIndex: ${displayIndex}, text: "${item.text.substring(0, 40)}...", legacy: ${this._shouldUseLegacyHistoryRows()})`);
        if (!this._historyContainer) {
            console.warn('ClipFlow Pro: _createHistoryItem - _historyContainer is null!');
            return;
        }

        if (this._classicRowsEnabled === true) {
            console.log(`ClipFlow Pro: Using classic PopupMenu rows`);
            this._createClassicPopupRow(item, displayIndex);
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
                // Defensive: ensure visible text in GNOME 43 themes
                try { textLabel.set_style('color: #f7f9ff;'); } catch (_e) {}
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
                    try { tsLabel.set_style('color: rgba(235,240,255,0.8);'); } catch (_e) {}
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
            const childrenCount = this._historyContainer.get_children ? this._historyContainer.get_children().length : 0;
            const rowVisible = row.visible !== false;
            const rowOpacity = row.opacity !== undefined ? row.opacity : 255;
            console.log(`ClipFlow Pro: History item added successfully (container now has ${childrenCount} children, row visible: ${rowVisible}, opacity: ${rowOpacity})`);
            
            // Force visibility
            if (row.visible === false) {
                row.visible = true;
                console.log(`ClipFlow Pro: Forced row visibility to true`);
            }
            if (row.opacity !== undefined && row.opacity === 0) {
                row.opacity = 255;
                console.log(`ClipFlow Pro: Forced row opacity to 255`);
            }
        } catch (error) {
            console.error(`ClipFlow Pro: Error creating history item: ${error.message}`);
            console.error(`ClipFlow Pro: Stack: ${error.stack}`);
        }
    }

    _shouldUseLegacyHistoryRows() {
        return this._useLegacyHistoryRows === true;
    }

    _createClassicPopupRow(item, displayIndex) {
        if (!this._historyContainer) {
            return;
        }

        const showNumbers = this._safeGetBoolean('show-numbers', true);
        const showPreview = this._safeGetBoolean('show-preview', true);
        const showTimestamps = this._safeGetBoolean('show-timestamps', true);

        const baseText = showPreview ? (this._safeHistoryText(item) || _('(Empty entry)')) : (item.preview || this._safeHistoryText(item) || _('(Empty entry)'));
        let labelText = baseText;
        if (showNumbers) {
            labelText = `${displayIndex}. ${labelText}`;
        }
        if (showTimestamps) {
            const ts = this._createTimestampLabel(item);
            if (ts && ts.text) {
                labelText = `${labelText}   (${ts.text})`;
            }
        }

        const mi = new PopupMenu.PopupMenuItem(labelText);
        mi.connect('activate', () => this._activateHistoryItem(item));
        // Context menu on right click
        mi.actor.connect?.('button-release-event', (_actor, event) => {
            const button = event.get_button ? event.get_button() : 0;
            if (button === 3) {
                this._openHistoryItemContextMenu(item, mi.actor);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Add to our container so pagination/search continue to work
        this._historyContainer.add_child(mi.actor);
        const childrenCount = this._historyContainer.get_children ? this._historyContainer.get_children().length : 0;
        const rowVisible = mi.actor.visible !== false;
        console.log(`ClipFlow Pro: Classic row added (container now has ${childrenCount} children, row visible: ${rowVisible})`);
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
        // Minimal actions for GNOME 43: Copy + overflow menu
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

        const copyButton = new St.Button({
            style_class: 'clipflow-action-button',
            child: new St.Icon({ icon_name: 'edit-copy-symbolic', icon_size: 14 }),
            reactive: true, can_focus: false, track_hover: true
        });
        copyButton.set_accessible_name(_('Copy this entry'));
        copyButton.connect('button-release-event', () => { this._copyToClipboard(item.text); return Clutter.EVENT_STOP; });

        const moreButton = new St.Button({
            style_class: 'clipflow-action-button',
            child: new St.Icon({ icon_name: 'open-menu-symbolic', icon_size: 14 }),
            reactive: true, can_focus: false, track_hover: true
        });
        moreButton.set_accessible_name(_('More actions'));
        moreButton.connect('button-release-event', () => { this._openHistoryItemContextMenu(item, moreButton); return Clutter.EVENT_STOP; });

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
        const childrenCount = this._historyContainer.get_children ? this._historyContainer.get_children().length : 0;
        const rowVisible = historyRow.visible !== false;
        console.log(`ClipFlow Pro: Legacy history item added (container now has ${childrenCount} children, row visible: ${rowVisible})`);
        
        // Force visibility
        if (historyRow.visible === false) {
            historyRow.visible = true;
            console.log(`ClipFlow Pro: Forced legacy row visibility to true`);
        }
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

        const cleanCopyItem = menu.addAction(_('Copy cleaned (plain text)'), () => {
            this._copySanitized(item.text || '');
        });
        this._applyContextMenuItemStyle(cleanCopyItem);

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
            if (this._copyAsPlain && typeof text === 'string') {
                text = this._sanitizePlainText(text);
            }
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

    _sanitizePlainText(text) {
        try {
            return String(text)
                // remove zero-width and control chars (except tab/newline)
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
                .replace(/\r\n/g, '\n')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        } catch (_e) {
            return text;
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

        // Wrap entire destroy in try-catch to prevent crashes
        try {
            this._stopClipboardMonitoring();
        } catch (e) {
            console.warn(`ClipFlow Pro: Error stopping clipboard monitoring: ${e.message}`);
        }

        // Disconnect panel-related listeners
        try {
            this._disconnectPanelWatchers();
        } catch (e) {
            console.warn(`ClipFlow Pro: Error disconnecting panel watchers: ${e.message}`);
        }

        if (this.menu && typeof this.menu.removeAll === 'function') {
            try {
                this.menu.removeAll();
            } catch (error) {
                console.warn(`ClipFlow Pro: Failed to clear menu: ${error.message}`);
            }
        }

        if (this._icon) {
            try {
                const parent = this._icon.get_parent();
                if (parent && typeof parent.remove_child === 'function') {
                    try {
                        parent.remove_child(this._icon);
                    } catch (_e) {}
                }
                if (typeof this._icon.destroy === 'function') {
                    this._icon.destroy();
                }
            } catch (e) {
                console.warn(`ClipFlow Pro: Error destroying icon: ${e.message}`);
            }
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
            if (this._contextMenuOpenChangedId) this._contextMenu.disconnect(this._contextMenuOpenChangedId);
            this._contextMenuOpenChangedId = 0;
            if (this._contextMenu.destroy) {
                this._contextMenu.destroy();
            }
            this._contextMenu = null;
        }
        this._contextMenuManager = null;
        this._contextMenuNotificationItem = null;
        this._contextMenuRecentSection = null;
        
        if (this._menuContainerItem) {
            // CRITICAL: Remove child before destroying St.Bin parent to avoid crash
            try {
                if (this._menuContainerBox) {
                    try {
                        if (typeof this._menuContainerItem.remove_child === 'function') {
                            this._menuContainerItem.remove_child(this._menuContainerBox);
                        } else if (this._menuContainerItem.actor && typeof this._menuContainerItem.actor.remove_child === 'function') {
                            this._menuContainerItem.actor.remove_child(this._menuContainerBox);
                        }
                        if (typeof this._menuContainerBox.destroy === 'function') {
                            this._menuContainerBox.destroy();
                        }
                    } catch (e) {
                        console.warn(`ClipFlow Pro: Error removing menu container box: ${e.message}`);
                    }
                    this._menuContainerBox = null;
                }
                if (typeof this._menuContainerItem.destroy === 'function') {
                    this._menuContainerItem.destroy();
                }
            } catch (e) {
                console.warn(`ClipFlow Pro: Error destroying menu container item: ${e.message}`);
            }
            this._menuContainerItem = null;
        }
        
        try {
            this._clearHistoryContainer();
        } catch (_e) {}
        
        try {
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
        } catch (e) {
            console.warn(`ClipFlow Pro: Error destroying UI actors: ${e.message}`);
        }
        
        try {
            this._unregisterKeybindings();
        } catch (e) {
            console.warn(`ClipFlow Pro: Error unregistering keybindings: ${e.message}`);
        }
        
        try {
            this._clearAllAutoClearTimers();
        } catch (_e) {}
        
        try {
            this._cancelHistorySaveTimeout();
        } catch (_e) {}

        // Clean up monitoring resume timeout
        if (this._monitoringResumeTimeoutId) {
            try {
                GLib.source_remove(this._monitoringResumeTimeoutId);
            } catch (_e) {}
            this._monitoringResumeTimeoutId = 0;
        }
        
        // Clean up search debounce
        if (this._searchDebounceTimeout) {
            try {
                GLib.source_remove(this._searchDebounceTimeout);
            } catch (_e) {}
            this._searchDebounceTimeout = 0;
        }

        try {
            const shouldClearHistory = this._settings && this._settings.get_boolean('clear-on-logout') && !this._skipCleanupOnDestroy;
            if (shouldClearHistory) {
                this._clearHistoryStorage();
            } else {
                this._flushHistorySave();
            }
        } catch (e) {
            console.warn(`ClipFlow Pro: Error saving history: ${e.message}`);
        }

        // Disconnect settings
        if (this._settings && this._settingsSignalIds && this._settingsSignalIds.length > 0) {
            this._settingsSignalIds.forEach(id => this._settings.disconnect(id));
            this._settingsSignalIds = [];
        }
        
        // Clear pointers
        this._lastClipboardText = '';
        this._skipCleanupOnDestroy = false;
        
        try {
            this._clearDeferredSources();
        } catch (_e) {}
        
        try {
            if (typeof super.destroy === 'function') {
                super.destroy();
            }
        } catch (e) {
            console.warn(`ClipFlow Pro: Error in super.destroy(): ${e.message}`);
        }
    }
});

let _indicator = null;
let _settings = null;
let _panelPositionChangedId = 0;
let _pendingAttachIdleId = 0;

function _clearPendingAttachIdle() {
    if (_pendingAttachIdleId) {
        GLib.source_remove(_pendingAttachIdleId);
        _pendingAttachIdleId = 0;
    }
}

function _disconnectPanelPositionWatcher() {
    if (_settings && _panelPositionChangedId) {
        try {
            _settings.disconnect(_panelPositionChangedId);
        } catch (_e) {}
        _panelPositionChangedId = 0;
    }
}

function _destroyIndicator() {
    if (!_indicator) {
        return;
    }
    
    // Check if already destroyed
    if (_indicator._destroyed) {
        console.log('ClipFlow Pro: Indicator already destroyed');
        _indicator = null;
        return;
    }
    
    try {
        // Try to get parent and remove first
        if (typeof _indicator.get_parent === 'function') {
            const parent = _indicator.get_parent();
            if (parent && typeof parent.remove_child === 'function') {
                try {
                    parent.remove_child(_indicator);
                } catch (_e) {
                    // Ignore removal errors
                }
            }
        }
        
        // Now destroy
        if (typeof _indicator.destroy === 'function') {
            _indicator.destroy();
        }
    } catch (e) {
        console.error(`ClipFlow Pro: Error destroying indicator: ${e.message}`);
        console.error(`ClipFlow Pro: Stack: ${e.stack}`);
    } finally {
        _indicator = null;
    }
}

function _normalizePanelPosition(position) {
    const validPositions = new Set(['left', 'center', 'right']);
    if (typeof position === 'string' && validPositions.has(position)) {
        return position;
    }

    console.warn(`ClipFlow Pro: Invalid panel-position '${position}', defaulting to 'right'.`);
    if (_settings) {
        _settings.set_string('panel-position', 'right');
    }
    return 'right';
}

function _attachIndicatorWithFallback(preferred) {
    try {
        _clearPendingAttachIdle();
        const positions = ['right', 'center', 'left'];
        const startIndex = Math.max(0, positions.indexOf(preferred));
        const ordered = [...positions.slice(startIndex), ...positions.slice(0, startIndex)];

        for (const pos of ordered) {
            try {
                Main.panel.addToStatusArea('clipflow-pro', _indicator, 1, pos);
                // Give Shell a tick to attach
                let idleId = 0;
                idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    _pendingAttachIdleId = 0;
                    try {
                        const indicator = _indicator;
                        if (!indicator) {
                            return GLib.SOURCE_REMOVE;
                        }
                        const hasParent = Boolean(indicator.get_parent?.() || indicator.actor?.get_parent?.());
                        if (!hasParent && indicator._createIcon) {
                            indicator._createIcon();
                        }
                    } catch (_e) {}
                    return GLib.SOURCE_REMOVE;
                });
                _pendingAttachIdleId = idleId;
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

function _relocateIndicator() {
    const newPosition = _normalizePanelPosition(_settings ? _settings.get_string('panel-position') : 'right');
    _clearPendingAttachIdle();
    if (_indicator) {
        if (typeof _indicator.prepareForReposition === 'function') {
            _indicator.prepareForReposition();
        }
        _destroyIndicator();
    }

    _indicator = new ClipFlowIndicator(_settings);
    _attachIndicatorWithFallback(newPosition);
}

function init() {
    // GNOME Shell calls init() when loading the extension
    // No-op: initialization happens in enable()
}

function enable() {
    try {
        _clearPendingAttachIdle();
        _disconnectPanelPositionWatcher();
        _destroyIndicator();

        _settings = ExtensionUtils.getSettings();
        if (!_settings)
            throw new Error('Settings schema not found.');

        const panelPosition = _normalizePanelPosition(_settings.get_string('panel-position'));
        _indicator = new ClipFlowIndicator(_settings);
        _attachIndicatorWithFallback(panelPosition);

        _panelPositionChangedId = _settings.connect('changed::panel-position', () => {
            _relocateIndicator();
        });

        // Avoid any heavy process spawning during enable to reduce crash surface

    } catch (e) {
        throw e;
    }
}

function disable() {
    console.log('ClipFlow Pro: disable() called');
    
    try {
        _clearPendingAttachIdle();
    } catch (e) {
        console.warn(`ClipFlow Pro: Error clearing pending attach idle: ${e.message}`);
    }
    
    try {
        _disconnectPanelPositionWatcher();
    } catch (e) {
        console.warn(`ClipFlow Pro: Error disconnecting panel position watcher: ${e.message}`);
    }
    
    // CRITICAL: Check if indicator exists and is not already destroyed
    if (_indicator) {
        try {
            // Check if already destroyed
            if (_indicator._destroyed) {
                console.log('ClipFlow Pro: Indicator already destroyed, skipping');
                _indicator = null;
            } else {
                _destroyIndicator();
            }
        } catch (e) {
            console.error(`ClipFlow Pro: CRITICAL ERROR destroying indicator: ${e.message}`);
            console.error(`ClipFlow Pro: Stack: ${e.stack}`);
            // Force null to prevent further issues
            _indicator = null;
        }
    } else {
        console.log('ClipFlow Pro: No indicator to destroy');
    }
    
    _settings = null;
    console.log('ClipFlow Pro: disable() completed');
}
