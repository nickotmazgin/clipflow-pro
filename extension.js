'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, GObject, GLib, Gio, Clutter, Meta, Shell} = imports.gi;
let Gtk = null;
try {
    Gtk = imports.gi.Gtk;
} catch (_err) {
    Gtk = null;
}
const ByteArray = imports.byteArray;

// Get extension metadata
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;


const ClipFlowClipboardEntry = class {
    constructor(text, type = 'generic') {
        this.text = text;
        this.type = type;
    }
};

var ClipFlowIndicator = GObject.registerClass(
class ClipFlowIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'ClipFlow Pro');
        
        // Initialize settings
        this._settings = ExtensionUtils.getSettings();
        this._contextMenuManager = null;
        this._contextMenu = null;
        this._contextMenuNotificationItem = null;
        this._contextMenuMonitoringItem = null;
        this._contextMenuRecentSection = null;
        this._contextMenuRecentLimit = this._settings.get_int('context-menu-items');
        this._contextMenuOpenChangedId = 0;
        this._menuOpenChangedId = 0;
        this._buttonPressId = 0;
        this._popupMenuId = 0;
        this._menuContainerItem = null;
        this._menuContainerBox = null;
        this._keybindingHandlers = new Set();
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
        
        // Initialize clipboard history
        this._clipboardHistory = [];
        this._maxHistory = this._settings.get_int('max-entries');
        this._entriesPerPage = Math.max(1, this._settings.get_int('entries-per-page'));
        this._isMonitoring = false;
        this._clipboard = null;
        this._clipboardOwnerChangeId = 0;
        this._clipboardCheckTimeout = 0;
        this._clipboardTimeout = null; // Retained for cleanup during transitions
        this._clipboardPollId = 0;
        this._clipboardPollIntervalMs = 750;
        this._lastClipboardText = '';
        this._settingsSignalIds = [];
        this._searchDebounceTimeout = 0;
        
        // Connect to settings changes
        this._settingsSignalIds.push(this._settings.connect('changed::max-entries', () => {
            this._maxHistory = this._settings.get_int('max-entries');
            this._trimHistory();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::show-copy-notifications', () => {
            this._syncContextMenuToggles();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::entries-per-page', () => {
            this._entriesPerPage = Math.max(1, this._settings.get_int('entries-per-page'));
            this._currentPage = 0;
            this._refreshHistory();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::auto-clear-sensitive', () => {
            this._updateAutoClearTimers();
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::enable-debug-logs', () => {
            this._logEnabled = this._settings.get_boolean('enable-debug-logs');
            this._debugLog('Debug logging toggled');
        }));
        this._settingsSignalIds.push(this._settings.connect('changed::context-menu-items', () => {
            this._contextMenuRecentLimit = this._settings.get_int('context-menu-items');
            this._populateContextMenuRecentEntries();
        }));
        this._logEnabled = this._settings.get_boolean('enable-debug-logs');
        ['show-menu-shortcut', 'enhanced-copy-shortcut', 'enhanced-paste-shortcut'].forEach(key => {
            this._settingsSignalIds.push(this._settings.connect(`changed::${key}`, () => {
                this._registerKeybindings();
            }));
        });
        
        this._createIcon();
        this._buildContextMenu();
        this._loadHistoryFromDisk();
        this._buildMenu();
        this._startClipboardMonitoring();
        this._registerKeybindings();
        
        this._buttonPressId = this.connect('button-press-event', this._onButtonPressEvent.bind(this));
        this._popupMenuId = this.connect('popup-menu', this._onPopupMenu.bind(this));
    }

    _addIndicatorIcon() {
        const iconFile = Me.dir.get_child('icons').get_child('clipflow-pro-symbolic.svg');
        const props = {
            style_class: 'system-status-icon clipflow-pro-panel-icon'
        };

        if (iconFile && iconFile.query_exists(null)) {
            try {
                props.gicon = new Gio.FileIcon({ file: iconFile });
            } catch (error) {
                log(`ClipFlow Pro: Failed to create panel icon from file: ${error}`);
            }
        }

        if (!props.gicon) {
            props.icon_name = 'edit-paste-symbolic';
        }

        const icon = new St.Icon(props);
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
    
    _updateIconState() {
        if (!this._icon) return;
        
        const hasEntries = this._clipboardHistory.length > 0;
        const isMonitoring = this._isMonitoring;
        
        if (!isMonitoring && hasEntries) {
            this._icon.opacity = 160;
            this._icon.set_style('opacity: 160;');
        } else {
            this._icon.opacity = 255;
            this._icon.set_style('');
        }
    }

    _ensureIconThemeRegistered() {
        try {
            if (!this._iconThemeRegistered) {
                const iconsDir = Me.dir.get_child('icons');
                if (iconsDir && iconsDir.query_exists(null) && Gtk && Gtk.IconTheme) {
                    const theme = Gtk.IconTheme.get_default();
                    if (theme && typeof theme.add_search_path === 'function') {
                        theme.add_search_path(iconsDir.get_path());
                    }
                }
                this._iconThemeRegistered = true;
            }
        } catch (error) {
            log(`ClipFlow Pro: Failed to register icon theme path: ${error}`);
        }
    }

    _debugLog(message) {
        if (!this._logEnabled) {
            return;
        }
        log(`[ClipFlow Pro] ${message}`);
    }

    _buildMenu() {
        // Clear existing menu
        this.menu.removeAll();
        
        // Header
        const header = new PopupMenu.PopupMenuItem('📋 ClipFlow Pro', {
            reactive: false,
            can_focus: false
        });
        // Use .actor for GNOME 42 compatibility; newer Shell supports direct style on item
        header.actor.add_style_class_name('clipflow-header');
        this.menu.addMenuItem(header);
        
        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._searchSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._searchSection);
        
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
        this._menuContainerItem.actor.add_child(container);
        this._menuContainerItem.actor.x_expand = true;
        this._menuContainerItem.actor.y_expand = true;
        this.menu.addMenuItem(this._menuContainerItem);
        this._menuContainerBox = container;

        const searchRow = this._createSearchRow();
        container.add_child(searchRow);

        // History container and pagination
        this._historyScrollView = new St.ScrollView({
            style_class: 'clipflow-history-scroll',
            overlay_scrollbars: false,
            x_expand: true,
            y_expand: true
        });

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
        container.add_child(paginationRow);

        const actionRow = this._createActionButtons();
        container.add_child(actionRow);

        // Load initial history
        this._refreshHistory();
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
        this._contextMenu.actor.add_style_class_name('clipflow-context-menu');
        Main.uiGroup.add_actor(this._contextMenu.actor);
        this._contextMenu.actor.hide();
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

        this._contextMenuMonitoringItem = new PopupMenu.PopupSwitchMenuItem(
            _('Clipboard Monitoring'),
            this._isMonitoring
        );
        this._applyContextMenuItemStyle(this._contextMenuMonitoringItem);
        this._contextMenuMonitoringItem.connect('toggled', (_item, state) => {
            if (state) {
                this._startClipboardMonitoring();
            } else {
                this._stopClipboardMonitoring();
            }
        });
        this._contextMenu.addMenuItem(this._contextMenuMonitoringItem);

        this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const recentHeader = new PopupMenu.PopupMenuItem(_('Recent Clips'), {
            reactive: false,
            can_focus: false
        });
        recentHeader.setSensitive(false);
        recentHeader.actor.add_style_class_name('clipflow-context-header');
        this._contextMenu.addMenuItem(recentHeader);

        this._contextMenuRecentSection = new PopupMenu.PopupMenuSection();
        this._contextMenu.addMenuItem(this._contextMenuRecentSection);

        this._contextMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const openClipboardItem = this._contextMenu.addAction(_('Open Clipboard Menu'), () => {
            this._contextMenu.close();
            this.menu.open(true);
        });
        this._applyContextMenuItemStyle(openClipboardItem);

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
        if (this._contextMenuMonitoringItem && typeof this._contextMenuMonitoringItem.setToggleState === 'function') {
            this._contextMenuMonitoringItem.setToggleState(this._isMonitoring);
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
        this._debugLog(`Context menu recent list updated (${recentEntries.length} items)`);
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
        if (display.length > maxLength) {
            display = `${display.substring(0, maxLength - 3)}...`;
        }
        return `${index + 1}. ${display || _('(Empty entry)')}`;
    }

    _applyContextMenuItemStyle(menuItem) {
        if (!menuItem) {
            return;
        }

        try {
            if (typeof menuItem.add_style_class_name === 'function') {
                menuItem.add_style_class_name('clipflow-context-item');
                return;
            }

            if (menuItem.actor && typeof menuItem.actor.add_style_class_name === 'function') {
                menuItem.actor.add_style_class_name('clipflow-context-item');
            }
        } catch (error) {
            this._debugLog(`Context menu styling failed: ${error}`);
        }
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
            hint_text: 'Search clipboard history...',
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
        if (typeof buttonContainer.set_spacing === 'function') {
            buttonContainer.set_spacing(8);
        } else if (typeof buttonContainer.get_layout_manager === 'function') {
            const layout = buttonContainer.get_layout_manager();
            if (layout && 'spacing' in layout)
                layout.spacing = 8;
        }
        buttonContainer.add_style_class_name('clipflow-action-container');
        
        // Clear button
        const clearButton = new St.Button({
            label: '🗑️ Clear All',
            style_class: 'clipflow-button',
            x_expand: true
        });
        clearButton.connect('clicked', () => {
            this._clearAllHistory();
        });
        buttonContainer.add_child(clearButton);
        
        // Settings button
        const settingsButton = new St.Button({
            label: '⚙️ Settings',
            style_class: 'clipflow-button',
            x_expand: true
        });
        settingsButton.connect('clicked', () => {
            this._openSettings();
        });
        buttonContainer.add_child(settingsButton);
        buttonContainer.set_margin_top(6);
        return buttonContainer;
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
        this._paginationPrevButton.connect('clicked', () => {
            this._changePage(-1);
        });

        this._paginationNextButton = new St.Button({
            label: _('Next'),
            style_class: buttonStyle
        });
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
                GLib.mkdir_with_parents(this._storageDir, 0o700);
            }
            // Ensure directory permissions are secure (user-only access)
            const file = Gio.File.new_for_path(this._storageDir);
            if (file.query_exists(null)) {
                file.set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
            }
        } catch (error) {
            log(`ClipFlow Pro: Failed to ensure storage directory: ${error}`);
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

            const raw = ByteArray.toString(contents);
            if (!raw) {
                this._clipboardHistory = [];
                return;
            }

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                this._clipboardHistory = [];
                return;
            }

            const loaded = parsed
                .map(entry => {
                    try {
                        const text = typeof entry.text === 'string' ? entry.text : '';
                        if (!text.trim()) {
                            return null;
                        }

                        const timestampUnix = typeof entry.timestampUnix === 'number'
                            ? entry.timestampUnix
                            : (entry.timestamp ? Number(entry.timestamp) : Date.now() / 1000);
                        const timestamp = GLib.DateTime.new_from_unix_local(timestampUnix) || GLib.DateTime.new_now_local();

                        return {
                            text,
                            timestamp,
                            timestampUnix,
                            preview: text.length > 80 ? `${text.substring(0, 80)}...` : text,
                            id: entry.id || GLib.uuid_string_random(),
                            pinned: Boolean(entry.pinned),
                            starred: Boolean(entry.starred),
                            length: text.length,
                            sensitive: Boolean(entry.sensitive)
                        };
                    } catch (error) {
                        log(`ClipFlow Pro: Failed to parse history entry: ${error}`);
                        return null;
                    }
                })
                .filter(Boolean);

            this._clipboardHistory = loaded;
            this._trimHistory(true);
            this._currentPage = 0;
            this._updateAutoClearTimers();
            this._debugLog(`Loaded ${this._clipboardHistory.length} history entries from disk`);
        } catch (error) {
            log(`ClipFlow Pro: Failed to load history: ${error}`);
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
            this._ensureStorageDir();
            const serialised = this._clipboardHistory.map(item => ({
                id: item.id,
                text: item.text,
                timestampUnix: typeof item.timestampUnix === 'number' ? item.timestampUnix : item.timestamp.to_unix(),
                pinned: Boolean(item.pinned),
                starred: Boolean(item.starred),
                sensitive: Boolean(item.sensitive)
            }));

            const payload = JSON.stringify(serialised);
            GLib.file_set_contents(this._historyFile, payload, payload.length);
            
            // Set secure file permissions (user read/write only, mode 0600)
            const file = Gio.File.new_for_path(this._historyFile);
            if (file.query_exists(null)) {
                file.set_attribute_uint32('unix::mode', 0o600, Gio.FileQueryInfoFlags.NONE, null);
            }
        } catch (error) {
            log(`ClipFlow Pro: Failed to save history: ${error}`);
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
            log(`ClipFlow Pro: Failed to clear history storage: ${error}`);
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
        if (refresh) {
            this._populateContextMenuRecentEntries();
            this._refreshHistory();
        }
        this._queueHistorySave();
    }
    _startClipboardMonitoring() {
        if (this._isMonitoring) {
            this._debugLog('Clipboard monitoring already active, skipping start');
            return;
        }

        this._clipboard = this._obtainClipboardInterface();
        if (!this._clipboard) {
            log('ClipFlow Pro: Clipboard interface unavailable – monitoring disabled.');
            this._debugLog('FAILED to obtain clipboard interface');
            this._syncContextMenuToggles();
            return;
        }

        this._isMonitoring = true;
        this._debugLog('Starting clipboard monitoring.');

        this._connectClipboardSignals();
        this._startClipboardPolling();
        this._syncContextMenuToggles();
        this._updateIconState();
        
        // Perform an initial check, as the owner might not change if text is already present
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._checkClipboard('startup');
            return GLib.SOURCE_REMOVE;
        });
        
        this._debugLog('Clipboard monitoring started successfully');
    }

    _obtainClipboardInterface() {
        const candidates = [];

        if (St && St.Clipboard && typeof St.Clipboard.get_default === 'function') {
            this._debugLog('Adding St.Clipboard.get_default() candidate');
            candidates.push(() => St.Clipboard.get_default());
        }

        if (St && St.Clipboard && typeof St.Clipboard.get_for_display === 'function' &&
            typeof global !== 'undefined' && global && global.display) {
            this._debugLog('Adding St.Clipboard.get_for_display() candidate');
            candidates.push(() => St.Clipboard.get_for_display(global.display));
        }

        this._debugLog(`Trying ${candidates.length} clipboard interface candidates`);
        for (const getClipboard of candidates) {
            try {
                const clipboard = getClipboard();
                if (clipboard) {
                    this._debugLog('Successfully obtained clipboard interface');
                    return clipboard;
                }
            } catch (error) {
                this._debugLog(`Clipboard candidate failed: ${error.message}`);
            }
        }

        this._debugLog('Failed to obtain clipboard interface - all candidates failed');
        return null;
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
                    this._debugLog(`Listening for clipboard changes via '${signal}' signal.`);
                    return;
                }
            } catch (error) {
                this._debugLog(`Clipboard signal '${signal}' unavailable: ${error.message}`);
            }
        }

        this._debugLog('Falling back to poll-only clipboard monitoring (no clipboard signals available).');
    }

    _stopClipboardMonitoring() {
        if (!this._isMonitoring) {
            return;
        }

        this._debugLog('Stopping clipboard monitoring.');

        this._stopClipboardPolling();

        this._disconnectClipboardSignals();

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
        if (this._clipboardOwnerChangeId > 0 && this._clipboard && typeof this._clipboard.disconnect === 'function') {
            try {
                this._clipboard.disconnect(this._clipboardOwnerChangeId);
            } catch (error) {
                log(`ClipFlow Pro: Error disconnecting clipboard signal: ${error.message}`);
            }
        }
        this._clipboardOwnerChangeId = 0;
    }

    _startClipboardPolling() {
        this._stopClipboardPolling();

        const interval = Math.max(250, this._clipboardPollIntervalMs);
        this._debugLog(`Starting clipboard fallback polling (${interval}ms).`);
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
            this._debugLog('Stopped clipboard fallback polling.');
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
        if (!this._isMonitoring || !this._clipboard) {
            this._debugLog(`Clipboard check skipped - monitoring: ${this._isMonitoring}, clipboard: ${this._clipboard ? 'present' : 'null'}`);
            return;
        }

        try {
            if (typeof this._clipboard.get_text !== 'function') {
                this._debugLog('Clipboard.get_text is not a function');
                return;
            }
            
            this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clip, text) => {
                this._debugLog(`Clipboard callback fired with text length: ${text ? text.length : 'null'}`);
                if (text) {
                    this._handleClipboardText(text, source);
                } else {
                    this._debugLog('Clipboard callback received null/undefined text');
                }
            });
        } catch (e) {
            this._debugLog(`Error checking clipboard: ${e.message}`);
            log(`ClipFlow Pro: Error checking clipboard: ${e.message}`);
        }
    }

    _handleClipboardText(text, source = 'owner-change') {
        if (!text) {
            this._debugLog('Received empty clipboard text');
            return;
        }

        const trimmedText = text.trim();
        if (!trimmedText) {
            this._debugLog('Clipboard text is empty after trimming');
            return;
        }

        this._debugLog(`Received clipboard text (${trimmedText.length} chars) via ${source}`);
        // The _processClipboardText method already handles duplicate checks.
        // Relying on it simplifies the logic and avoids race conditions between
        // the signal-based and polling-based clipboard listeners.
        this._processClipboardText(trimmedText, 'clipboard');
    }

    _processClipboardText(text, source = 'clipboard') {
        if (!text) {
            this._debugLog('Process clipboard: empty text');
            return;
        }

        const cleanedText = text.trim();
        if (!cleanedText) {
            this._debugLog('Process clipboard: text empty after trim');
            return;
        }

        const isSensitive = this._isSensitiveContent(cleanedText);
        if (isSensitive && this._settings.get_boolean('ignore-passwords')) {
            this._debugLog('Process clipboard: ignoring sensitive content');
            return;
        }

        if (this._isDuplicate(cleanedText)) {
            this._debugLog(`Process clipboard: ignoring duplicate text (${cleanedText.substring(0, 20)}...)`);
            return;
        }

        this._debugLog(`Process clipboard: adding to history - "${cleanedText.substring(0, 50)}..."`);
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
            log(`ClipFlow Pro: Unable to determine action mode mask: ${error}`);
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
                    log(`ClipFlow Pro: Keybinding ${name} handler failed: ${error}`);
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
                log(`ClipFlow Pro: Failed to register keybinding ${name} via Main.wm: ${error}`);
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
                log(`ClipFlow Pro: Failed to register keybinding ${name} via global.display: ${error}`);
            }
        };

        register('show-menu-shortcut', this._handleShowMenuShortcut.bind(this));
        register('enhanced-copy-shortcut', this._handleEnhancedCopyShortcut.bind(this));
        register('enhanced-paste-shortcut', this._handleEnhancedPasteShortcut.bind(this));
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
                log(`ClipFlow Pro: Failed to remove keybinding ${name}: ${error}`);
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
            log(`ClipFlow Pro: Enhanced copy shortcut failed: ${error}`);
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
            log(`ClipFlow Pro: Enhanced paste shortcut failed: ${error}`);
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

    _isDuplicate(text) {
        return this._clipboardHistory.some(item => item.text === text);
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
        if (text.length > maxLength) {
            text = text.substring(0, maxLength);
        }
        
        const timestamp = GLib.DateTime.new_now_local();
        const timestampUnix = timestamp.to_unix();
        const contentType = this._detectContentType(text);
        const historyItem = {
            text: text,
            timestamp: timestamp,
            timestampUnix,
            preview: text.length > 80 ? text.substring(0, 80) + '...' : text,
            id: GLib.uuid_string_random(), // Add unique ID for better tracking
            pinned: false,
            starred: false,
            length: text.length,
            sensitive: Boolean(options.sensitive),
            contentType: contentType
        };
        
        this._clipboardHistory.unshift(historyItem);
        this._currentPage = 0;
        this._trimHistory();
        this._scheduleAutoClear(historyItem);
        this._queueHistorySave();
        this._updateIconState();
        this._debugLog(`Added history item (length now ${this._clipboardHistory.length})`);
        this._refreshHistory();
    }

    _addEntry(entry) {
        if (!entry || typeof entry.text !== 'string') {
            return;
        }
        const text = entry.text.trim();
        if (!text) {
            return;
        }
        this._addToHistory(text, { sensitive: false });
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

        if (modified && !skipSave) {
            this._queueHistorySave();
        }
    }

    _refreshHistory() {
        if (!this._historyContainer) {
            return;
        }

        this._clearHistoryContainer();
        
        const filteredHistory = this._getFilteredHistory();
        const sortedHistory = this._sortHistory(filteredHistory);
        const totalEntries = sortedHistory.length;
        const pageSize = Math.max(1, this._entriesPerPage);
        const totalPages = totalEntries === 0 ? 0 : Math.ceil(totalEntries / pageSize);
        if (totalPages > 0 && this._currentPage > totalPages - 1) {
            this._currentPage = totalPages - 1;
        }
        if (totalPages === 0) {
            this._currentPage = 0;
        }
        
        if (totalEntries === 0) {
            const emptyText = this._searchEntry && this._searchEntry.get_text().trim() 
                ? 'No matching entries found'
                : 'No clipboard history yet\nCopy some text to get started!';
            const emptyItem = new St.Label({
                text: emptyText,
                style_class: 'clipflow-empty'
            });
            this._historyContainer.add_child(emptyItem);
            this._updatePaginationControls(0, 0);
            this._populateContextMenuRecentEntries();
            this._debugLog('History view empty');
            return;
        }

        const startIndex = this._currentPage * pageSize;
        const visibleEntries = sortedHistory.slice(startIndex, startIndex + pageSize);

        visibleEntries.forEach((item, index) => {
            this._createHistoryItem(item, startIndex + index + 1);
        });
        this._updatePaginationControls(totalEntries, totalPages);
        this._populateContextMenuRecentEntries();
        const renderedCount = this._historyContainer && this._historyContainer.get_children ? this._historyContainer.get_children().length : visibleEntries.length;
        this._debugLog(`Rendered ${renderedCount} entries (page ${this._currentPage + 1}/${totalPages}, filtered: ${filteredHistory.length} of ${this._clipboardHistory.length} total)`);
    }

    _clearHistoryContainer() {
        if (!this._historyContainer) {
            return;
        }

        if (typeof this._historyContainer.remove_all_children === 'function') {
            this._historyContainer.remove_all_children();
            return;
        }

        if (typeof this._historyContainer.destroy_all_children === 'function') {
            this._historyContainer.destroy_all_children();
            return;
        }

        const children = this._historyContainer.get_children ? this._historyContainer.get_children() : [];
        if (children && Array.isArray(children)) {
            children.forEach(child => child.destroy());
        }
    }

    _getFilteredHistory() {
        if (!this._searchEntry) {
            return this._clipboardHistory;
        }

        const searchText = this._searchEntry.get_text().toLowerCase();
        
        if (!searchText) {
            return this._clipboardHistory;
        }
        
        return this._clipboardHistory.filter(item => 
            item.text.toLowerCase().includes(searchText)
        );
    }

    _filterHistory() {
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
            const aTime = typeof a.timestampUnix === 'number' ? a.timestampUnix : a.timestamp.to_unix();
            const bTime = typeof b.timestampUnix === 'number' ? b.timestampUnix : b.timestamp.to_unix();
            return bTime - aTime;
        });
    }

    _createHistoryItem(item, displayIndex) {
        const historyRow = new St.BoxLayout({
            vertical: false,
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: 'clipflow-history-item',
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true
        });

        historyRow.set_accessible_name(item.preview);

        // Add content type styling
        if (item.contentType) {
            historyRow.set_data('type', item.contentType);
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

        if (this._settings.get_boolean('show-preview')) {
            const textLabel = new St.Label({
                text: item.preview,
                style_class: 'clipflow-history-text',
                x_expand: true
            });
            textLabel.clutter_text.set_line_wrap(true);
            contentBox.add_child(textLabel);
        }

        if (this._settings.get_boolean('show-timestamps')) {
            const characterCount = typeof item.length === 'number' ? item.length : item.text.length;
            const dateLabel = item.timestamp.format('%m/%d %H:%M');
            
            const metaLabel = new St.Label({
                text: `${dateLabel} • ${characterCount} chars`,
                style_class: 'clipflow-history-meta',
                tooltip_text: `${item.timestamp.format('%Y-%m-%d %H:%M:%S')} • ${characterCount} characters`
            });
            contentBox.add_child(metaLabel);
        }

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

        const pinButton = new St.Button({
            style_class: 'clipflow-action-button pin',
            child: new St.Icon({
                icon_name: 'emblem-important-symbolic',
                icon_size: 14
            }),
            reactive: true,
            can_focus: false,
            track_hover: true
        });

        const starButton = new St.Button({
            style_class: 'clipflow-action-button star',
            child: new St.Icon({
                icon_name: 'emblem-favorite-symbolic',
                icon_size: 14
            }),
            reactive: true,
            can_focus: false,
            track_hover: true
        });

        if (item.pinned) {
            pinButton.add_style_class_name('active');
        }

        if (item.starred) {
            starButton.add_style_class_name('active');
        }

        pinButton.set_accessible_name(item.pinned ? _('Unpin this entry') : _('Pin this entry'));
        starButton.set_accessible_name(item.starred ? _('Unstar this entry') : _('Star this entry'));

        pinButton.connect('button-release-event', (_actor, event) => {
            this._togglePinItem(item.id);
            return Clutter.EVENT_STOP;
        });

        starButton.connect('button-release-event', (_actor, event) => {
            this._toggleStarItem(item.id);
            return Clutter.EVENT_STOP;
        });

        actionBox.add_child(pinButton);
        actionBox.add_child(starButton);

        historyRow.add_child(contentBox);
        historyRow.add_child(actionBox);

        historyRow.connect('button-release-event', (_actor, event) => {
            const button = event.get_button();
            if (button === 1) { // Left-click
                this._copyToClipboard(item.text);
                this.menu.close();
                return Clutter.EVENT_STOP;
            } else if (button === 3) { // Right-click
                this._openHistoryItemContextMenu(item, historyRow);
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });

        historyRow.connect('key-press-event', (_actor, event) => {
            const key = event.get_key_symbol();
            if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter || key === Clutter.KEY_space) {
                this._copyToClipboard(item.text);
                this.menu.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this._historyContainer.add_child(historyRow);
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
        Main.uiGroup.add_actor(menu.actor);
        menu.actor.hide();

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
        try {
            const clipboard = St.Clipboard.get_default();
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
            clipboard.set_text(St.ClipboardType.PRIMARY, text);
            const cached = typeof text === 'string' ? text.trim() : '';
            this._lastClipboardText = cached;
            if (showToast && this._settings.get_boolean('show-copy-notifications')) {
                Main.notify('ClipFlow Pro', _('Text copied to clipboard'));
            }
        } catch (e) {
            if (this._settings.get_boolean('show-copy-notifications'))
                Main.notify('ClipFlow Pro', _('Failed to copy text'));
        }
    }

    _clearAllHistory() {
        this._clearAllAutoClearTimers();
        this._clipboardHistory = [];
        this._currentPage = 0;
        this._updateIconState();
        this._populateContextMenuRecentEntries();
        this._refreshHistory();
        this._queueHistorySave();
        Main.notify('ClipFlow Pro', _('History cleared'));
    }

    _openSettings() {
        this._openPreferencesTab('general');
    }

    _openPreferencesTab(target = 'general') {
        try {
            this._setPrefsTarget(target);
            ExtensionUtils.openPrefs();
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
            log(`ClipFlow Pro: Unable to set target preferences tab: ${e.message}`);
        }
    }

    destroy() {
        this._stopClipboardMonitoring();

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
        this._contextMenuMonitoringItem = null;
        this._contextMenuRecentSection = null;
        if (this._menuContainerItem) {
            this._menuContainerItem.destroy();
            this._menuContainerItem = null;
            this._menuContainerBox = null;
        }
        this._historyScrollView = null;
        this._historyContainer = null;
        this._paginationBox = null;
        this._paginationLabel = null;
        this._paginationPrevButton = null;
        this._paginationNextButton = null;
        this._unregisterKeybindings();
        this._clearAllAutoClearTimers();
        this._cancelHistorySaveTimeout();
        
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
        
        super.destroy();
    }
});

class Extension {
    constructor() {
        this._indicator = null;
        this._settings = null;
        this._panelPositionChangedId = 0;
    }

    enable() {
        try {
            // Initialize translations
            ExtensionUtils.initTranslations();
            
            this._settings = ExtensionUtils.getSettings();
            const panelPosition = this._settings.get_string('panel-position');
            this._indicator = new ClipFlowIndicator();
            Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, panelPosition);

            if (this._panelPositionChangedId) {
                this._settings.disconnect(this._panelPositionChangedId);
                this._panelPositionChangedId = 0;
            }
            this._panelPositionChangedId = this._settings.connect('changed::panel-position', () => {
                this._relocateIndicator();
            });

            Main.notify('ClipFlow Pro', _('Extension enabled successfully! 🎉'));
        } catch (e) {
            log(`ClipFlow Pro: Error enabling extension: ${e.message}`);
            Main.notify('ClipFlow Pro', _('Failed to enable extension. Check logs for details.'));
        }
    }

    disable() {
        try {
            if (this._settings && this._panelPositionChangedId) {
                this._settings.disconnect(this._panelPositionChangedId);
                this._panelPositionChangedId = 0;
            }

            if (this._indicator) {
                this._indicator.destroy();
                this._indicator = null;
            }
            this._settings = null;
            Main.notify('ClipFlow Pro', _('Extension disabled'));
        } catch (e) {
            log(`ClipFlow Pro: Error disabling extension: ${e.message}`);
        }
    }

    _relocateIndicator() {
        const newPosition = this._settings ? this._settings.get_string('panel-position') : 'right';
        if (this._indicator) {
            if (typeof this._indicator.prepareForReposition === 'function') {
                this._indicator.prepareForReposition();
            }
            this._indicator.destroy();
            this._indicator = null;
        }

        this._indicator = new ClipFlowIndicator();
        Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, newPosition);
    }
}

function init() {
    return new Extension();
}
