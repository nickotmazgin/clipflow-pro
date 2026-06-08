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
];

const TERMINAL_WM_PATTERNS = [
    'kitty',
    'gnome-terminal',
    'org.gnome.terminal',
    'ptyxis',
    'tilix',
    'konsole',
    'alacritty',
    'wezterm',
    'foot',
    'xterm',
    'rxvt',
    'terminator',
    'ghostty',
    'hyper',
    'st-256color',
    'zorin terminal',
    'vte',
];

const IGNORED_INSERT_WM_PATTERNS = [
    'gnome-shell',
    'mutter',
    'clipflow',
    'clipflowprohistory',
];

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function isWaylandSession() {
    return Boolean(GLib.getenv('WAYLAND_DISPLAY'));
}

function _pauseMs(ms) {
    try {
        GLib.usleep(Math.max(0, ms) * 1000);
    } catch (_e) {}
}

function _withTimeout(argv, seconds = 2) {
    if (GLib.find_program_in_path('timeout'))
        return ['timeout', String(seconds), ...argv];
    return argv;
}

function _spawnWait(argv) {
    try {
        const proc = Gio.Subprocess.new(
            _withTimeout(argv),
            Gio.SubprocessFlags.SEARCH_PATH_FROM_ENVP
                | Gio.SubprocessFlags.STDOUT_SILENCE
                | Gio.SubprocessFlags.STDERR_SILENCE
        );
        proc.wait(null);
        return proc.get_successful();
    } catch (_e) {
        return false;
    }
}

function _spawnWaitWithInputFile(argv, inputPath) {
    const q = String(inputPath).replace(/'/g, `'\\''`);
    const cmd = argv.map(arg => `'${String(arg).replace(/'/g, `'\\''`)}'`).join(' ');
    return _spawnWait(['sh', '-c', `${cmd} < '${q}'`]);
}

