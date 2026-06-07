'use strict';

const { GLib, Gio } = imports.gi;

const DIRECT_TYPE_WM_PATTERNS = [
    'codex',
    'openai codex',
    'cursor agent',
    'cursor agents',
    'warp',
    'aider',
    'chatgpt',
    'claude',
    'ghostty',
];

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function isWaylandSession() {
    return Boolean(GLib.getenv('WAYLAND_DISPLAY'));
}

function _spawnWait(argv, stdinText = null) {
    try {
        let flags = Gio.SubprocessFlags.SEARCH_PATH_FROM_ENVP;
        if (stdinText != null)
            flags |= Gio.SubprocessFlags.STDIN_PIPE;
        else
            flags |= Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE;
        const proc = Gio.Subprocess.new(argv, flags);
        if (stdinText != null) {
            const stream = proc.get_stdin_pipe();
            stream.write_all(String(stdinText), null);
            stream.close(null);
        }
        proc.wait(null);
        return proc.get_successful();
    } catch (_e) {
        return false;
    }
}

function _spawnRead(argv) {
    try {
        const proc = Gio.Subprocess.new(
            argv,
            Gio.SubprocessFlags.SEARCH_PATH_FROM_ENVP
                | Gio.SubprocessFlags.STDOUT_PIPE
                | Gio.SubprocessFlags.STDERR_SILENCE
        );
        const [, stdout] = proc.communicate_utf8(null, null);
        proc.wait(null);
        if (!proc.get_successful())
            return '';
        return (stdout || '').trim();
    } catch (_e) {
        return '';
    }
}

function setSystemClipboardPlainText(text) {
    const payload = text == null ? '' : String(text);
    if (isWaylandSession() && GLib.find_program_in_path('wl-copy'))
        return _spawnWait(['wl-copy', '--type', 'text/plain'], payload);
    if (GLib.find_program_in_path('xclip')) {
        if (!_spawnWait(['xclip', '-selection', 'clipboard'], payload))
            return false;
        _spawnWait(['xclip', '-selection', 'primary'], payload);
        return true;
    }
    return false;
}

function getWindowIdentity(windowId) {
    const id = String(windowId || '').trim();
    if (!id || !/^\d+$/.test(id) || !GLib.find_program_in_path('xdotool'))
        return { name: '', cls: '' };
    return {
        name: _spawnRead(['xdotool', 'getwindowname', id]),
        cls: _spawnRead(['xdotool', 'getwindowclassname', id]),
    };
}

function shouldPreferDirectTyping(windowId) {
    const { name, cls } = getWindowIdentity(windowId);
    const hay = `${name} ${cls}`.toLowerCase();
    if (!hay.trim())
        return false;
    return DIRECT_TYPE_WM_PATTERNS.some(pattern => hay.includes(pattern));
}

function activateWindow(windowId) {
    const id = String(windowId || '').trim();
    if (!id || !GLib.find_program_in_path('xdotool'))
        return false;
    return _spawnWait(['xdotool', 'windowactivate', '--sync', id]);
}

function pasteViaKeyboard(windowId) {
    if (windowId)
        activateWindow(windowId);
    return _spawnWait(['xdotool', 'key', '--clearmodifiers', 'ctrl+v'])
        || _spawnWait(['xdotool', 'key', '--clearmodifiers', 'shift+Insert']);
}

function typeText(text, windowId, submit = false) {
    const value = text == null ? '' : String(text);
    if (!value)
        return false;

    if (GLib.find_program_in_path('wtype')) {
        if (windowId)
            activateWindow(windowId);
        if (!_spawnWait(['wtype', value]))
            return false;
        if (submit)
            _spawnWait(['wtype', '\n']);
        return true;
    }

    if (!GLib.find_program_in_path('xdotool'))
        return false;

    if (windowId)
        activateWindow(windowId);

    const lines = value.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 0) {
            if (!_spawnWait(['xdotool', 'type', '--clearmodifiers', '--delay', '12', '--', line]))
                return false;
        }
        if (i < lines.length - 1) {
            if (!_spawnWait(['xdotool', 'key', '--clearmodifiers', 'Return']))
                return false;
        }
    }
    if (submit)
        return _spawnWait(['xdotool', 'key', '--clearmodifiers', 'Return']);
    return true;
}

function insertPlainTextIntoTarget({ text, windowId = '', submit = false, forceDirectType = null }) {
    const value = normalizeText(text);
    if (!value)
        return false;

    setSystemClipboardPlainText(value);

    const wid = String(windowId || '').trim();
    const direct = forceDirectType === true
        || (forceDirectType !== false && shouldPreferDirectTyping(wid));

    if (direct)
        return typeText(value, wid, submit);

    if (GLib.find_program_in_path('xdotool')) {
        if (pasteViaKeyboard(wid)) {
            if (submit)
                _spawnWait(['xdotool', 'key', '--clearmodifiers', 'Return']);
            return true;
        }
    }

    return typeText(value, wid, submit);
}

var exports = {
    normalizeText,
    setSystemClipboardPlainText,
    getWindowIdentity,
    shouldPreferDirectTyping,
    activateWindow,
    pasteViaKeyboard,
    typeText,
    insertPlainTextIntoTarget,
};
