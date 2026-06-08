#!/usr/bin/gjs
'use strict';

const { GLib } = imports.gi;
const ByteArray = imports.byteArray;

imports.searchPath.unshift(GLib.path_get_dirname(GLib.path_get_dirname(imports.system.programInvocationName)));
const ClipboardInsert = imports.clipboardInsert;

function _decodeEnvText() {
    const b64 = (GLib.getenv('CLIPFLOW_CLIPBOARD_B64') || '').trim();
    if (b64) {
        try {
            return ByteArray.toString(GLib.base64_decode(b64), 'UTF-8');
        } catch (_e) {}
    }
    return GLib.getenv('CLIPFLOW_CLIPBOARD_TEXT') || '';
}

const text = _decodeEnvText();
const ok = text.length > 0 && ClipboardInsert.setSystemClipboardPlainText(text);
imports.system.exit(ok ? 0 : 1);
