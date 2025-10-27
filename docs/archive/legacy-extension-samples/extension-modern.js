'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, GObject, GLib, Gio, Clutter} = imports.gi;

// Modern ClipFlow Pro - Clean, Powerful, Obstacle-Free
var ClipFlowIndicator = GObject.registerClass(
class ClipFlowIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'ClipFlow Pro');
        
        // Modern initialization - no deprecated functions
        this._settings = ExtensionUtils.getSettings();
        this._clipboardHistory = [];
        this._maxHistory = 50;
        this._isMonitoring = false;
        
        this._createIcon();
        this._buildMenu();
        this._startClipboardMonitoring();
        
        // Connect to settings changes
        this._connectSettings();
    }

    _createIcon() {
        // Modern icon creation
        this._icon = new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._icon);
        
        // Add subtle animation on hover
        this._icon.add_style_class_name('clipflow-icon');
    }

    _buildMenu() {
        // Clear existing menu items
        this.menu.removeAll();
        
        // Header
        const header = new PopupMenu.PopupMenuItem('📋 ClipFlow Pro');
        header.actor.add_style_class_name('clipflow-header');
        this.menu.addMenuItem(header);
        
        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Search box
        this._createSearchBox();
        
        // History container
        this._historyContainer = new St.BoxLayout({
            vertical: true,
            spacing: 4
        });
        
        const historyItem = new PopupMenu.PopupBaseMenuItem();
        historyItem.actor.add_child(this._historyContainer);
        this.menu.addMenuItem(historyItem);
        
        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Action buttons
        this._createActionButtons();
        
        // Load initial history
        this._refreshHistory();
    }

    _createSearchBox() {
        const searchContainer = new St.BoxLayout({
            vertical: false,
            spacing: 8
        });
        
        this._searchEntry = new St.Entry({
            hint_text: 'Search clipboard history...',
            can_focus: true
        });
        
        // Modern styling
        this._searchEntry.add_style_class_name('clipflow-search');
        this._searchEntry.clutter_text.set_max_length(100);
        
        // Connect search functionality
        this._searchEntry.clutter_text.connect('text-changed', () => {
            this._filterHistory();
        });
        
        searchContainer.add_child(this._searchEntry);
        
        const searchItem = new PopupMenu.PopupBaseMenuItem();
        searchItem.actor.add_child(searchContainer);
        this.menu.addMenuItem(searchItem);
    }

    _createActionButtons() {
        const buttonContainer = new St.BoxLayout({
            vertical: false,
            spacing: 8
        });
        
        // Clear button
        const clearButton = new St.Button({
            label: '🗑️ Clear All',
            style_class: 'clipflow-button'
        });
        clearButton.connect('clicked', () => {
            this._clearAllHistory();
        });
        buttonContainer.add_child(clearButton);
        
        // Settings button
        const settingsButton = new St.Button({
            label: '⚙️ Settings',
            style_class: 'clipflow-button'
        });
        settingsButton.connect('clicked', () => {
            this._openSettings();
        });
        buttonContainer.add_child(settingsButton);
        
        const buttonItem = new PopupMenu.PopupBaseMenuItem();
        buttonItem.actor.add_child(buttonContainer);
        this.menu.addMenuItem(buttonItem);
    }

    _startClipboardMonitoring() {
        if (this._isMonitoring) return;
        
        this._isMonitoring = true;
        
        // Modern clipboard monitoring using GLib
        this._clipboardTimeout = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            1000, // Check every second
            () => {
                this._checkClipboard();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _stopClipboardMonitoring() {
        if (this._clipboardTimeout) {
            GLib.source_remove(this._clipboardTimeout);
            this._clipboardTimeout = null;
        }
        this._isMonitoring = false;
    }

    _checkClipboard() {
        try {
            const clipboard = St.Clipboard.get_default();
            const text = clipboard.get_text();
            
            if (text && text.trim() && !this._isDuplicate(text)) {
                this._addToHistory(text.trim());
            }
        } catch (e) {
            // Silently handle clipboard errors
        }
    }

    _isDuplicate(text) {
        return this._clipboardHistory.some(item => item.text === text);
    }

    _addToHistory(text) {
        const timestamp = GLib.DateTime.new_now_local();
        const historyItem = {
            text: text,
            timestamp: timestamp,
            preview: text.length > 50 ? text.substring(0, 50) + '...' : text
        };
        
        // Add to beginning of history
        this._clipboardHistory.unshift(historyItem);
        
        // Limit history size
        if (this._clipboardHistory.length > this._maxHistory) {
            this._clipboardHistory = this._clipboardHistory.slice(0, this._maxHistory);
        }
        
        this._refreshHistory();
    }

    _refreshHistory() {
        // Clear existing history items
        this._historyContainer.destroy_all_children();
        
        const filteredHistory = this._getFilteredHistory();
        
        if (filteredHistory.length === 0) {
            const emptyItem = new St.Label({
                text: 'No clipboard history',
                style_class: 'clipflow-empty'
            });
            this._historyContainer.add_child(emptyItem);
            return;
        }
        
        // Add history items
        filteredHistory.forEach((item, index) => {
            this._createHistoryItem(item, index);
        });
    }

    _getFilteredHistory() {
        const searchText = this._searchEntry.get_text().toLowerCase();
        
        if (!searchText) {
            return this._clipboardHistory;
        }
        
        return this._clipboardHistory.filter(item => 
            item.text.toLowerCase().includes(searchText)
        );
    }

    _filterHistory() {
        this._refreshHistory();
    }

    _createHistoryItem(item, index) {
        const itemContainer = new St.BoxLayout({
            vertical: true,
            spacing: 2
        });
        
        // Main text
        const textLabel = new St.Label({
            text: item.preview,
            style_class: 'clipflow-history-text'
        });
        textLabel.clutter_text.set_line_wrap(true);
        textLabel.clutter_text.set_line_wrap_mode(Clutter.WrapMode.WORD);
        
        // Timestamp
        const timeLabel = new St.Label({
            text: item.timestamp.format('%H:%M:%S'),
            style_class: 'clipflow-history-time'
        });
        
        itemContainer.add_child(textLabel);
        itemContainer.add_child(timeLabel);
        
        // Make clickable
        const clickableItem = new St.Button({
            child: itemContainer,
            style_class: 'clipflow-history-item'
        });
        
        clickableItem.connect('clicked', () => {
            this._copyToClipboard(item.text);
            this.menu.close();
        });
        
        this._historyContainer.add_child(clickableItem);
    }

    _copyToClipboard(text) {
        try {
            const clipboard = St.Clipboard.get_default();
            clipboard.set_text(text);
            Main.notify('ClipFlow Pro', 'Text copied to clipboard');
        } catch (e) {
            Main.notify('ClipFlow Pro', 'Failed to copy text');
        }
    }

    _clearAllHistory() {
        this._clipboardHistory = [];
        this._refreshHistory();
        Main.notify('ClipFlow Pro', 'History cleared');
    }

    _openSettings() {
        try {
            Gio.AppInfo.launch_default_for_uri(
                'prefs:clipflow-pro@nickotmazgin.github.io',
                null
            );
        } catch (e) {
            Main.notify('ClipFlow Pro', 'Settings not available');
        }
    }

    _connectSettings() {
        // Connect to settings changes for future features
        this._settings.connect('changed', () => {
            this._refreshHistory();
        });
    }

    destroy() {
        this._stopClipboardMonitoring();
        super.destroy();
    }
});

class Extension {
    enable() {
        try {
            this._indicator = new ClipFlowIndicator();
            Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, 'right');
            Main.notify('ClipFlow Pro', 'Extension enabled successfully! 🎉');
        } catch (e) {
            Main.notify('ClipFlow Pro', `Enable error: ${e.message}`);
        }
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        Main.notify('ClipFlow Pro', 'Extension disabled');
    }
}

function init() {
    return new Extension();
}
