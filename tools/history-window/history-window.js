#!/usr/bin/gjs
'use strict';

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

const ByteArray = imports.byteArray;
const { GObject, GLib, Gio, Gtk, Adw, Gdk, Pango } = imports.gi;

imports.searchPath.unshift(GLib.path_get_dirname(GLib.path_get_dirname(imports.system.programInvocationName)));
const ClipboardInsert = imports.clipboardInsert;

const HISTORY_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'clipflow-pro']);
const HISTORY_FILE = GLib.build_filenamev([HISTORY_DIR, 'history.json']);
const INSERT_TARGET_FILE = GLib.build_filenamev([HISTORY_DIR, 'insert-target-window-id.txt']);
const APP_ID = 'io.github.nickotmazgin.ClipFlowProHistory';
const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.clipflow-pro';
const PREVIEW_MAX_CHARS = 140;
let _settings = null;

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function sortEntries(entries) {
    return entries.slice().sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned))
            return a.pinned ? -1 : 1;
        if (Boolean(a.starred) !== Boolean(b.starred))
            return a.starred ? -1 : 1;
        return (b.timestampUnix || 0) - (a.timestampUnix || 0);
    });
}

function loadHistory() {
    if (!GLib.file_test(HISTORY_FILE, GLib.FileTest.EXISTS))
        return [];
    try {
        const [, bytes] = GLib.file_get_contents(HISTORY_FILE);
        const raw = ByteArray.toString(bytes);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return sortEntries(parsed
            .map(e => {
                const text = normalizeText(e && e.text);
                if (!text)
                    return null;
                return {
                    id: e.id || GLib.uuid_string_random(),
                    text,
                    timestampUnix: Number.isFinite(e.timestampUnix) ? e.timestampUnix : 0,
                    pinned: Boolean(e.pinned),
                    starred: Boolean(e.starred),
                    sensitive: Boolean(e.sensitive),
                };
            })
            .filter(Boolean));
    } catch (_e) {
        return [];
    }
}

function saveHistory(entries) {
    GLib.mkdir_with_parents(HISTORY_DIR, 0o700);
    const payload = JSON.stringify(sortEntries(entries), null, 2);
    GLib.file_set_contents(HISTORY_FILE, payload);
    try {
        const file = Gio.File.new_for_path(HISTORY_FILE);
        file.set_attribute_uint32('unix::mode', 0o600, Gio.FileQueryInfoFlags.NONE, null);
    } catch (_e) {}
}

function formatTs(unix) {
    if (!unix)
        return '';
    try {
        const dt = GLib.DateTime.new_from_unix_local(unix);
        return dt.format('%Y-%m-%d %H:%M:%S');
    } catch (_e) {
        return '';
    }
}

function copyToClipboard(text) {
    return ClipboardInsert.setSystemClipboardPlainText(text == null ? '' : String(text));
}

function loadInsertTargetWindowId() {
    try {
        const fromEnv = (GLib.getenv('CLIPFLOW_INSERT_TARGET_WID') || '').trim();
        if (/^\d+$/.test(fromEnv))
            return fromEnv;
        if (!GLib.file_test(INSERT_TARGET_FILE, GLib.FileTest.EXISTS))
            return '';
        const [, bytes] = GLib.file_get_contents(INSERT_TARGET_FILE);
        const id = String(ByteArray.toString(bytes)).trim();
        return /^\d+$/.test(id) ? id : '';
    } catch (_e) {
        return '';
    }
}

function insertToFocusedTarget(text, submit = false, windowId = null) {
    const value = normalizeText(text);
    if (!value)
        return false;

    if (!_isAutoInsertEnabled())
        return false;

    const wid = String(windowId || loadInsertTargetWindowId() || '').trim();

    return ClipboardInsert.insertPlainTextIntoTarget({
        text: value,
        windowId: wid,
        submit,
    });
}

function _getSettings() {
    if (!_settings)
        _settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });
    return _settings;
}

function _isAutoInsertEnabled() {
    try {
        const settings = _getSettings();
        if (settings.settings_schema?.has_key?.('enable-xdotool-insert'))
            return settings.get_boolean('enable-xdotool-insert');
    } catch (_e) {}
    return true;
}

