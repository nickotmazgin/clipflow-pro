'use strict';

// GNOME 45–47 ES module entrypoint (pure ESM).

import { Extension } from 'resource:///org/gnome/Shell/Extensions/js/extensions/extension.js';
import { enable as legacyEnable, disable as legacyDisable } from './legacy.js';

export default class ClipFlowProExtension extends Extension {
  enable() {
    try {
      legacyEnable();
    } catch (e) {
      console?.error?.('ClipFlow Pro (ESM) enable failed:', e);
    }
  }

  disable() {
    try {
      legacyDisable();
    } catch (e) {
      console?.error?.('ClipFlow Pro (ESM) disable failed:', e);
    }
  }
}
