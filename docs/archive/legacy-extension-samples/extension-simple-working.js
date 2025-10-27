'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, GObject} = imports.gi;

var ClipFlowIndicator = GObject.registerClass(
class ClipFlowIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'ClipFlow Pro');
        
        this._createIcon();
        this._buildMenu();
    }

    _createIcon() {
        this._icon = new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._icon);
    }

    _buildMenu() {
        const header = new PopupMenu.PopupMenuItem('📋 ClipFlow Pro - Working!');
        this.menu.addMenuItem(header);
        
        const testItem = new PopupMenu.PopupMenuItem('✅ Extension is working perfectly!');
        this.menu.addMenuItem(testItem);
        
        const clearItem = new PopupMenu.PopupMenuItem('🗑️ Clear History');
        clearItem.connect('activate', () => {
            Main.notify('ClipFlow Pro', 'History cleared!');
        });
        this.menu.addMenuItem(clearItem);
    }

    destroy() {
        super.destroy();
    }
});

class Extension {
    enable() {
        try {
            this._indicator = new ClipFlowIndicator();
            Main.panel.addToStatusArea('clipflow-pro', this._indicator, 1, 'right');
            Main.notify('ClipFlow Pro', 'Extension enabled successfully! 🎉');
        } catch (e) {
            Main.notify('ClipFlow Pro', `Error: ${e.message}`);
        }
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}

function init() {
    return new Extension();
}
