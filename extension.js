'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, GObject, GLib, Gio} = imports.gi;

// Get extension metadata
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

var ClipFlowIndicator = GObject.registerClass(
class ClipFlowIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'ClipFlow Pro');
        
        // Initialize settings
        this._settings = ExtensionUtils.getSettings();
        
        // Initialize clipboard history
        this._clipboardHistory = [];
        this._maxHistory = this._settings.get_int('max-entries');
        this._isMonitoring = false;
        this._clipboardTimeout = null;
        
        // Connect to settings changes
        this._settingsChangedId = this._settings.connect('changed::max-entries', () => {
            this._maxHistory = this._settings.get_int('max-entries');
            this._trimHistory();
        });
        
        this._createIcon();
        this._buildMenu();
        this._startClipboardMonitoring();
    }

    _createIcon() {
        this._icon = new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._icon);
    }

    _buildMenu() {
        // Clear existing menu
        this.menu.removeAll();
        
        // Header
    const header = new PopupMenu.PopupMenuItem('📋 ClipFlow Pro');
    // Use .actor for GNOME 42 compatibility; newer Shell supports direct style on item
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
        
        this._searchEntry.add_style_class_name('clipflow-search');
        this._searchEntry.clutter_text.set_max_length(100);
        
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
        
        this._clipboardTimeout = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            1000,
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
            clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clip, text) => {
                if (text && text.trim()) {
                    const trimmedText = text.trim();
                    
                    // Check if we should ignore this content
                    if (this._shouldIgnoreContent(trimmedText)) {
                        return;
                    }
                    
                    // Check for duplicates
                    if (!this._isDuplicate(trimmedText)) {
                        this._addToHistory(trimmedText);
                    }
                }
            });
        } catch (e) {
            log(`ClipFlow Pro: Error checking clipboard: ${e.message}`);
        }
    }
    
    _shouldIgnoreContent(text) {
        // Check if auto-copy is disabled
        if (!this._settings.get_boolean('enable-auto-copy')) {
            return false; // Only ignore if auto-copy is enabled
        }
        
        // Check if we should ignore passwords
        if (this._settings.get_boolean('ignore-passwords')) {
            // Simple password detection - can be enhanced
            if (text.length > 6 && /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(text) && 
                (text.includes('password') || text.includes('passwd') || text.includes('secret'))) {
                return true;
            }
        }
        
        return false;
    }

    _isDuplicate(text) {
        return this._clipboardHistory.some(item => item.text === text);
    }

    _addToHistory(text) {
        // Validate text length
        const maxLength = this._settings.get_int('max-entry-length');
        if (text.length > maxLength) {
            text = text.substring(0, maxLength);
        }
        
        const timestamp = GLib.DateTime.new_now_local();
        const historyItem = {
            text: text,
            timestamp: timestamp,
            preview: text.length > 50 ? text.substring(0, 50) + '...' : text,
            id: GLib.uuid_string_random() // Add unique ID for better tracking
        };
        
        this._clipboardHistory.unshift(historyItem);
        this._trimHistory();
        this._refreshHistory();
    }
    
    _trimHistory() {
        if (this._clipboardHistory.length > this._maxHistory) {
            this._clipboardHistory = this._clipboardHistory.slice(0, this._maxHistory);
        }
    }

    _refreshHistory() {
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
        
        const textLabel = new St.Label({
            text: item.preview,
            style_class: 'clipflow-history-text'
        });
        textLabel.clutter_text.set_line_wrap(true);
        
        const timeLabel = new St.Label({
            text: item.timestamp.format('%H:%M:%S'),
            style_class: 'clipflow-history-time'
        });
        
        itemContainer.add_child(textLabel);
        itemContainer.add_child(timeLabel);
        
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
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
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
            ExtensionUtils.openPrefs();
        } catch (e) {
            Main.notify('ClipFlow Pro', 'Settings not available');
        }
    }

    destroy() {
        this._stopClipboardMonitoring();
        
        // Disconnect settings
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        
        // Clear history
        this._clipboardHistory = [];
        
        super.destroy();
    }
});

class Extension {
    constructor() {
        this._indicator = null;
        this._settings = null;
        this._panelPositionChangedId = null;
    }

    enable() {
        try {
            // Initialize translations
            ExtensionUtils.initTranslations();
            
            // Get settings
            this._settings = ExtensionUtils.getSettings();
            
            // Create indicator
            this._indicator = new ClipFlowIndicator();
            
            // Get panel position from settings
            const panelPosition = this._settings.get_string('panel-position');
            Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, panelPosition);
            
            // Monitor panel position changes
            this._panelPositionChangedId = this._settings.connect('changed::panel-position', () => {
                this._updatePanelPosition();
            });
            
            Main.notify('ClipFlow Pro', _('Extension enabled successfully! 🎉'));
        } catch (e) {
            log(`ClipFlow Pro: Error enabling extension: ${e.message}`);
            Main.notify('ClipFlow Pro', _('Failed to enable extension. Check logs for details.'));
        }
    }

    _updatePanelPosition() {
        if (!this._indicator) return;
        
        try {
            // Remove indicator from current position
            this._indicator.destroy();
            
            // Create new indicator
            this._indicator = new ClipFlowIndicator();
            
            // Add to new position
            const panelPosition = this._settings.get_string('panel-position');
            Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, panelPosition);
            
            log(`ClipFlow Pro: Panel position updated to ${panelPosition}`);
        } catch (e) {
            log(`ClipFlow Pro: Error updating panel position: ${e.message}`);
        }
    }

    disable() {
        try {
            // Disconnect panel position monitoring
            if (this._panelPositionChangedId) {
                this._settings.disconnect(this._panelPositionChangedId);
                this._panelPositionChangedId = null;
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
}

function init() {
    return new Extension();
}