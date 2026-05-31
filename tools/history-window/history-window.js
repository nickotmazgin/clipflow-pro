#!/usr/bin/gjs
'use strict';

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

const ByteArray = imports.byteArray;
const { GObject, GLib, Gio, Gtk, Adw, Gdk, Pango } = imports.gi;

const HISTORY_DIR = GLib.build_filenamev([GLib.get_user_config_dir(), 'clipflow-pro']);
const HISTORY_FILE = GLib.build_filenamev([HISTORY_DIR, 'history.json']);
const APP_ID = 'io.github.nickotmazgin.ClipFlowProHistory';

function loadHistory() {
    if (!GLib.file_test(HISTORY_FILE, GLib.FileTest.EXISTS))
        return [];
    try {
        const [, bytes] = GLib.file_get_contents(HISTORY_FILE);
        const raw = ByteArray.toString(bytes);
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .map(e => {
                const text = (e && e.text) ? String(e.text).trim() : '';
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
            .filter(Boolean)
            .sort((a, b) => (b.timestampUnix || 0) - (a.timestampUnix || 0));
    } catch (_e) {
        return [];
    }
}

function saveHistory(entries) {
    GLib.mkdir_with_parents(HISTORY_DIR, 0o700);
    const payload = JSON.stringify(entries, null, 2);
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
    const cmd = GLib.getenv('WAYLAND_DISPLAY') && GLib.find_program_in_path('wl-copy')
        ? 'wl-copy'
        : GLib.find_program_in_path('xclip') ? 'xclip' : null;
    if (!cmd)
        return false;
    try {
        const argv = cmd === 'xclip'
            ? ['xclip', '-selection', 'clipboard']
            : ['wl-copy'];
        const proc = Gio.Subprocess.new(
            argv,
            Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.NONE
        );
        const stream = proc.get_stdin_pipe();
        stream.write_all(text, null);
        stream.close(null);
        proc.wait(null);
        return true;
    } catch (_e) {
        return false;
    }
}

const ClipFlowHistoryWindow = GObject.registerClass(
class ClipFlowHistoryWindow extends Adw.ApplicationWindow {
    _init(app) {
        super._init({ application: app, title: 'ClipFlow Pro — History' });
        this.set_default_size(720, 520);
        this._entries = [];
        this._filter = '';
        this._refreshTimer = 0;
        this._previewTimer = 0;

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
        toolbar.append(mkBtn('Pin', () => this._toggleSelected('pinned')));
        toolbar.append(mkBtn('Star', () => this._toggleSelected('starred')));
        toolbar.append(mkBtn('Delete', () => this._deleteSelected()));
        toolbar.append(mkBtn('Clear all', () => this._clearAll()));

        this._list = Gtk.ListBox.new();
        this._list.set_selection_mode(Gtk.SelectionMode.SINGLE);
        this._list.connect('row-activated', (_lb, row) => {
            const idx = row._cfpIndex;
            if (idx >= 0 && this._entries[idx])
                copyToClipboard(this._entries[idx].text);
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
        const prefsBtn = new Gtk.Button({ icon_name: 'preferences-system-symbolic', tooltip_text: 'ClipFlow settings' });
        prefsBtn.connect('clicked', () => {
            try {
                Gio.Subprocess.new(
                    ['gnome-extensions', 'prefs', 'clipflow-pro@nickotmazgin.github.io'],
                    Gio.SubprocessFlags.NONE
                );
            } catch (_e) {}
        });
        header.pack_end(prefsBtn);

        const panelBtn = new Gtk.Button({ label: 'Panel menu' });
        panelBtn.set_tooltip_text('Tip: left-click the panel icon for the quick menu; this window stays in sync.');
        panelBtn.connect('clicked', () => {
            this.minimize();
        });
        header.pack_start(panelBtn);

        this.set_content(new Adw.ToolbarView());
        this.get_content().add_top_bar(header);
        this.get_content().set_content(content);

        this._reloadFromDisk();
        this._setupFileMonitor();
        this._refreshTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
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

    _rebuildList() {
        const children = [...this._list];
        children.forEach(c => this._list.remove(c));

        const visible = this._visibleEntries();
        visible.forEach((entry, index) => {
            const row = new Gtk.ListBoxRow();
            row._cfpIndex = this._entries.indexOf(entry);

            const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10, margin_top: 6, margin_bottom: 6, margin_start: 8, margin_end: 8 });
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

            const preview = entry.text.length > 120 ? `${entry.text.slice(0, 117)}…` : entry.text;
            const label = new Gtk.Label({
                label: prefix + preview,
                xalign: 0,
                hexpand: true,
                wrap: true,
                wrap_mode: Pango.WrapMode.WORD_CHAR,
                selectable: true,
            });

            box.append(meta);
            box.append(label);
            row.set_child(box);
            this._list.append(row);
        });

        this._status.label = visible.length === this._entries.length
            ? `${this._entries.length} entries — double-click to copy`
            : `${visible.length} of ${this._entries.length} entries — double-click to copy`;
    }

    _reloadFromDisk(quiet = false) {
        const loaded = loadHistory();
        loaded.sort((a, b) => (b.timestampUnix || 0) - (a.timestampUnix || 0));
        this._entries = loaded;
        this._rebuildList();
        if (!quiet && this._entries.length === 0)
            this._status.label = 'No history yet — copy something or use the panel icon.';
    }

    _selectedEntry() {
        const row = this._list.get_selected_row();
        if (!row || row._cfpIndex === undefined || row._cfpIndex < 0)
            return null;
        return this._entries[row._cfpIndex] || null;
    }

    _copySelected() {
        const e = this._selectedEntry();
        if (e)
            copyToClipboard(e.text);
    }

    _toggleSelected(field) {
        const e = this._selectedEntry();
        if (!e)
            return;
        e[field] = !e[field];
        saveHistory(this._entries);
        this._rebuildList();
    }

    _deleteSelected() {
        const e = this._selectedEntry();
        if (!e)
            return;
        this._entries = this._entries.filter(x => x.id !== e.id);
        saveHistory(this._entries);
        this._rebuildList();
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
                saveHistory([]);
                this._rebuildList();
            }
        });
        dialog.present();
    }

    vfunc_close_request() {
        if (this._refreshTimer)
            GLib.source_remove(this._refreshTimer);
        if (this._monitor)
            this._monitor.cancel();
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
