'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, Gio, GLib, Clutter, Meta, Shell, GObject} = imports.gi;
const ByteArray = imports.byteArray;

function _logToFile(msg) {
    try {
        const ts = new Date().toISOString();
        const cacheDir = GLib.get_user_cache_dir();
        const dir = GLib.build_filenamev([cacheDir, 'clipflow-pro']);
        GLib.mkdir_with_parents(dir, 0o755);
        const logPath = GLib.build_filenamev([dir, 'extension.log']);
        const file = Gio.File.new_for_path(logPath);
        const stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        const line = ByteArray.fromString(`[${ts}] ${msg}\n`);
        stream.write(line, null);
        stream.close(null);
    } catch (e) {
        log(`ClipFlow Pro (file log failed): ${e}`);
    }
}

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

class ClipFlowManager {
    constructor(settings) {
        this._settings = settings;
        this._history = [];
        this._clipboard = St.Clipboard.get_default();
        this._clipboardPollId = null;
        this._lastClipboardText = '';
        this._loadHistory();
    }

    startMonitoring() {
        this._clipboardPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._checkClipboard();
            return GLib.SOURCE_CONTINUE;
        });
    }

    stopMonitoring() {
        if (this._clipboardPollId) {
            GLib.source_remove(this._clipboardPollId);
            this._clipboardPollId = null;
        }
    }

    _checkClipboard() {
        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            if (text && text.trim() && text !== this._lastClipboardText) {
                this._lastClipboardText = text;
                if (!this._isDuplicate(text)) {
                    _logToFile(`Adding new clipboard entry: ${text.substring(0, 50)}...`);
                    this._addEntry(new ClipboardEntry(text));
                }
            }
        });
    }

    _isDuplicate(text) {
        return this._history.length > 0 && this._history[0].text === text;
    }

    _addEntry(entry) {
        this._history.unshift(entry);
        const maxEntries = this._settings.get_int('max-entries');
        if (this._history.length > maxEntries) {
            this._history = this._history.slice(0, maxEntries);
        }
        this._saveHistory();
    }

    _loadHistory() {
        try {
            const configDir = GLib.get_user_config_dir();
            const historyFile = GLib.build_filenamev([configDir, 'clipflow-pro', 'history.json']);

            if (GLib.file_test(historyFile, GLib.FileTest.EXISTS)) {
                const [success, contents] = GLib.file_get_contents(historyFile);
                if (success) {
                    const data = JSON.parse(ByteArray.toString(contents));
                    this._history = data.map(item => new ClipboardEntry(
                        item.text, item.type, item.timestamp, item.pinned, item.starred
                    ));
                }
            }
        } catch (e) {
            log(`ClipFlow Pro: Error loading history: ${e}`);
        }
    }

    _saveHistory() {
        try {
            const configDir = GLib.get_user_config_dir();
            const clipflowDir = GLib.build_filenamev([configDir, 'clipflow-pro']);
            GLib.mkdir_with_parents(clipflowDir, 0o755);
            const historyFile = GLib.build_filenamev([clipflowDir, 'history.json']);
            const data = JSON.stringify(this._history.map(entry => ({
                text: entry.text,
                type: entry.type,
                timestamp: entry.timestamp,
                pinned: entry.pinned,
                starred: entry.starred
            })));
            GLib.file_set_contents(historyFile, data);
        } catch (e) {
            log(`ClipFlow Pro: Error saving history: ${e}`);
        }
    }

    getHistory() {
        return this._history;
    }

    copyEntry(entry) {
        _logToFile(`Copying entry: ${entry.text.substring(0, 50)}...`);
        this._clipboard.set_text(St.ClipboardType.CLIPBOARD, entry.text);
        const index = this._history.indexOf(entry);
        if (index > 0) {
            this._history.splice(index, 1);
            this._history.unshift(entry);
            this._saveHistory();
        }
    }

    clearHistory() {
        this._history = [];
        this._saveHistory();
    }
}

var ClipFlowIndicator = GObject.registerClass(
class ClipFlowIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'ClipFlow Pro');

        this._settings = ExtensionUtils.getSettings();
        this._manager = new ClipFlowManager(this._settings);

        this._createIcon();
        this._buildMenu();

        this._manager.startMonitoring();
    }

    _createIcon() {
        this._icon = new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._icon);
        _logToFile('Indicator icon created');
    }

    _buildMenu() {
        // Search box
        this._searchEntry = new St.Entry({
            style_class: 'clipflow-search-entry',
            hint_text: _('Search clipboard history...'),
            can_focus: true,
            x_expand: true
        });

        const searchBox = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        searchBox.add_child(this._searchEntry);
        this.menu.addMenuItem(searchBox);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Entries container
        this._entriesSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._entriesSection);

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Clear history button
        const clearItem = new PopupMenu.PopupMenuItem(_('Clear History'));
        clearItem.connect('activate', () => {
            this._manager.clearHistory();
            this._refreshEntries();
        });
        this.menu.addMenuItem(clearItem);

        // Settings button
        const settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        settingsItem.connect('activate', () => {
            try {
                ExtensionUtils.openPrefs();
            } catch (e) {
                log(`ClipFlow Pro: Could not open preferences: ${e}`);
            }
        });
        this.menu.addMenuItem(settingsItem);

        this._refreshEntries();
        _logToFile('Menu built and entries refreshed');
    }

    _refreshEntries() {
        this._entriesSection.removeAll();

        const entries = this._manager.getHistory();

        if (entries.length === 0) {
            const emptyItem = new PopupMenu.PopupMenuItem(_('No clipboard history'));
            emptyItem.reactive = false;
            this._entriesSection.addMenuItem(emptyItem);
            return;
        }

        // Add entries
        entries.forEach((entry, index) => {
            const item = this._createEntryMenuItem(entry, index + 1);
            this._entriesSection.addMenuItem(item);
        });
    }

    _createEntryMenuItem(entry, number) {
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

        container.add_child(left);
        container.add_child(middle);
        item.add_child(container);

        // Click anywhere to copy
        item.connect('activate', () => {
            this._manager.copyEntry(entry);
            this.menu.close();
            Main.notify('ClipFlow Pro', _('Copied to clipboard'));
        });

        return item;
    }

    destroy() {
        this._manager.stopMonitoring();
        super.destroy();
    }
});

class Extension {
    enable() {
        try {
            ExtensionUtils.initTranslations();
            this._settings = ExtensionUtils.getSettings();
            _logToFile('Extension enable() called');
            
            this._indicator = new ClipFlowIndicator();
            _logToFile('Extension enable() - indicator created');
            
            // Get panel position from settings
            const position = this._settings.get_string('panel-position');
            const box = position === 'left' ? 'left' : position === 'center' ? 'center' : 'right';
            Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, box);
            _logToFile('Extension enable() - added to status area');
            
            Main.notify('ClipFlow Pro', _('Enabled'));
            _logToFile('Extension enable() completed');
            log('ClipFlow Pro: Extension enabled successfully');
        } catch (e) {
            _logToFile(`Extension enable() error: ${e.message}`);
            log(`ClipFlow Pro: Extension enable error: ${e.message}`);
        }
    }

    disable() {
        _logToFile('Extension disable() called');
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        _logToFile('Extension disable() completed');
    }
}

function init() {
    return new Extension();
}