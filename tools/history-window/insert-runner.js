#!/usr/bin/gjs
'use strict';

const { GLib } = imports.gi;
const ByteArray = imports.byteArray;

imports.searchPath.unshift(GLib.path_get_dirname(GLib.path_get_dirname(imports.system.programInvocationName)));
const ClipboardInsert = imports.clipboardInsert;

function _decodePayload() {
    const filePath = (GLib.getenv('CLIPFLOW_INSERT_FILE') || '').trim();
    if (filePath && GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
        try {
            const [, bytes] = GLib.file_get_contents(filePath);
            const parsed = JSON.parse(ByteArray.toString(bytes));
            return {
                text: typeof parsed.text === 'string' ? parsed.text : '',
                windowId: typeof parsed.windowId === 'string' ? parsed.windowId : '',
                submit: !!parsed.submit,
            };
        } catch (_e) {
        } finally {
            try {
                GLib.unlink(filePath);
            } catch (_e) {}
        }
    }

    const b64 = (GLib.getenv('CLIPFLOW_INSERT_B64') || '').trim();
    if (b64) {
        try {
            return {
                text: ByteArray.toString(GLib.base64_decode(b64), 'UTF-8'),
                windowId: GLib.getenv('CLIPFLOW_INSERT_TARGET_WID') || '',
                submit: GLib.getenv('CLIPFLOW_INSERT_SUBMIT') === '1',
            };
        } catch (_e) {}
    }

    return {
        text: GLib.getenv('CLIPFLOW_INSERT_TEXT') || '',
        windowId: GLib.getenv('CLIPFLOW_INSERT_TARGET_WID') || '',
        submit: GLib.getenv('CLIPFLOW_INSERT_SUBMIT') === '1',
    };
}

const payload = _decodePayload();
const text = payload.text;
const windowId = payload.windowId;
const submit = payload.submit;

let ok = false;
if (text.trim()) {
    ok = ClipboardInsert.insertPlainTextIntoTarget({
        text,
        windowId,
        submit,
    });
}
imports.system.exit(ok ? 0 : 1);
