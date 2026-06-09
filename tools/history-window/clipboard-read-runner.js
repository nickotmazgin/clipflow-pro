#!/usr/bin/gjs
'use strict';

const { GLib, Gio } = imports.gi;

function _withTimeout(argv) {
    const timeout = GLib.find_program_in_path('timeout');
    return timeout ? [timeout, '1', ...argv] : argv;
}

function _read(argv) {
    try {
        const process = Gio.Subprocess.new(
            _withTimeout(argv),
            Gio.SubprocessFlags.SEARCH_PATH_FROM_ENVP
                | Gio.SubprocessFlags.STDOUT_PIPE
                | Gio.SubprocessFlags.STDERR_SILENCE
        );
        const [ok, stdout] = process.communicate_utf8(null, null);
        return ok && process.get_successful() ? (stdout || '') : null;
    } catch (_e) {
        return null;
    }
}

const selection = GLib.getenv('CLIPFLOW_READ_SELECTION') === 'primary'
    ? 'primary'
    : 'clipboard';

let text = null;
if (GLib.getenv('WAYLAND_DISPLAY') && GLib.find_program_in_path('wl-paste')) {
    text = _read(['wl-paste', '--no-newline', '--type', 'text']);
} else if (GLib.find_program_in_path('xclip')) {
    const targets = ['UTF8_STRING', 'text/plain;charset=utf-8', 'STRING'];
    for (const target of targets) {
        text = _read(['xclip', '-selection', selection, '-target', target, '-out']);
        if (text !== null)
            break;
    }
}

if (text !== null)
    print(text);
imports.system.exit(text !== null ? 0 : 1);
