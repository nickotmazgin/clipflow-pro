'use strict';

// GNOME 45-50 ES module entrypoint.

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { enable as legacyEnable, disable as legacyDisable } from './legacy.js';
const _noerr = () => {};

export default class ClipFlowProExtension extends Extension {
  constructor(metadata) {
    super(metadata);
  }

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
