'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const {St, GObject} = imports.gi;

var ClipFlowIndicator = GObject.registerClass(
class ClipFlowIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'ClipFlow Pro Debug');
        
        log('ClipFlow Pro Debug: Creating indicator');
        
        this._createIcon();
        this._buildMenu();
        
        log('ClipFlow Pro Debug: Indicator created successfully');
    }

    _createIcon() {
        this._icon = new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._icon);
        log('ClipFlow Pro Debug: Icon created');
    }

    _buildMenu() {
        const testItem = new PopupMenu.PopupMenuItem('ClipFlow Pro Debug - Working!');
        this.menu.addMenuItem(testItem);
        log('ClipFlow Pro Debug: Menu built');
    }

    destroy() {
        log('ClipFlow Pro Debug: Destroying indicator');
        super.destroy();
    }
});

class Extension {
    enable() {
        try {
            log('ClipFlow Pro Debug: Extension enable() called');
            
            this._indicator = new ClipFlowIndicator();
            log('ClipFlow Pro Debug: Indicator created');
            
            // Try to add to panel
            Main.panel.addToStatusArea('clipflow-pro-debug', this._indicator, 1, 'right');
            log('ClipFlow Pro Debug: Added to status area');
            
            Main.notify('ClipFlow Pro Debug', 'Extension enabled successfully');
            log('ClipFlow Pro Debug: Extension enabled successfully');
        } catch (e) {
            log(`ClipFlow Pro Debug: Extension enable error: ${e.message}`);
            log(`ClipFlow Pro Debug: Stack trace: ${e.stack}`);
        }
    }

    disable() {
        log('ClipFlow Pro Debug: Extension disable() called');
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        log('ClipFlow Pro Debug: Extension disabled');
    }
}

function init() {
    log('ClipFlow Pro Debug: init() called');
    return new Extension();
}

