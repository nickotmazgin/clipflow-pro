'use strict';

// GNOME 45–47 ES module entrypoint.
// Bridges to the legacy implementation kept in legacy.js to avoid a large, risky port.
// This satisfies the 45+ requirement to inherit from Extension while retaining behavior.

import { Extension } from 'resource:///org/gnome/Shell/Extensions/js/extensions/extension.js';

export default class ClipFlowProExtension extends Extension {
  enable() {
    try {
      // Access the extension namespace and import the legacy module.
      // Using imports here is acceptable for bridging and keeps the runtime stable.
      const ExtensionUtils = imports.misc.extensionUtils;
      const Me = ExtensionUtils.getCurrentExtension();
      this._legacy = Me.imports.legacy;
      if (this._legacy && typeof this._legacy.enable === 'function')
        this._legacy.enable();
    } catch (e) {
      // Avoid throwing from enable(); let GNOME Shell surface errors minimally.
      // eslint-disable-next-line no-console
      console?.error?.('ClipFlow Pro (ESM) enable failed:', e);
    }
  }

  disable() {
    try {
      if (this._legacy && typeof this._legacy.disable === 'function')
        this._legacy.disable();
    } catch (e) {
      // eslint-disable-next-line no-console
      console?.error?.('ClipFlow Pro (ESM) disable failed:', e);
    } finally {
      this._legacy = null;
    }
  }
}

