'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, Gio, GLib, Clutter, Meta, Shell, GObject} = imports.gi;
const ByteArray = imports.byteArray;

// Clipboard Entry Class
class ClipboardEntry {
    constructor(text, type = 'text', timestamp = null, pinned = false, starred = false) {
        this.text = text;
        this.type = type;
        this.timestamp = timestamp || Date.now();
        this.pinned = pinned;
        this.starred = starred;
        this.id = this._generateId();
    }

    _generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    getPreview(maxLength = 50) {
        return this.text.length > maxLength ?
            this.text.substring(0, maxLength) + '...' :
            this.text;
    }
}

// ClipFlow Manager Class
class ClipFlowManager {
    constructor() {
        this.history = [];
        this.maxHistory = 50;
        this.currentIndex = 0;
        this._conflictDetected = false;
    }

    addEntry(text, type = 'text') {
        if (!text || text.trim() === '') return;
        
        const entry = new ClipboardEntry(text, type);
        this.history.unshift(entry);
        
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(0, this.maxHistory);
        }
        
        this.currentIndex = 0;
    }

    getHistory() {
        return this.history;
    }

    clearHistory() {
        this.history = [];
        this.currentIndex = 0;
    }

    hasConflict() {
        return this._conflictDetected;
    }

    _checkForConflicts() {
        // Check for other clipboard managers
        try {
            const result = GLib.spawn_command_line_sync('pgrep -f "copyq|parcellite|glipper|diodon|klipper"');
            this._conflictDetected = result[0] && result[1].length > 0;
        } catch (e) {
            this._conflictDetected = false;
        }
    }
}

// Main ClipFlow Indicator Class
var ClipFlowIndicator = GObject.registerClass(
class ClipFlowIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'ClipFlow Pro');
        
        this._settings = ExtensionUtils.getSettings();
        this._manager = new ClipFlowManager();
        this._manager._checkForConflicts();
        
        this._createIcon();
        this._buildMenu();
        this._connectSettings();
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
        // Clear existing menu items
        this.menu.removeAll();
        
        // Add header
        const header = new PopupMenu.PopupBaseMenuItem({
            style_class: 'clipflow-header'
        });
        
        const headerBox = new St.BoxLayout({ vertical: false, spacing: 12 });
        headerBox.add_child(new St.Label({ text: 'ClipFlow Pro', style_class: 'clipflow-title' }));
        
        if (this._manager.hasConflict()) {
            const warning = new St.Label({ 
                text: '⚠️ Other clipboard manager detected', 
                style_class: 'clipflow-warning-text' 
            });
            headerBox.add_child(warning);
        }
        
        header.add_child(headerBox);
        this.menu.addMenuItem(header);
        
        // Add separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Add history items
        const history = this._manager.getHistory();
        if (history.length === 0) {
            const emptyItem = new PopupMenu.PopupBaseMenuItem({
                text: 'No clipboard history yet'
            });
            this.menu.addMenuItem(emptyItem);
        } else {
            history.slice(0, 10).forEach((entry, index) => {
                const item = this._createHistoryItem(entry, index + 1);
                this.menu.addMenuItem(item);
            });
        }
        
        // Add separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Add action buttons
        const clearButton = new PopupMenu.PopupBaseMenuItem({
            text: 'Clear All History'
        });
        clearButton.connect('activate', () => {
            this._manager.clearHistory();
            this._buildMenu();
        });
        this.menu.addMenuItem(clearButton);
        
        const settingsButton = new PopupMenu.PopupBaseMenuItem({
            text: 'Settings'
        });
        settingsButton.connect('activate', () => {
            this._openSettings();
        });
        this.menu.addMenuItem(settingsButton);
    }

    _createHistoryItem(entry, number) {
        const item = new PopupMenu.PopupBaseMenuItem({
            style_class: 'clipflow-entry-item'
        });

        const container = new St.BoxLayout({ vertical: false, x_expand: true, spacing: 12 });

        // Left side: number
        const left = new St.BoxLayout({ vertical: false, spacing: 6 });
        left.add_child(new St.Label({ text: `${number}.`, style_class: 'clipflow-entry-number' }));

        // Middle: content
        const middle = new St.BoxLayout({ vertical: true, x_expand: true, spacing: 4 });
        const previewText = entry.getPreview(80);
        const textLabel = new St.Label({ text: previewText, style_class: 'clipflow-entry-text' });
        textLabel.clutter_text.ellipsize = 3; // PANGO_ELLIPSIZE_END
        middle.add_child(textLabel);

        // Right side: actions
        const right = new St.BoxLayout({ vertical: false, spacing: 4 });
        
        const copyButton = new St.Button({
            style_class: 'clipflow-action-button',
            child: new St.Icon({ icon_name: 'edit-copy-symbolic', icon_size: 16 })
        });
        copyButton.connect('clicked', () => {
            this._copyToClipboard(entry.text);
        });
        right.add_child(copyButton);

        container.add_child(left);
        container.add_child(middle);
        container.add_child(right);
        item.add_child(container);

        item.connect('activate', () => {
            this._copyToClipboard(entry.text);
        });

        return item;
    }

    _copyToClipboard(text) {
        try {
            const clipboard = St.Clipboard.get_default();
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
            Main.notify('ClipFlow Pro', 'Text copied to clipboard');
        } catch (e) {
            log(`ClipFlow Pro: Error copying to clipboard: ${e.message}`);
        }
    }

    _openSettings() {
        try {
            GLib.spawn_command_line_async('gnome-extensions prefs clipflow-pro@nickotmazgin.github.io');
        } catch (e) {
            log(`ClipFlow Pro: Error opening settings: ${e.message}`);
        }
    }

    _connectSettings() {
        // Connect to settings changes
        this._settings.connect('changed', () => {
            this._buildMenu();
        });
    }

    _startClipboardMonitoring() {
        // Monitor clipboard changes
        this._clipboard = St.Clipboard.get_default();
        this._clipboard.connect('owner-change', () => {
            this._onClipboardChange();
        });
    }

    _onClipboardChange() {
        try {
            const text = this._clipboard.get_text(St.ClipboardType.CLIPBOARD);
            if (text && text.trim() !== '') {
                this._manager.addEntry(text);
                this._buildMenu();
            }
        } catch (e) {
            // Ignore clipboard errors
        }
    }

    destroy() {
        if (this._clipboard) {
            this._clipboard.disconnect_all();
        }
        super.destroy();
    }
});

// Extension Class
class Extension {
    enable() {
        try {
            log('ClipFlow Pro: Extension enable() called');
            
            this._indicator = new ClipFlowIndicator();
            
            // Add to panel
            const panelPosition = ExtensionUtils.getSettings().get_string('panel-position') || 'right';
            Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, panelPosition);
            
            log('ClipFlow Pro: Extension enabled successfully');
        } catch (e) {
            log(`ClipFlow Pro: Extension enable error: ${e.message}`);
            log(`ClipFlow Pro: Stack trace: ${e.stack}`);
        }
    }

    disable() {
        log('ClipFlow Pro: Extension disable() called');
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        log('ClipFlow Pro: Extension disabled');
    }
}

function init() {
    log('ClipFlow Pro: init() called');
    return new Extension();
}
