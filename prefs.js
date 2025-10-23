'use strict';

const { GObject, Gtk, Gio, GLib, Pango } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

function init() {
    ExtensionUtils.initTranslations();
}

const ClipFlowProPrefsWidget = GObject.registerClass(
class ClipFlowProPrefsWidget extends Gtk.Box {
    _init(params) {
        super._init(params);
        
        this._settings = ExtensionUtils.getSettings();
        this._buildUI();
    }

    _buildUI() {
        this.set_orientation(Gtk.Orientation.VERTICAL);
        this.set_margin_start(20);
        this.set_margin_end(20);
        this.set_margin_top(20);
        this.set_margin_bottom(20);

        // Create notebook for tabs
        this._notebook = new Gtk.Notebook();
        this._notebook.set_tab_pos(Gtk.PositionType.TOP);
        this.append(this._notebook);

        // Add tabs
        this._addGeneralTab();
        this._addBehaviorTab();
        this._addAppearanceTab();
        this._addShortcutsTab();
        this._addAboutTab();
    }

    _addGeneralTab() {
        const generalBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        
        // Header
        const header = this._createSectionHeader('General Settings');
        generalBox.append(header);

        // History Management
        const historyFrame = this._createFrame('History Management');
        const historyBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        historyFrame.set_child(historyBox);

        // Max entries
        const maxEntriesBox = this._createSpinRow(
            'Maximum Entries',
            'Maximum number of clipboard entries to keep in history',
            'max-entries',
            10, 1000, 50
        );
        historyBox.append(maxEntriesBox);

        // Max entry length
        const maxLengthBox = this._createSpinRow(
            'Maximum Entry Length',
            'Maximum characters per clipboard entry',
            'max-entry-length',
            100, 10000, 1000
        );
        historyBox.append(maxLengthBox);

        // Entries per page
        const entriesPerPageBox = this._createSpinRow(
            'Entries Per Page',
            'Number of entries to show per page in the menu',
            'entries-per-page',
            5, 50, 10
        );
        historyBox.append(entriesPerPageBox);

        // Clear history button
        const clearButton = new Gtk.Button({ label: 'Clear All History' });
        clearButton.set_halign(Gtk.Align.START);
        clearButton.add_css_class('destructive-action');
        clearButton.connect('clicked', () => this._clearHistory());
        historyBox.append(clearButton);

        generalBox.append(historyFrame);

        // Privacy & Security
        const privacyFrame = this._createFrame('Privacy & Security');
        const privacyBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        privacyFrame.set_child(privacyBox);

        // Ignore passwords
        const ignorePasswordsBox = this._createSwitchRow(
            'Ignore Passwords',
            'Don\'t save clipboard content that looks like passwords',
            'ignore-passwords'
        );
        privacyBox.append(ignorePasswordsBox);

        // Clear on logout
        const clearOnLogoutBox = this._createSwitchRow(
            'Clear on Logout',
            'Clear clipboard history when logging out',
            'clear-on-logout'
        );
        privacyBox.append(clearOnLogoutBox);

        // Auto-clear sensitive data
        const autoClearSensitiveBox = this._createSwitchRow(
            'Auto-clear Sensitive Data',
            'Automatically remove password-like entries after 5 minutes',
            'auto-clear-sensitive'
        );
        privacyBox.append(autoClearSensitiveBox);

        generalBox.append(privacyFrame);

        // Compatibility Settings
        const compatibilityFrame = this._createFrame('Compatibility');
        const compatibilityBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        compatibilityFrame.set_child(compatibilityBox);

        // Detect other clipboard managers
        const detectManagersBox = this._createSwitchRow(
            'Detect Other Clipboard Managers',
            'Automatically detect and warn about potential conflicts with other clipboard managers like CopyQ',
            'detect-other-clipboard-managers'
        );
        compatibilityBox.append(detectManagersBox);

        // Disable auto-copy if conflict
        const disableAutoCopyBox = this._createSwitchRow(
            'Disable Auto-copy if Conflict Detected',
            'Automatically disable auto-copy functionality if another clipboard manager is detected to prevent conflicts',
            'disable-auto-copy-if-conflict'
        );
        compatibilityBox.append(disableAutoCopyBox);

        generalBox.append(compatibilityFrame);

        // Add to notebook
        this._notebook.append_page(generalBox, new Gtk.Label({ label: 'General' }));
    }

    _addBehaviorTab() {
        const behaviorBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        
        // Header
        const header = this._createSectionHeader('Behavior Settings');
        behaviorBox.append(header);

        // Auto-copy Settings
        const autoCopyFrame = this._createFrame('Auto-copy Settings');
        const autoCopyBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        autoCopyFrame.set_child(autoCopyBox);

        // Enable auto-copy
        const autoCopyBox_switch = this._createSwitchRow(
            'Enable Auto-copy on Selection',
            'When you select/highlight text anywhere, it will automatically be copied to your clipboard and added to ClipFlow Pro history. This works in any application - text editors, web browsers, documents, etc.',
            'enable-auto-copy'
        );
        autoCopyBox.append(autoCopyBox_switch);

        // Enhanced selection
        const enhancedSelBox = this._createSwitchRow(
            'Enhanced Selection Notifications',
            'Show desktop notifications when text is automatically copied from selection. This helps you know when ClipFlow Pro has captured your selected text.',
            'enhanced-selection'
        );
        autoCopyBox.append(enhancedSelBox);

        behaviorBox.append(autoCopyFrame);

        // Mouse Actions
        const mouseFrame = this._createFrame('Mouse Actions');
        const mouseBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        mouseFrame.set_child(mouseBox);

        // Enable middle-click
        const middleClickBox = this._createSwitchRow(
            'Enable Middle Mouse Button',
            'Enable middle mouse button for clipboard operations',
            'enable-middle-click'
        );
        mouseBox.append(middleClickBox);

        // Middle-click action
        const middleClickActionBox = this._createComboRow(
            'Middle-click Action',
            'Action to perform when middle mouse button is clicked',
            'middle-click-action',
            [
                ['paste', 'Paste Most Recent'],
                ['copy-recent', 'Copy Most Recent'],
                ['show-menu', 'Show Menu']
            ]
        );
        mouseBox.append(middleClickActionBox);

        behaviorBox.append(mouseFrame);

        // Panel Position
        const panelFrame = this._createFrame('Panel Position');
        const panelBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        panelFrame.set_child(panelBox);

        const panelPositionBox = this._createComboRow(
            'Panel Icon Position',
            'Position of clipboard icon in the top panel',
            'panel-position',
            [
                ['left', 'Left'],
                ['center', 'Center'],
                ['right', 'Right']
            ]
        );
        panelBox.append(panelPositionBox);

        behaviorBox.append(panelFrame);

        // Add to notebook
        this._notebook.append_page(behaviorBox, new Gtk.Label({ label: 'Behavior' }));
    }

    _addAppearanceTab() {
        const appearanceBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        
        // Header
        const header = this._createSectionHeader('Appearance Settings');
        appearanceBox.append(header);

        // Display Options
        const displayFrame = this._createFrame('Display Options');
        const displayBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        displayFrame.set_child(displayBox);

        // Show numbers
        const showNumbersBox = this._createSwitchRow(
            'Show Entry Numbers',
            'Display numbers next to clipboard entries',
            'show-numbers'
        );
        displayBox.append(showNumbersBox);

        // Show preview
        const showPreviewBox = this._createSwitchRow(
            'Show Entry Preview',
            'Show preview of clipboard entry content in menu',
            'show-preview'
        );
        displayBox.append(showPreviewBox);

        // Show timestamps
        const showTimestampsBox = this._createSwitchRow(
            'Show Entry Timestamps',
            'Display when each clipboard entry was copied',
            'show-timestamps'
        );
        displayBox.append(showTimestampsBox);

        appearanceBox.append(displayFrame);

        // Menu Styling
        const styleFrame = this._createFrame('Menu Styling');
        const styleBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        styleFrame.set_child(styleBox);

        // Theme info
        const themeInfo = new Gtk.Label({
            label: 'ClipFlow Pro automatically adapts to your GNOME theme.\nThe menu will match your system\'s dark/light mode preference.',
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD
        });
        themeInfo.set_halign(Gtk.Align.START);
        styleBox.append(themeInfo);

        appearanceBox.append(styleFrame);

        // Add to notebook
        this._notebook.append_page(appearanceBox, new Gtk.Label({ label: 'Appearance' }));
    }

    _addShortcutsTab() {
        const shortcutsBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        
        // Header
        const header = this._createSectionHeader('Keyboard Shortcuts');
        shortcutsBox.append(header);

        // Shortcuts Frame
        const shortcutsFrame = this._createFrame('Keyboard Shortcuts');
        const shortcutsListBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        shortcutsFrame.set_child(shortcutsListBox);

        // Show menu shortcut
        const showMenuBox = this._createShortcutRow(
            'Show Clipboard Menu',
            'Open the clipboard history menu',
            'show-menu-shortcut',
            '<Super><Shift>v'
        );
        shortcutsListBox.append(showMenuBox);

        // Enhanced copy shortcut
        const copyShortcutBox = this._createShortcutRow(
            'Enhanced Copy',
            'Copy selected text to clipboard history',
            'enhanced-copy-shortcut',
            '<Super>c'
        );
        shortcutsListBox.append(copyShortcutBox);

        // Enhanced paste shortcut
        const pasteShortcutBox = this._createShortcutRow(
            'Enhanced Paste',
            'Paste with formatting cleanup',
            'enhanced-paste-shortcut',
            '<Super>v'
        );
        shortcutsListBox.append(pasteShortcutBox);

        shortcutsBox.append(shortcutsFrame);

        // Shortcut info
        const infoBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5
        });
        const infoLabel = new Gtk.Label({
            label: 'Note: You can change these shortcuts in GNOME Settings > Keyboard > Shortcuts > Custom Shortcuts',
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD
        });
        infoLabel.set_halign(Gtk.Align.START);
        infoBox.append(infoLabel);

        shortcutsBox.append(infoBox);

        // Add to notebook
        this._notebook.append_page(shortcutsBox, new Gtk.Label({ label: 'Shortcuts' }));
    }

    _addAboutTab() {
        const aboutBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20
        });
        
        // Header
        const header = this._createSectionHeader('About ClipFlow Pro');
        aboutBox.append(header);

        // App info
        const appInfoFrame = this._createFrame('Application Information');
        const appInfoBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        appInfoFrame.set_child(appInfoBox);

        // Description
        const description = new Gtk.Label({
            label: 'ClipFlow Pro is an advanced clipboard manager for GNOME Shell that provides intelligent organization, search capabilities, and comprehensive clipboard history management.',
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD
        });
        description.set_halign(Gtk.Align.START);
        appInfoBox.append(description);

        // Version info
        const versionBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        const versionLabel = new Gtk.Label({ label: 'Version:' });
        const versionValue = new Gtk.Label({ label: '1.0.0' });
        versionBox.append(versionLabel);
        versionBox.append(versionValue);
        appInfoBox.append(versionBox);

        // Developer info
        const developerBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        const developerLabel = new Gtk.Label({ label: 'Developer:' });
        const developerValue = new Gtk.Label({ label: 'Nick Otmazgin' });
        developerBox.append(developerLabel);
        developerBox.append(developerValue);
        appInfoBox.append(developerBox);

        aboutBox.append(appInfoFrame);

        // Links
        const linksFrame = this._createFrame('Links');
        const linksBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        linksFrame.set_child(linksBox);

        // GitHub link
        const githubButton = new Gtk.Button({ label: 'GitHub Repository' });
        githubButton.set_halign(Gtk.Align.START);
        githubButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/nickotmazgin/clipflow-pro', null);
        });
        linksBox.append(githubButton);

        // PayPal link
        const paypalButton = new Gtk.Button({ label: 'Donate via PayPal' });
        paypalButton.set_halign(Gtk.Align.START);
        paypalButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri('https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW', null);
        });
        linksBox.append(paypalButton);

        aboutBox.append(linksFrame);

        // Features
        const featuresFrame = this._createFrame('Features');
        const featuresBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5
        });
        featuresFrame.set_child(featuresBox);

        const features = [
            '• Advanced clipboard history management',
            '• Intelligent search and filtering',
            '• Pin and star system for important entries',
            '• Auto-copy on text selection',
            '• Password detection and filtering',
            '• File manager integration',
            '• Keyboard shortcuts support',
            '• Middle-click actions',
            '• Pagination support',
            '• GNOME theme integration'
        ];

        features.forEach(feature => {
            const featureLabel = new Gtk.Label({ label: feature });
            featureLabel.set_halign(Gtk.Align.START);
            featuresBox.append(featureLabel);
        });

        aboutBox.append(featuresFrame);

        // Add to notebook
        this._notebook.append_page(aboutBox, new Gtk.Label({ label: 'About' }));
    }

    _createSectionHeader(title) {
        const header = new Gtk.Label({ label: title });
        header.set_markup(`<span size="large" weight="bold">${title}</span>`);
        header.set_halign(Gtk.Align.START);
        return header;
    }

    _createFrame(title) {
        const frame = new Gtk.Frame();
        frame.set_label(title);
        frame.set_margin_top(10);
        frame.set_margin_bottom(10);
        return frame;
    }

    _createSwitchRow(title, description, settingKey) {
        const box = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        
        const labelBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        const titleLabel = new Gtk.Label({ label: title });
        titleLabel.set_halign(Gtk.Align.START);
        const descLabel = new Gtk.Label({ label: description });
        descLabel.set_halign(Gtk.Align.START);
        descLabel.set_wrap(true);
        descLabel.set_wrap_mode(Pango.WrapMode.WORD);
        descLabel.add_css_class('dim-label');
        
        labelBox.append(titleLabel);
        labelBox.append(descLabel);
        
        const switch_widget = new Gtk.Switch();
        switch_widget.set_halign(Gtk.Align.END);
        switch_widget.set_valign(Gtk.Align.CENTER);
        
        // Bind to setting
        this._settings.bind(settingKey, switch_widget, 'active', Gio.SettingsBindFlags.DEFAULT);
        
        box.append(labelBox);
        box.append(switch_widget);
        
        return box;
    }

    _createSpinRow(title, description, settingKey, min, max, default_val) {
        const box = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        
        const labelBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        const titleLabel = new Gtk.Label({ label: title });
        titleLabel.set_halign(Gtk.Align.START);
        const descLabel = new Gtk.Label({ label: description });
        descLabel.set_halign(Gtk.Align.START);
        descLabel.set_wrap(true);
        descLabel.set_wrap_mode(Pango.WrapMode.WORD);
        descLabel.add_css_class('dim-label');
        
        labelBox.append(titleLabel);
        labelBox.append(descLabel);
        
        const spinBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5
        });
        const spinButton = new Gtk.SpinButton();
        spinButton.set_range(min, max);
        spinButton.set_increments(1, 10);
        spinButton.set_value(this._settings.get_int(settingKey));
        
        // Bind to setting
        this._settings.bind(settingKey, spinButton, 'value', Gio.SettingsBindFlags.DEFAULT);
        
        spinBox.append(spinButton);
        
        box.append(labelBox);
        box.append(spinBox);
        
        return box;
    }

    _createComboRow(title, description, settingKey, options) {
        const box = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        
        const labelBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        const titleLabel = new Gtk.Label({ label: title });
        titleLabel.set_halign(Gtk.Align.START);
        const descLabel = new Gtk.Label({ label: description });
        descLabel.set_halign(Gtk.Align.START);
        descLabel.set_wrap(true);
        descLabel.set_wrap_mode(Pango.WrapMode.WORD);
        descLabel.add_css_class('dim-label');
        
        labelBox.append(titleLabel);
        labelBox.append(descLabel);
        
        const comboBox = Gtk.DropDown.new_from_strings(options.map(opt => opt[1]));
        comboBox.set_halign(Gtk.Align.END);
        
        // Set current value
        const currentValue = this._settings.get_string(settingKey);
        const currentIndex = options.findIndex(opt => opt[0] === currentValue);
        if (currentIndex >= 0) {
            comboBox.set_selected(currentIndex);
        }
        
        // Connect to setting
        comboBox.connect('notify::selected', () => {
            const selectedIndex = comboBox.get_selected();
            if (selectedIndex >= 0 && selectedIndex < options.length) {
                this._settings.set_string(settingKey, options[selectedIndex][0]);
            }
        });
        
        box.append(labelBox);
        box.append(comboBox);
        
        return box;
    }

    _createShortcutRow(title, description, settingKey, defaultShortcut) {
        const box = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        
        const labelBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        const titleLabel = new Gtk.Label({ label: title });
        titleLabel.set_halign(Gtk.Align.START);
        const descLabel = new Gtk.Label({ label: description });
        descLabel.set_halign(Gtk.Align.START);
        descLabel.set_wrap(true);
        descLabel.set_wrap_mode(Pango.WrapMode.WORD);
        descLabel.add_css_class('dim-label');
        
        labelBox.append(titleLabel);
        labelBox.append(descLabel);
        
        const shortcutLabel = new Gtk.Label({ label: defaultShortcut });
        shortcutLabel.set_halign(Gtk.Align.END);
        shortcutLabel.add_css_class('monospace');
        
        box.append(labelBox);
        box.append(shortcutLabel);
        
        return box;
    }

    _clearHistory() {
        const dialog = new Gtk.MessageDialog({
            transient_for: this.get_root(),
            modal: true,
            message_type: Gtk.MessageType.WARNING,
            buttons: Gtk.ButtonsType.YES_NO,
            text: 'Clear All History',
            secondary_text: 'Are you sure you want to clear all clipboard history? This action cannot be undone.'
        });
        
        dialog.connect('response', (dialog, response) => {
            if (response === Gtk.ResponseType.YES) {
                // Clear the history file
                try {
                    const configDir = GLib.get_user_config_dir();
                    const historyFile = GLib.build_filenamev([configDir, 'clipflow-pro', 'history.json']);
                    if (GLib.file_test(historyFile, GLib.FileTest.EXISTS)) {
                        GLib.unlink(historyFile);
                    }
                } catch (e) {
                    log(`ClipFlow Pro: Error clearing history: ${e}`);
                }
            }
            dialog.destroy();
        });
        
        dialog.present();
    }
});

function buildPrefsWidget() {
    return new ClipFlowProPrefsWidget();
}