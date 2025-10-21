// ClipFlow Pro - Advanced Clipboard Manager
// Created by Nick Otmazgin

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

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

    getFormattedText() {
        return this.text.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    }
}

class ClipFlowManager {
    constructor(settings) {
        this._settings = settings;
        this._history = [];
        this._clipboard = St.Clipboard.get_default();
        this._selection = St.Clipboard.get_default();
        this._clipboardChangedId = null;
        this._selectionChangedId = null;
    }

    startMonitoring() {
        // Monitor clipboard changes
        this._clipboardChangedId = this._clipboard.connect('owner-changed', () => {
            this._onClipboardChanged();
        });

        // Monitor selection changes if auto-copy is enabled
        if (this._settings.get_boolean('enable-auto-copy')) {
            this._selectionChangedId = this._selection.connect('owner-changed', () => {
                this._onSelectionChanged();
            });
        }
    }

    stopMonitoring() {
        if (this._clipboardChangedId) {
            this._clipboard.disconnect(this._clipboardChangedId);
            this._clipboardChangedId = null;
        }
        if (this._selectionChangedId) {
            this._selection.disconnect(this._selectionChangedId);
            this._selectionChangedId = null;
        }
    }

    _onClipboardChanged() {
        this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            if (text && text.trim() && !this._isDuplicate(text)) {
                this._addEntry(new ClipboardEntry(text));
            }
        });
    }

    _onSelectionChanged() {
        if (!this._settings.get_boolean('enable-auto-copy')) return;

        this._selection.get_text(St.ClipboardType.PRIMARY, (selection, text) => {
            if (text && text.trim()) {
                // Auto-copy selected text to clipboard
                this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
            }
        });
    }

    _isDuplicate(text) {
        return this._history.length > 0 && this._history[0].text === text;
    }

    _addEntry(entry) {
        // Check if content should be ignored (e.g., passwords)
        if (this._settings.get_boolean('ignore-passwords') && this._isPasswordContent(entry.text)) {
            return;
        }

        // Check max entry length
        const maxLength = this._settings.get_int('max-entry-length');
        if (entry.text.length > maxLength) {
            entry.text = entry.text.substring(0, maxLength);
        }

        // Add to beginning of history
        this._history.unshift(entry);

        // Maintain max entries limit
        const maxEntries = this._settings.get_int('max-entries');
        if (this._history.length > maxEntries) {
            this._history = this._history.slice(0, maxEntries);
        }

        // Save to persistent storage
        this._saveHistory();
    }

    _isPasswordContent(text) {
        // Simple heuristic to detect password-like content
        return text.length < 100 && /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]+$/.test(text);
    }

    getHistory() {
        return this._history;
    }

    getPinnedEntries() {
        return this._history.filter(entry => entry.pinned);
    }

    getStarredEntries() {
        return this._history.filter(entry => entry.starred);
    }

    pinEntry(entryId, pinned = true) {
        const entry = this._history.find(e => e.id === entryId);
        if (entry) {
            entry.pinned = pinned;
            this._saveHistory();
        }
    }

    starEntry(entryId, starred = true) {
        const entry = this._history.find(e => e.id === entryId);
        if (entry) {
            entry.starred = starred;
            this._saveHistory();
        }
    }

    deleteEntry(entryId) {
        this._history = this._history.filter(e => e.id !== entryId);
        this._saveHistory();
    }

    clearHistory() {
        this._history = [];
        this._saveHistory();
    }

    copyEntry(entry) {
        this._clipboard.set_text(St.ClipboardType.CLIPBOARD, entry.text);
    }

    searchEntries(query) {
        const lowerQuery = query.toLowerCase();
        return this._history.filter(entry => 
            entry.text.toLowerCase().includes(lowerQuery)
        );
    }

    _saveHistory() {
        try {
            const data = JSON.stringify(this._history);
            GLib.file_set_contents(this._getHistoryFile(), data);
        } catch (e) {
            log(`ClipFlow Pro: Error saving history: ${e}`);
        }
    }

    _loadHistory() {
        try {
            const [success, contents] = GLib.file_get_contents(this._getHistoryFile());
            if (success) {
                const data = JSON.parse(new TextDecoder().decode(contents));
                this._history = data.map(item => 
                    new ClipboardEntry(item.text, item.type, item.timestamp, item.pinned, item.starred)
                );
            }
        } catch (e) {
            log(`ClipFlow Pro: Error loading history: ${e}`);
            this._history = [];
        }
    }

    _getHistoryFile() {
        const configDir = GLib.get_user_config_dir();
        const dir = GLib.build_filenamev([configDir, 'clipflow-pro']);
        GLib.mkdir_with_parents(dir, 0o755);
        return GLib.build_filenamev([dir, 'history.json']);
    }
}