function _spawnRead(argv) {
    try {
        const proc = Gio.Subprocess.new(
            _withTimeout(argv),
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

function isValidWindowId(windowId) {
    const id = String(windowId || '').trim();
    if (!id || !/^\d+$/.test(id) || !GLib.find_program_in_path('xdotool'))
        return false;
    return _spawnWait(['xdotool', 'getwindowname', id]);
}

function resolveWindowId(windowId) {
    const id = String(windowId || '').trim();
    if (isValidWindowId(id))
        return id;
    if (!GLib.find_program_in_path('xdotool'))
        return '';
    const active = _spawnRead(['xdotool', 'getactivewindow']);
    return /^\d+$/.test(active) && isValidWindowId(active) ? active : '';
}

function isIgnoredInsertTarget(windowId) {
    const id = String(windowId || '').trim();
    if (!id || !/^\d+$/.test(id))
        return true;
    const { name, cls } = getWindowIdentity(id);
    const hay = `${name} ${cls}`.toLowerCase();
    if (!hay.trim())
        return false;
    return IGNORED_INSERT_WM_PATTERNS.some(pattern => hay.includes(pattern));
}

function resolveInsertTargetWindowId(savedWindowId) {
    if (!GLib.find_program_in_path('xdotool'))
        return resolveWindowId(savedWindowId);

    _pauseMs(300);

    const active = _spawnRead(['xdotool', 'getactivewindow']);
    if (/^\d+$/.test(active) && isValidWindowId(active) && !isIgnoredInsertTarget(active))
        return active;

    const saved = String(savedWindowId || '').trim();
    if (isValidWindowId(saved) && !isIgnoredInsertTarget(saved))
        return saved;

    return /^\d+$/.test(active) && isValidWindowId(active) ? active : '';
}

function setSystemClipboardPlainText(text) {
    const payload = text == null ? '' : String(text);
    const tmp = GLib.build_filenamev([
        GLib.get_tmp_dir(),
        `clipflow-clip-${GLib.random_int()}.txt`,
    ]);
    try {
        GLib.file_set_contents(tmp, payload);
        if (isWaylandSession() && GLib.find_program_in_path('wl-copy'))
            return _spawnWaitWithInputFile(['wl-copy', '--type', 'text/plain'], tmp);
        if (GLib.find_program_in_path('xclip')) {
            if (!_spawnWaitWithInputFile(['xclip', '-selection', 'clipboard'], tmp))
                return false;
            _spawnWaitWithInputFile(['xclip', '-selection', 'primary'], tmp);
            return true;
        }
        return false;
    } finally {
        try {
            GLib.unlink(tmp);
        } catch (_e) {}
    }
}

function getWindowIdentity(windowId) {
    const id = String(windowId || '').trim();
    if (!id || !/^\d+$/.test(id) || !GLib.find_program_in_path('xdotool'))
        return { name: '', cls: '' };
    let cls = '';
    if (GLib.find_program_in_path('xprop'))
        cls = _spawnRead(['xprop', '-id', id, 'WM_CLASS']);
    return {
        name: _spawnRead(['xdotool', 'getwindowname', id]),
        cls,
    };
}

function shouldPreferTerminalPaste(windowId) {
    const { name, cls } = getWindowIdentity(windowId);
    const hay = `${name} ${cls}`.toLowerCase();
    if (!hay.trim())
        return false;
    return TERMINAL_WM_PATTERNS.some(pattern => hay.includes(pattern));
}

function shouldPreferDirectTyping(windowId) {
    if (shouldPreferTerminalPaste(windowId))
        return false;
    const { name, cls } = getWindowIdentity(windowId);
    const hay = `${name} ${cls}`.toLowerCase();
    if (!hay.trim())
        return false;
    return DIRECT_TYPE_WM_PATTERNS.some(pattern => hay.includes(pattern));
}

function terminalPasteShortcut(windowId) {
    const { name, cls } = getWindowIdentity(windowId);
    const hay = `${name} ${cls}`.toLowerCase();
    if (hay.includes('xterm') || hay.includes('rxvt') || hay.includes('st-256color'))
        return 'shift+Insert';
    return 'ctrl+shift+v';
}

function activateWindow(windowId) {
    const id = resolveWindowId(windowId);
    if (!id || !GLib.find_program_in_path('xdotool'))
        return false;
    const ok = _spawnWait(['xdotool', 'windowactivate', '--sync', id]);
    if (ok)
        _pauseMs(220);
    return ok;
}

function pasteViaKeyboard(windowId) {
    const id = resolveWindowId(windowId);
    if (id && !activateWindow(id))
        return false;
    return _spawnWait(['xdotool', 'key', '--clearmodifiers', 'ctrl+v'])
        || _spawnWait(['xdotool', 'key', '--clearmodifiers', 'shift+Insert']);
}

function pasteViaTerminalKeyboard(windowId, submit = false) {
    const id = resolveWindowId(windowId);
    if (!id || !activateWindow(id))
        return false;
    if (!_spawnWait(['xdotool', 'key', '--clearmodifiers', terminalPasteShortcut(id)]))
        return false;
    if (submit)
        _spawnWait(['xdotool', 'key', '--clearmodifiers', 'Return']);
    return true;
}

function typeText(text, windowId, submit = false, resolveTarget = true) {
    const value = text == null ? '' : String(text);
    if (!value)
        return false;

    const id = resolveTarget ? resolveInsertTargetWindowId(windowId) : resolveWindowId(windowId);

    if (GLib.find_program_in_path('wtype')) {
        if (id && !activateWindow(id))
            return false;
        if (!_spawnWait(['wtype', value]))
            return false;
        if (submit)
            _spawnWait(['wtype', '\n']);
        return true;
    }

    if (!GLib.find_program_in_path('xdotool'))
        return false;

    if (id && !activateWindow(id))
        return false;

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

    if (!setSystemClipboardPlainText(value))
        return typeText(value, windowId, submit);

    const wid = resolveInsertTargetWindowId(windowId);
    if (!wid)
        return false;
    const terminal = shouldPreferTerminalPaste(wid);
    const direct = !terminal && (
        forceDirectType === true
        || (forceDirectType !== false && shouldPreferDirectTyping(wid))
    );

    if (terminal)
        return pasteViaTerminalKeyboard(wid, submit);

    if (direct)
        return typeText(value, wid, submit, false);

    if (GLib.find_program_in_path('xdotool')) {
        if (pasteViaKeyboard(wid)) {
            if (submit)
                _spawnWait(['xdotool', 'key', '--clearmodifiers', 'Return']);
            return true;
        }
    }

    return typeText(value, wid, submit, false);
}

var exports = {
    normalizeText,
    setSystemClipboardPlainText,
    getWindowIdentity,
    shouldPreferDirectTyping,
    shouldPreferTerminalPaste,
    isValidWindowId,
    resolveWindowId,
    resolveInsertTargetWindowId,
    activateWindow,
    pasteViaKeyboard,
    pasteViaTerminalKeyboard,
    typeText,
    insertPlainTextIntoTarget,
};
