#!/usr/bin/env python3
"""Generate the GNOME 45+ ES module entrypoint from the legacy runtime."""

from __future__ import annotations

import argparse
from pathlib import Path


LEGACY_HEADER = """'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, GObject, GLib, Gio, Clutter, Meta, Shell, Pango} = imports.gi;

const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;
"""

ESM_HEADER = """import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

let _extension = null;
"""

LEGACY_SETTINGS = "_settings = ExtensionUtils.getSettings();"
ESM_SETTINGS = "_settings = _extension.getSettings();"
LEGACY_VERTICAL = "vertical: true"
LEGACY_HORIZONTAL = "vertical: false"

ESM_CLASS = """

export default class ClipFlowProExtension extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    enable() {
        _extension = this;
        enable();
    }

    disable() {
        try {
            disable();
        } finally {
            _extension = null;
        }
    }
}
"""


def convert_legacy_to_esm(source: str) -> str:
    if LEGACY_HEADER not in source:
        raise SystemExit("legacy extension header did not match expected imports block")

    converted = source.replace(LEGACY_HEADER, ESM_HEADER, 1)
    if LEGACY_SETTINGS not in converted:
        raise SystemExit("legacy settings lookup did not match expected statement")

    converted = converted.replace(LEGACY_SETTINGS, ESM_SETTINGS, 1)
    converted = converted.replace(LEGACY_VERTICAL, "orientation: Clutter.Orientation.VERTICAL")
    converted = converted.replace(LEGACY_HORIZONTAL, "orientation: Clutter.Orientation.HORIZONTAL")
    converted = converted.rstrip() + ESM_CLASS
    return converted


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()

    source = args.source.read_text(encoding="utf-8")
    output = convert_legacy_to_esm(source)

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_text(output, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