class ClipFlowIndicator extends PanelMenu.Button {
    constructor(extension) {
        super(0.0, 'ClipFlow Pro');
        
        this._extension = extension;
        this._settings = extension.getSettings();
        this._manager = new ClipFlowManager(this._settings);
        this._currentPage = 0;
        this._searchQuery = '';

        this._createIcon();
        this._createMenu();
        this._setupKeyboardShortcuts();
        
        this._manager._loadHistory();
        this._manager.startMonitoring();

        // Settings change handlers
        this._settingsChangedId = this._settings.connect('changed', () => {
            this._onSettingsChanged();
        });
    }

    _createIcon() {
        this._icon = new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._icon);
    }

    _createMenu() {
        // Search entry
        this._searchEntry = new St.Entry({
            style_class: 'clipflow-search-entry',
            hint_text: _('Search clipboard...'),
            can_focus: true,
            x_expand: true
        });

        this._searchItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });
        this._searchItem.add_child(this._searchEntry);
        this.menu.addMenuItem(this._searchItem);

        this._searchEntry.get_clutter_text().connect('text-changed', () => {
            this._searchQuery = this._searchEntry.get_text();
            this._refreshMenu();
        });

        // Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Control buttons
        this._createControlButtons();
        
        // Clipboard entries will be added here
        this._entriesSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._entriesSection);

        // Navigation
        this._createNavigation();

        this.menu.connect('open-state-changed', (menu, open) => {
            if (open) {
                this._refreshMenu();
                this._searchEntry.grab_key_focus();
            }
        });
    }

    _createControlButtons() {
        const buttonBox = new St.BoxLayout({
            style_class: 'clipflow-button-box',
            x_expand: true
        });

        // Clear button
        const clearButton = new St.Button({
            label: _('Clear All'),
            style_class: 'clipflow-control-button',
            x_expand: true
        });
        clearButton.connect('clicked', () => {
            this._manager.clearHistory();
            this._refreshMenu();
            this.menu.close();
        });

        // Settings button
        const settingsButton = new St.Button({
            label: _('Settings'),
            style_class: 'clipflow-control-button',
            x_expand: true
        });
        settingsButton.connect('clicked', () => {
            this._extension.openPreferences();
            this.menu.close();
        });

        buttonBox.add_child(clearButton);
        buttonBox.add_child(settingsButton);

        const buttonItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });
        buttonItem.add_child(buttonBox);
        this.menu.addMenuItem(buttonItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _createNavigation() {
        this._navItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });

        const navBox = new St.BoxLayout({
            style_class: 'clipflow-nav-box',
            x_expand: true
        });

        this._prevButton = new St.Button({
            label: _('‹ Previous'),
            style_class: 'clipflow-nav-button'
        });
        this._prevButton.connect('clicked', () => {
            if (this._currentPage > 0) {
                this._currentPage--;
                this._refreshMenu();
            }
        });

        this._pageLabel = new St.Label({
            style_class: 'clipflow-page-label',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER
        });

        this._nextButton = new St.Button({
            label: _('Next ›'),
            style_class: 'clipflow-nav-button'
        });
        this._nextButton.connect('clicked', () => {
            const entriesPerPage = this._settings.get_int('entries-per-page');
            const filteredEntries = this._getFilteredEntries();
            if ((this._currentPage + 1) * entriesPerPage < filteredEntries.length) {
                this._currentPage++;
                this._refreshMenu();
            }
        });

        navBox.add_child(this._prevButton);
        navBox.add_child(this._pageLabel);
        navBox.add_child(this._nextButton);

        this._navItem.add_child(navBox);
        this.menu.addMenuItem(this._navItem);
    }

    _getFilteredEntries() {
        if (this._searchQuery) {
            return this._manager.searchEntries(this._searchQuery);
        }
        return this._manager.getHistory();
    }

    _refreshMenu() {
        // Clear existing entries
        this._entriesSection.removeAll();

        const filteredEntries = this._getFilteredEntries();
        const entriesPerPage = this._settings.get_int('entries-per-page');
        const startIndex = this._currentPage * entriesPerPage;
        const endIndex = Math.min(startIndex + entriesPerPage, filteredEntries.length);
        const pageEntries = filteredEntries.slice(startIndex, endIndex);

        if (pageEntries.length === 0) {
            const emptyItem = new PopupMenu.PopupMenuItem(_('No clipboard entries'));
            emptyItem.reactive = false;
            this._entriesSection.addMenuItem(emptyItem);
        } else {
            pageEntries.forEach((entry, index) => {
                this._addEntryMenuItem(entry, startIndex + index + 1);
            });
        }

        // Update navigation
        const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);
        this._pageLabel.text = `${this._currentPage + 1} / ${Math.max(1, totalPages)}`;
        this._prevButton.reactive = this._currentPage > 0;
        this._nextButton.reactive = this._currentPage < totalPages - 1;
    }

    _addEntryMenuItem(entry, number) {
        const item = new PopupMenu.PopupBaseMenuItem({
            style_class: 'clipflow-entry-item'
        });

        const entryBox = new St.BoxLayout({
            vertical: false,
            x_expand: true,
            style_class: 'clipflow-entry-box'
        });

        // Entry number and indicators
        const leftBox = new St.BoxLayout({
            vertical: false,
            style_class: 'clipflow-entry-left'
        });

        if (this._settings.get_boolean('show-numbers')) {
            const numberLabel = new St.Label({
                text: `${number}.`,
                style_class: 'clipflow-entry-number'
            });
            leftBox.add_child(numberLabel);
        }

        // Pin and star indicators
        if (entry.pinned) {
            const pinIcon = new St.Icon({
                icon_name: 'view-pin-symbolic',
                style_class: 'clipflow-entry-indicator'
            });
            leftBox.add_child(pinIcon);
        }

        if (entry.starred) {
            const starIcon = new St.Icon({
                icon_name: 'starred-symbolic',
                style_class: 'clipflow-entry-indicator'
            });
            leftBox.add_child(starIcon);
        }

        // Entry content
        const contentBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'clipflow-entry-content'
        });

        const previewText = this._settings.get_boolean('show-preview') ? 
            entry.getPreview(80) : entry.getPreview(40);

        const textLabel = new St.Label({
            text: previewText,
            style_class: 'clipflow-entry-text'
        });
        textLabel.clutter_text.ellipsize = 3; // PANGO_ELLIPSIZE_END

        const timeLabel = new St.Label({
            text: this._formatTimestamp(entry.timestamp),
            style_class: 'clipflow-entry-time'
        });

        contentBox.add_child(textLabel);
        contentBox.add_child(timeLabel);

        // Action buttons
        const actionBox = new St.BoxLayout({
            vertical: false,
            style_class: 'clipflow-entry-actions'
        });

        const pinButton = new St.Button({
            child: new St.Icon({
                icon_name: entry.pinned ? 'view-pin-symbolic' : 'view-pin-symbolic',
                style_class: entry.pinned ? 'clipflow-action-active' : 'clipflow-action-inactive'
            }),
            style_class: 'clipflow-action-button'
        });
        pinButton.connect('clicked', () => {
            this._manager.pinEntry(entry.id, !entry.pinned);
            this._refreshMenu();
        });

        const starButton = new St.Button({
            child: new St.Icon({
                icon_name: entry.starred ? 'starred-symbolic' : 'non-starred-symbolic',
                style_class: entry.starred ? 'clipflow-action-active' : 'clipflow-action-inactive'
            }),
            style_class: 'clipflow-action-button'
        });
        starButton.connect('clicked', () => {
            this._manager.starEntry(entry.id, !entry.starred);
            this._refreshMenu();
        });

        const deleteButton = new St.Button({
            child: new St.Icon({
                icon_name: 'edit-delete-symbolic',
                style_class: 'clipflow-action-delete'
            }),
            style_class: 'clipflow-action-button'
        });
        deleteButton.connect('clicked', () => {
            this._manager.deleteEntry(entry.id);
            this._refreshMenu();
        });

        actionBox.add_child(pinButton);
        actionBox.add_child(starButton);
        actionBox.add_child(deleteButton);

        entryBox.add_child(leftBox);
        entryBox.add_child(contentBox);
        entryBox.add_child(actionBox);

        item.add_child(entryBox);

        // Click to copy
        item.connect('activate', () => {
            this._manager.copyEntry(entry);
            this.menu.close();
            Main.notify('ClipFlow Pro', _('Copied to clipboard'));
        });

        this._entriesSection.addMenuItem(item);
    }

    _formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return _('Just now');
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    _setupKeyboardShortcuts() {
        this._keyboardShortcuts = [];

        const addShortcut = (settingKey, callback) => {
            const shortcut = this._settings.get_strv(settingKey)[0];
            if (shortcut) {
                const action = global.display.grab_accelerator(shortcut, Meta.KeyBindingFlags.NONE);
                if (action !== Meta.KeyBindingAction.NONE) {
                    global.display.connect(`accelerator-activated::${action}`, callback);
                    this._keyboardShortcuts.push(action);
                }
            }
        };

        addShortcut('show-menu-shortcut', () => {
            this.menu.toggle();
        });

        addShortcut('copy-shortcut', () => {
            // Enhanced copy functionality could be added here
        });

        addShortcut('paste-shortcut', () => {
            // Enhanced paste functionality could be added here
        });
    }

    _onSettingsChanged() {
        // Handle settings changes
        this._refreshMenu();
        
        // Restart monitoring if auto-copy setting changed
        this._manager.stopMonitoring();
        this._manager.startMonitoring();
    }

    destroy() {
        this._manager.stopMonitoring();
        
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        // Remove keyboard shortcuts
        this._keyboardShortcuts.forEach(action => {
            global.display.ungrab_accelerator(action);
        });

        super.destroy();
    }
}

export default class ClipFlowProExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
    }

    enable() {
        this._indicator = new ClipFlowIndicator(this);
        
        const position = this.getSettings().get_string('panel-position');
        let panelPosition;
        
        switch (position) {
            case 'left':
                panelPosition = 0;
                break;
            case 'center':
                panelPosition = 1;
                break;
            case 'right':
            default:
                panelPosition = -1;
                break;
        }

        Main.panel.addToStatusArea('clipflow-pro', this._indicator, panelPosition);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}