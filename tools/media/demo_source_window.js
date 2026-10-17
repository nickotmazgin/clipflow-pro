#!/usr/bin/gjs -m
// Demo "copy source" window for ClipFlow Pro videos.
// Shows the demo entries and copies them to the clipboard one by one, so a
// recording shows each copy happening. Usage:
//   gjs -m demo_source_window.js <entries.json> <interval-ms> <start-delay-ms>
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Pango from 'gi://Pango';
import System from 'system';

const [entriesPath, intervalArg = '1600', delayArg = '1500'] = ARGV;
const [, bytes] = GLib.file_get_contents(entriesPath);
const entries = JSON.parse(new TextDecoder().decode(bytes));
const intervalMs = Number(intervalArg);
const startDelayMs = Number(delayArg);

const app = new Gtk.Application({ application_id: 'io.github.nickotmazgin.ClipFlowDemoSource' });

app.connect('activate', () => {
    const win = new Gtk.ApplicationWindow({
        application: app,
        title: 'Demo — text to copy',
        default_width: 640,
        default_height: 760,
    });
    const list = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.SINGLE });
    list.add_css_class('boxed-list');
    const rows = entries.map(text => {
        const label = new Gtk.Label({
            label: text,
            xalign: 0,
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD_CHAR,
            margin_top: 8, margin_bottom: 8, margin_start: 12, margin_end: 12,
        });
        const row = new Gtk.ListBoxRow({ child: label });
        list.append(row);
        return row;
    });
    const header = new Gtk.Label({
        label: '<b>Copying demo entries…</b>',
        use_markup: true,
        xalign: 0,
        margin_top: 12, margin_bottom: 8, margin_start: 12,
    });
    const scroll = new Gtk.ScrolledWindow({ vexpand: true, child: list });
    const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
    box.append(header);
    box.append(scroll);
    win.set_child(box);
    win.present();

    const clipboard = Gdk.Display.get_default().get_clipboard();
    let index = 0;
    const copyNext = () => {
        if (index >= rows.length) {
            header.set_markup('<b>Done — every line is now in ClipFlow Pro.</b>');
            return GLib.SOURCE_REMOVE;
        }
        const row = rows[index];
        list.select_row(row);
        row.grab_focus();
        clipboard.set(entries[index]);
        header.set_markup(`<b>Copied ${index + 1} / ${rows.length}</b>`);
        index++;
        return GLib.SOURCE_CONTINUE;
    };
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, startDelayMs, () => {
        copyNext();
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, copyNext);
        return GLib.SOURCE_REMOVE;
    });
});

app.run([System.programInvocationName]);
