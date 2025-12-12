'use strict';

// GNOME 45–47 ES module entrypoint (pure ESM).

import { Extension } from 'resource:///org/gnome/Shell/Extensions/js/extensions/extension.js';
import { enable as legacyEnable, disable as legacyDisable } from './legacy.js';
const _noerr = () => {};

export default class ClipFlowProExtension extends Extension {
  enable() {
    try {
      legacyEnable();
    } catch (e) { _noerr(); }
  }

  disable() {
    try {
      legacyDisable();
    } catch (e) { _noerr(); }
  }
}
