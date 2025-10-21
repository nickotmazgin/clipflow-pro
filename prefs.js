// ClipFlow Pro - Preferences
// Created by Nick Otmazgin

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

export default class ClipFlowProPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // Create pages
        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic'
        });
        
        const shortcutsPage = new Adw.PreferencesPage({
            title: _('Shortcuts'),
            icon_name: 'preferences-desktop-keyboard-shortcuts-symbolic'
        });
        
        const behaviorPage = new Adw.PreferencesPage({
            title: _('Behavior'),
            icon_name: 'applications-system-symbolic'
        });
        
        const appearancePage = new Adw.PreferencesPage({
            title: _('Appearance'),
            icon_name: 'preferences-desktop-theme-symbolic'
        });
        
        const privacyPage = new Adw.PreferencesPage({
            title: _('Privacy'),
            icon_name: 'preferences-system-privacy-symbolic'
        });
        
        const aboutPage = new Adw.PreferencesPage({
            title: _('About'),
            icon_name: 'help-about-symbolic'
        });

        window.add(generalPage);
        window.add(shortcutsPage);
        window.add(behaviorPage);
        window.add(appearancePage);
        window.add(privacyPage);
        window.add(aboutPage);

        // General Settings
        this._buildGeneralPage(generalPage, settings);
        
        // Shortcuts Settings
        this._buildShortcutsPage(shortcutsPage, settings);
        
        // Behavior Settings
        this._buildBehaviorPage(behaviorPage, settings);
        
        // Appearance Settings
        this._buildAppearancePage(appearancePage, settings);
        
        // Privacy Settings
        this._buildPrivacyPage(privacyPage, settings);
        
        // About Page
        this._buildAboutPage(aboutPage);
    }

    _buildGeneralPage(page, settings) {
        // Storage Settings Group
        const storageGroup = new Adw.PreferencesGroup({
            title: _('Storage Settings'),
            description: _('Configure clipboard history storage limits')
        });
        page.add(storageGroup);

        // Max entries
        const maxEntriesRow = new Adw.SpinRow({
            title: _('Maximum Entries'),
            subtitle: _('Maximum number of clipboard entries to keep in history'),
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 1000,
                step_increment: 10,
                page_increment: 50
            })
        });
        settings.bind('max-entries', maxEntriesRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        storageGroup.add(maxEntriesRow);

        // Max entry length
        const maxLengthRow = new Adw.SpinRow({
            title: _('Maximum Entry Length'),
            subtitle: _('Maximum length of individual clipboard entries (characters)'),
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 10000,
                step_increment: 100,
                page_increment: 500
            })
        });
        settings.bind('max-entry-length', maxLengthRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        storageGroup.add(maxLengthRow);

        // Display Settings Group
        const displayGroup = new Adw.PreferencesGroup({
            title: _('Display Settings'),
            description: _('Configure how clipboard entries are displayed')
        });
        page.add(displayGroup);

        // Entries per page
        const entriesPerPageRow = new Adw.SpinRow({
            title: _('Entries Per Page'),
            subtitle: _('Number of clipboard entries to show per page'),
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 50,
                step_increment: 1,
                page_increment: 5
            })
        });
        settings.bind('entries-per-page', entriesPerPageRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        displayGroup.add(entriesPerPageRow);
    }

    _buildShortcutsPage(page, settings) {
        const shortcutsGroup = new Adw.PreferencesGroup({
            title: _('Keyboard Shortcuts'),
            description: _('Customize keyboard shortcuts for clipboard operations')
        });
        page.add(shortcutsGroup);

        // Show menu shortcut
        const showMenuRow = this._createShortcutRow(
            _('Show Clipboard Menu'),
            _('Open the clipboard history menu'),
            'show-menu-shortcut',
            settings
        );
        shortcutsGroup.add(showMenuRow);

        // Copy shortcut
        const copyRow = this._createShortcutRow(
            _('Enhanced Copy'),
            _('Enhanced copy operation'),
            'copy-shortcut',
            settings
        );
        shortcutsGroup.add(copyRow);

        // Paste shortcut
        const pasteRow = this._createShortcutRow(
            _('Enhanced Paste'),
            _('Enhanced paste operation'),
            'paste-shortcut',
            settings
        );
        shortcutsGroup.add(pasteRow);
    }

    _createShortcutRow(title, subtitle, settingKey, settings) {
        const row = new Adw.ActionRow({
            title: title,
            subtitle: subtitle
        });

        const shortcutLabel = new Gtk.ShortcutLabel({
            disabled_text: _('New accelerator…'),
            valign: Gtk.Align.CENTER
        });

        const shortcutButton = new Gtk.Button({
            valign: Gtk.Align.CENTER,
            has_frame: false,
            child: shortcutLabel
        });

        const updateShortcut = () => {
            const shortcut = settings.get_strv(settingKey)[0] || '';
            shortcutLabel.set_accelerator(shortcut);
        };

        updateShortcut();
        settings.connect(`changed::${settingKey}`, updateShortcut);

        shortcutButton.connect('clicked', () => {
            const dialog = new ShortcutDialog(row.get_root(), settingKey, settings);
            dialog.show();
        });

        row.add_suffix(shortcutButton);
        return row;
    }

    _buildBehaviorPage(page, settings) {
        // Auto-copy Settings
        const autoCopyGroup = new Adw.PreferencesGroup({
            title: _('Auto-copy Settings'),
            description: _('Configure automatic copying behavior')
        });
        page.add(autoCopyGroup);

        // Enable auto-copy
        const autoCopyRow = new Adw.SwitchRow({
            title: _('Auto-copy on Selection'),
            subtitle: _('Automatically copy selected text to clipboard')
        });
        settings.bind('enable-auto-copy', autoCopyRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        autoCopyGroup.add(autoCopyRow);

        // Context Menu Integration
        const contextGroup = new Adw.PreferencesGroup({
            title: _('Context Menu Integration'),
            description: _('Enable right-click menu integration')
        });
        page.add(contextGroup);

        // Enable context menu
        const contextMenuRow = new Adw.SwitchRow({
            title: _('Enable Context Menu'),
            subtitle: _('Add clipboard options to right-click context menu')
        });
        settings.bind('enable-context-menu', contextMenuRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        contextGroup.add(contextMenuRow);

        // File manager integration
        const fileIntegrationRow = new Adw.SwitchRow({
            title: _('File Manager Integration'),
            subtitle: _('Add file operations (copy path, open terminal) to context menu')
        });
        settings.bind('enable-file-integration', fileIntegrationRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        contextGroup.add(fileIntegrationRow);
    }

    _buildAppearancePage(page, settings) {
        // Panel Settings
        const panelGroup = new Adw.PreferencesGroup({
            title: _('Panel Settings'),
            description: _('Configure panel icon appearance and position')
        });
        page.add(panelGroup);

        // Panel position
        const panelPositionRow = new Adw.ComboRow({
            title: _('Panel Position'),
            subtitle: _('Position of clipboard icon in the top panel')
        });

        const positionModel = new Gtk.StringList();
        positionModel.append(_('Left'));
        positionModel.append(_('Center'));
        positionModel.append(_('Right'));

        panelPositionRow.set_model(positionModel);

        const currentPosition = settings.get_string('panel-position');
        const positionIndex = {'left': 0, 'center': 1, 'right': 2}[currentPosition] || 2;
        panelPositionRow.set_selected(positionIndex);

        panelPositionRow.connect('notify::selected', () => {
            const positions = ['left', 'center', 'right'];
            settings.set_string('panel-position', positions[panelPositionRow.get_selected()]);
        });

        panelGroup.add(panelPositionRow);

        // Entry Display Settings
        const entryGroup = new Adw.PreferencesGroup({
            title: _('Entry Display'),
            description: _('Configure how clipboard entries are displayed in the menu')
        });
        page.add(entryGroup);

        // Show numbers
        const showNumbersRow = new Adw.SwitchRow({
            title: _('Show Entry Numbers'),
            subtitle: _('Display numbers next to clipboard entries')
        });
        settings.bind('show-numbers', showNumbersRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        entryGroup.add(showNumbersRow);

        // Show preview
        const showPreviewRow = new Adw.SwitchRow({
            title: _('Show Entry Preview'),
            subtitle: _('Show preview of clipboard entry content in menu')
        });
        settings.bind('show-preview', showPreviewRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        entryGroup.add(showPreviewRow);
    }

    _buildPrivacyPage(page, settings) {
        // Security Settings
        const securityGroup = new Adw.PreferencesGroup({
            title: _('Security Settings'),
            description: _('Configure privacy and security options')
        });
        page.add(securityGroup);

        // Ignore passwords
        const ignorePasswordsRow = new Adw.SwitchRow({
            title: _('Ignore Password Fields'),
            subtitle: _('Don\'t save clipboard content from password fields')
        });
        settings.bind('ignore-passwords', ignorePasswordsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        securityGroup.add(ignorePasswordsRow);

        // Clear on logout
        const clearOnLogoutRow = new Adw.SwitchRow({
            title: _('Clear on Logout'),
            subtitle: _('Clear clipboard history when logging out')
        });
        settings.bind('clear-on-logout', clearOnLogoutRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        securityGroup.add(clearOnLogoutRow);
    }

    _buildAboutPage(page) {
        // Extension Info
        const infoGroup = new Adw.PreferencesGroup({
            title: _('ClipFlow Pro'),
            description: _('Advanced clipboard manager for GNOME Shell')
        });
        page.add(infoGroup);

        // Version info
        const versionRow = new Adw.ActionRow({
            title: _('Version'),
            subtitle: '1.0'
        });
        infoGroup.add(versionRow);

        // Developer info
        const developerRow = new Adw.ActionRow({
            title: _('Developer'),
            subtitle: 'Nick Otmazgin'
        });
        infoGroup.add(developerRow);

        // GitHub link
        const githubRow = new Adw.ActionRow({
            title: _('Source Code'),
            subtitle: 'https://github.com/nickotmazgin/clipflow-pro'
        });

        const githubButton = new Gtk.Button({
            icon_name: 'web-browser-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Open GitHub Repository')
        });
        githubButton.connect('clicked', () => {
            Gtk.show_uri(null, 'https://github.com/nickotmazgin/clipflow-pro', Gdk.CURRENT_TIME);
        });
        githubRow.add_suffix(githubButton);
        infoGroup.add(githubRow);

        // Support & Donations
        const supportGroup = new Adw.PreferencesGroup({
            title: _('Support & Donations'),
            description: _('Support the development of ClipFlow Pro')
        });
        page.add(supportGroup);

        // PayPal donation
        const donationRow = new Adw.ActionRow({
            title: _('PayPal Donation'),
            subtitle: _('Support development with a donation')
        });

        const donateButton = new Gtk.Button({
            icon_name: 'emblem-favorite-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: _('Donate via PayPal')
        });
        donateButton.connect('clicked', () => {
            Gtk.show_uri(null, 'https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW', Gdk.CURRENT_TIME);
        });
        donationRow.add_suffix(donateButton);
        supportGroup.add(donationRow);

        // License info
        const licenseGroup = new Adw.PreferencesGroup({
            title: _('License'),
            description: _('This extension is licensed under GPL-3.0-or-later')
        });
        page.add(licenseGroup);

        const licenseRow = new Adw.ActionRow({
            title: _('GPL-3.0-or-later'),
            subtitle: _('Free and open source software')
        });
        licenseGroup.add(licenseRow);
    }
}

// Shortcut Dialog Class
const ShortcutDialog = GObject.registerClass({
    GTypeName: 'ClipFlowShortcutDialog',
    Template: 'resource:///org/gtk/libgtk/ui/gtkshortcutssection.ui',
}, class ShortcutDialog extends Gtk.Dialog {
    _init(parent, settingKey, settings) {
        super._init({
            title: _('Set Shortcut'),
            transient_for: parent,
            modal: true,
            use_header_bar: 1
        });

        this._settingKey = settingKey;
        this._settings = settings;

        const content = this.get_content_area();
        content.set_spacing(12);

        const label = new Gtk.Label({
            label: _('Press the new shortcut keys or Escape to cancel'),
            wrap: true,
            justify: Gtk.Justification.CENTER
        });
        content.append(label);

        const eventController = new Gtk.EventControllerKey();
        eventController.connect('key-pressed', this._onKeyPressed.bind(this));
        this.add_controller(eventController);

        this.set_default_size(400, 200);
    }

    _onKeyPressed(controller, keyval, keycode, state) {
        if (keyval === 65307) { // Escape key
            this.close();
            return true;
        }

        const accelerator = Gtk.accelerator_name(keyval, state);
        if (accelerator) {
            this._settings.set_strv(this._settingKey, [accelerator]);
            this.close();
        }

        return true;
    }
});