function _openExtensionPrefs(targetTab = 'general') {
    try {
        const settings = _getSettings();
        if (settings.settings_schema?.has_key?.('target-prefs-tab'))
            settings.set_string('target-prefs-tab', targetTab);
        Gio.Subprocess.new(
            ['gnome-extensions', 'prefs', 'clipflow-pro@nickotmazgin.github.io'],
            Gio.SubprocessFlags.NONE
        );
    } catch (_e) {}
}

function _mkHeaderTextButton(label, iconName, onClick) {
    const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
    if (iconName) {
        const icon = new Gtk.Image({ icon_name: iconName });
        box.append(icon);
    }
    box.append(new Gtk.Label({ label }));
    const btn = new Gtk.Button();
    btn.set_tooltip_text(label);
    btn.set_child(box);
    btn.add_css_class('flat');
    btn.connect('clicked', onClick);
    return btn;
}

const ClipFlowHistoryWindow = GObject.registerClass(
class ClipFlowHistoryWindow extends Adw.ApplicationWindow {
    _init(app) {
        super._init({ application: app, title: 'ClipFlow Pro — History' });
        this.set_default_size(720, 520);
        this._entries = [];
        this._filter = '';
        this._refreshTimer = 0;
        this._selectedIds = new Set();
        this._rowById = new Map();
        this._activeRowId = null;
        this._lastCopiedId = null;
        this._lastCopiedTs = 0;
        this._lastReloadSignature = '';
        this._insertTargetWindowId = loadInsertTargetWindowId();

        const toolbar = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });
        toolbar.set_margin_start(12);
        toolbar.set_margin_end(12);
        toolbar.set_margin_top(8);
        toolbar.set_margin_bottom(4);

        const mkBtn = (label, cb) => {
            const b = new Gtk.Button({ label });
            b.connect('clicked', cb);
            return b;
        };

        this._search = new Gtk.SearchEntry({ placeholder_text: 'Search clipboard history…', hexpand: true });
        this._search.connect('search-changed', () => {
            this._filter = (this._search.get_text() || '').toLowerCase();
            this._rebuildList();
        });

        toolbar.append(this._search);
        toolbar.append(mkBtn('Refresh', () => this._reloadFromDisk()));
        toolbar.append(mkBtn('Copy', () => this._copySelected()));
        toolbar.append(mkBtn('Insert', () => this._insertSelected(false)));
        toolbar.append(mkBtn('Insert + Enter', () => this._insertSelected(true)));
        toolbar.append(mkBtn('Pin', () => this._toggleSelected('pinned')));
        toolbar.append(mkBtn('Star', () => this._toggleSelected('starred')));
        toolbar.append(mkBtn('Delete', () => this._deleteSelected()));
        toolbar.append(mkBtn('Clear all', () => this._clearAll()));

        this._list = Gtk.ListBox.new();
        this._list.set_selection_mode(Gtk.SelectionMode.SINGLE);
        this._list.connect('row-activated', (_lb, row) => {
            const entry = this._entryFromRow(row);
            if (!entry)
                return;
            this._activateEntry(entry);
        });
        this._list.connect('selected-rows-changed', () => {
            const row = this._list.get_selected_row();
            if (!row) {
                this._activeRowId = null;
            } else if (row._cfpId) {
                this._activeRowId = row._cfpId;
            }
            this._updateStatus();
        });

        const scrolled = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        });
        scrolled.set_child(this._list);

        this._status = new Gtk.Label({ xalign: 0, margin_start: 12, margin_end: 12, margin_bottom: 8 });
        this._status.get_style_context().add_class('dim-label');

        const content = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0, vexpand: true });
        content.append(toolbar);
        content.append(scrolled);
        content.append(this._status);

        const header = new Adw.HeaderBar();
        const headerTitle = new Gtk.Label({
            label: 'ClipFlow Pro — History',
            css_classes: ['title'],
        });
        header.set_title_widget(headerTitle);

        const aboutBtn = _mkHeaderTextButton('About', 'help-about-symbolic', () => {
            _openExtensionPrefs('about');
        });
        const settingsBtn = _mkHeaderTextButton('Settings', 'preferences-system-symbolic', () => {
            _openExtensionPrefs('general');
        });
        settingsBtn.add_css_class('suggested-action');
        header.pack_end(aboutBtn);
        header.pack_end(settingsBtn);

        this.set_content(new Adw.ToolbarView());
        this.get_content().add_top_bar(header);
        this.get_content().set_content(content);

        this._reloadFromDisk();
        this._setupFileMonitor();
        // Keep a low-frequency safety refresh; file monitor is primary.
        this._refreshTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 20, () => {
            this._reloadFromDisk(true);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _setupFileMonitor() {
        try {
            const file = Gio.File.new_for_path(HISTORY_FILE);
            this._monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', () => {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 350, () => {
                    this._reloadFromDisk(true);
                    return GLib.SOURCE_REMOVE;
                });
            });
        } catch (_e) {}
    }

    _visibleEntries() {
        const q = this._filter;
        if (!q)
            return this._entries;
        return this._entries.filter(e => e.text.toLowerCase().includes(q));
    }

    _buildSignature(entries) {
        return JSON.stringify(entries.map(e => [
            e.id,
            e.timestampUnix || 0,
            Boolean(e.pinned),
            Boolean(e.starred),
            Boolean(e.sensitive),
            e.text,
        ]));
    }

    _rebuildList() {
        const children = [...this._list];
        children.forEach(c => this._list.remove(c));
        this._rowById.clear();

        const visible = this._visibleEntries();
        visible.forEach((entry, index) => {
            const row = new Gtk.ListBoxRow();
            row._cfpId = entry.id;

            const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10, margin_top: 6, margin_bottom: 6, margin_start: 8, margin_end: 8 });
            const select = new Gtk.CheckButton({ valign: Gtk.Align.START });
            select._cfpBlocking = true;
            select.set_active(this._selectedIds.has(entry.id));
            select._cfpBlocking = false;
            select.set_tooltip_text('Select for bulk actions');
            select.connect('toggled', btn => {
                if (select._cfpBlocking)
                    return;
                if (btn.get_active())
                    this._selectedIds.add(entry.id);
                else
                    this._selectedIds.delete(entry.id);
                this._updateStatus();
            });

            const meta = new Gtk.Label({
                label: formatTs(entry.timestampUnix),
                xalign: 0,
                width_chars: 18,
            });
            meta.get_style_context().add_class('dim-label');

            const flags = [];
            if (entry.pinned) flags.push('📌');
            if (entry.starred) flags.push('★');
            const prefix = flags.length ? `${flags.join(' ')} ` : '';

            const preview = entry.text.length > PREVIEW_MAX_CHARS
                ? `${entry.text.slice(0, PREVIEW_MAX_CHARS - 1)}…`
                : entry.text;
            const label = new Gtk.Label({
                label: prefix + preview,
                xalign: 0,
                hexpand: true,
                wrap: true,
                wrap_mode: Pango.WrapMode.WORD_CHAR,
                selectable: false,
            });

            box.append(select);
            box.append(meta);
            box.append(label);
            row.set_child(box);
            this._attachRowGestures(row, entry);
            this._rowById.set(entry.id, row);
            this._list.append(row);
        });

        this._updateStatus(visible.length);
    }

    _reloadFromDisk(quiet = false) {
        const loaded = loadHistory();
        const sorted = sortEntries(loaded);
        const signature = this._buildSignature(sorted);
        if (quiet && signature === this._lastReloadSignature)
            return;
        this._lastReloadSignature = signature;
        this._entries = sorted;
        const validIds = new Set(this._entries.map(e => e.id));
        this._selectedIds = new Set([...this._selectedIds].filter(id => validIds.has(id)));
        if (this._activeRowId && !validIds.has(this._activeRowId))
            this._activeRowId = null;
        if (this._lastCopiedId && !validIds.has(this._lastCopiedId))
            this._lastCopiedId = null;
        this._rebuildList();
        if (!quiet && this._entries.length === 0)
            this._status.label = 'No history yet — copy something or use the panel icon.';
    }

    _entryFromRow(row) {
        if (!row || !row._cfpId)
            return null;
        return this._entries.find(e => e.id === row._cfpId) || null;
    }

    _selectedEntry() {
        const row = this._list.get_selected_row();
        return this._entryFromRow(row);
    }

    _selectedEntries() {
        const selected = this._entries.filter(e => this._selectedIds.has(e.id));
        if (selected.length > 0)
            return selected;
        const fallback = this._selectedEntry();
        return fallback ? [fallback] : [];
    }

    _copyEntry(entry) {
        if (!entry)
            return false;
        const ok = copyToClipboard(entry.text);
        if (!ok)
            return false;
        this._lastCopiedId = entry.id;
        this._lastCopiedTs = Math.floor(Date.now() / 1000);
        this._selectedIds.clear();
        this._selectedIds.add(entry.id);
        this._updateStatus();
        return true;
    }

    _activateEntry(entry) {
        if (!entry)
            return;
        this._selectedIds.clear();
        this._selectedIds.add(entry.id);
        this._insertSelected(false);
    }

    _copySelected() {
        const entries = this._selectedEntries();
        if (entries.length === 0)
            return;
        if (entries.length === 1) {
            this._copyEntry(entries[0]);
            return;
        }
        const merged = entries.map(e => e.text).join('\n');
        if (copyToClipboard(merged)) {
            this._lastCopiedId = entries[0].id;
            this._lastCopiedTs = Math.floor(Date.now() / 1000);
            this._updateStatus();
        }
    }

    _insertSelected(submit = false) {
        const entries = this._selectedEntries();
        if (entries.length === 0)
            return;
        const payload = entries.map(e => e.text).join('\n');
        const windowId = this._insertTargetWindowId || loadInsertTargetWindowId();
        this.minimize();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 180, () => {
            if (windowId)
                ClipboardInsert.activateWindow(windowId);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 280, () => {
                const ok = insertToFocusedTarget(payload, submit, windowId);
                if (ok) {
                    this._lastCopiedId = entries[0].id;
                    this._lastCopiedTs = Math.floor(Date.now() / 1000);
                    this._status.label = submit
                        ? 'Inserted and submitted into focused field.'
                        : 'Inserted into focused field.';
                } else {
                    this._status.label = windowId
                        ? 'Insert failed. Check "Enable Auto Insert" in ClipFlow settings and ensure xdotool is installed.'
                        : 'Insert failed: no target window saved. Focus Codex (or your app) first, then reopen the history window from the panel.';
                }
                return GLib.SOURCE_REMOVE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    _toggleSelected(field) {
        const targets = this._selectedEntries();
        if (targets.length === 0)
            return;
        // Flip using the first selected entry as baseline to keep bulk action predictable.
        const newValue = !Boolean(targets[0][field]);
        targets.forEach(e => {
            e[field] = newValue;
        });
        this._entries = sortEntries(this._entries);
        saveHistory(this._entries);
        this._rebuildList();
    }

    _deleteSelected() {
        const targets = this._selectedEntries();
        if (targets.length === 0)
            return;
        const ids = new Set(targets.map(t => t.id));
        this._entries = this._entries.filter(x => !ids.has(x.id));
        ids.forEach(id => this._selectedIds.delete(id));
        this._entries = sortEntries(this._entries);
        saveHistory(this._entries);
        this._lastReloadSignature = this._buildSignature(this._entries);
        this._rebuildList();
        this._updateStatus();
    }

    _clearAll() {
        const dialog = new Adw.MessageDialog({
            transient_for: this,
            heading: 'Clear all clipboard history?',
            body: 'This removes every entry from history.json. The panel menu will update after sync.',
            close_response: 'cancel',
        });
        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('clear', 'Clear all');
        dialog.set_response_appearance('clear', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.connect('response', (_d, id) => {
            if (id === 'clear') {
                this._entries = [];
                this._selectedIds.clear();
                this._activeRowId = null;
                this._lastCopiedId = null;
                saveHistory([]);
                this._rebuildList();
            }
        });
        dialog.present();
    }

    _attachRowGestures(row, entry) {
        const leftClick = Gtk.GestureClick.new();
        leftClick.set_button(0);
        try {
            leftClick.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        } catch (_e) {}
        leftClick.connect('pressed', (_gesture, nPress) => {
            this._activeRowId = entry.id;
            if (nPress === 2) {
                this._selectedIds.clear();
                this._selectedIds.add(entry.id);
                this._activateEntry(entry);
            }
        });
        row.add_controller(leftClick);

        const rightClick = Gtk.GestureClick.new();
        rightClick.set_button(0);
        try {
            rightClick.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        } catch (_e) {}
        rightClick.connect('pressed', (gesture, _nPress, x, y) => {
            const button = gesture.get_current_button ? gesture.get_current_button() : 0;
            if (button !== Gdk.BUTTON_SECONDARY)
                return;
            this._activeRowId = entry.id;
            this._showRowContextMenu(row, entry, Number.isFinite(x) ? x : 12, Number.isFinite(y) ? y : 12);
        });
        row.add_controller(rightClick);
    }

    _showRowContextMenu(row, entry, x, y) {
        if (this._rowMenu) {
            try {
                this._rowMenu.popdown();
                this._rowMenu.unparent();
            } catch (_e) {}
            this._rowMenu = null;
        }

        const pop = new Gtk.Popover();
        pop.set_has_arrow(true);
        pop.set_parent(row);
        const rect = new Gdk.Rectangle({ x: Math.floor(x), y: Math.floor(y), width: 1, height: 1 });
        pop.set_pointing_to(rect);

        const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4, margin_top: 6, margin_bottom: 6, margin_start: 6, margin_end: 6 });
        const mk = (label, cb) => {
            const b = new Gtk.Button({ label, halign: Gtk.Align.FILL, hexpand: true });
            b.connect('clicked', () => {
                cb();
                pop.popdown();
            });
            box.append(b);
        };

        mk('Copy', () => this._copyEntry(entry));
        mk('Insert into focused field', () => {
            this._selectedIds.clear();
            this._selectedIds.add(entry.id);
            this._insertSelected(false);
        });
        mk('Insert + Enter', () => {
            this._selectedIds.clear();
            this._selectedIds.add(entry.id);
            this._insertSelected(true);
        });
        mk(entry.pinned ? 'Unpin' : 'Pin', () => this._toggleEntryField(entry.id, 'pinned'));
        mk(entry.starred ? 'Unstar' : 'Star', () => this._toggleEntryField(entry.id, 'starred'));
        mk('Delete', () => this._deleteById(entry.id));
        pop.set_child(box);
        pop.popup();
        this._rowMenu = pop;
    }

    _toggleEntryField(id, field) {
        const target = this._entries.find(e => e.id === id);
        if (!target)
            return;
        target[field] = !target[field];
        this._entries = sortEntries(this._entries);
        saveHistory(this._entries);
        this._rebuildList();
    }

    _deleteById(id) {
        this._entries = this._entries.filter(e => e.id !== id);
        this._selectedIds.delete(id);
        this._entries = sortEntries(this._entries);
        saveHistory(this._entries);
        this._lastReloadSignature = this._buildSignature(this._entries);
        this._rebuildList();
        this._updateStatus();
    }

    _updateStatus(visibleCount = null) {
        const shown = visibleCount === null ? this._visibleEntries().length : visibleCount;
        const total = this._entries.length;
        const selectedCount = this._selectedEntries().length;
        const parts = [];
        parts.push(`${shown} shown / ${total} total`);
        parts.push(`${selectedCount} selected`);
        if (this._lastCopiedId) {
            const entry = this._entries.find(e => e.id === this._lastCopiedId);
            if (entry) {
                const preview = entry.text.length > 36 ? `${entry.text.slice(0, 35)}…` : entry.text;
                parts.push(`last copied: "${preview}"`);
            }
        }
        parts.push('double-click = insert');
        parts.push('right-click = actions');
        this._status.label = parts.join('  •  ');
    }

    vfunc_close_request() {
        if (this._refreshTimer)
            GLib.source_remove(this._refreshTimer);
        if (this._monitor)
            this._monitor.cancel();
        if (this._rowMenu) {
            try { this._rowMenu.unparent(); } catch (_e) {}
            this._rowMenu = null;
        }
        return super.vfunc_close_request();
    }
});

const ClipFlowHistoryApp = GObject.registerClass(
class ClipFlowHistoryApp extends Adw.Application {
    _init() {
        super._init({
            application_id: APP_ID,
            flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
        });
    }

    vfunc_activate() {
        let win = this.active_window;
        if (!win) {
            win = new ClipFlowHistoryWindow(this);
            win.present();
        } else {
            win.present();
            win.unminimize?.();
        }
    }
});

const app = new ClipFlowHistoryApp();
app.run(null);
