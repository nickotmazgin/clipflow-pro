'use strict';

const { GObject, Gtk, Gio, GLib, Pango, Gdk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

function init() {
    ExtensionUtils.initTranslations();
}

function _createPreferencesWidget() {
    return new ClipFlowProPrefsWidget({
        orientation: Gtk.Orientation.VERTICAL
    });
}

function buildPrefsWidget() {
    return _createPreferencesWidget();
}

function fillPreferencesWindow(window) {
    const widget = _createPreferencesWidget();
    widget.set_hexpand(true);
    widget.set_vexpand(true);

    if (typeof window.set_default_size === 'function') {
        window.set_default_size(920, 640);
    }

    if (typeof window.set_content === 'function') {
        window.set_content(widget);
    } else if (typeof window.set_child === 'function') {
        window.set_child(widget);
    } else if (typeof window.add === 'function') {
        window.add(widget);
    }
}

const ClipFlowProPrefsWidget = GObject.registerClass(
class ClipFlowProPrefsWidget extends Gtk.Box {
    _init(params) {
        super._init(params);
        
        this._settings = ExtensionUtils.getSettings();
        this._shortcutRows = new Map();
        this._tabIndexLookup = new Map();
        this._settingsSignals = [];
        this._buildUI();
    }

    vfunc_dispose() {
        if (this._settings && this._settingsSignals) {
            this._settingsSignals.forEach(id => this._settings.disconnect(id));
            this._settingsSignals = [];
        }

        this._shortcutRows?.clear();
        super.vfunc_dispose();
    }

    _buildUI() {
        this.set_orientation(Gtk.Orientation.VERTICAL);
        this.set_spacing(20);
        this.set_margin_start(20);
        this.set_margin_end(20);
        this.set_margin_top(20);
        this.set_margin_bottom(20);
        this.set_hexpand(true);
        this.set_vexpand(true);

        // Create notebook for tabs
        this._notebook = new Gtk.Notebook();
        this._notebook.set_tab_pos(Gtk.PositionType.TOP);
        this._notebook.set_margin_top(12);
        this._notebook.set_margin_bottom(12);
        this._notebook.set_margin_start(6);
        this._notebook.set_margin_end(6);
        this._notebook.set_hexpand(true);
        this._notebook.set_vexpand(true);

        if (!this._settings) {
            this._renderMissingSchemaMessage();
            return;
        }

        this.append(this._notebook);

        // Add tabs
        this._addGeneralTab();
        this._addBehaviorTab();
        this._addAppearanceTab();
        this._addShortcutsTab();
        this._addAboutTab();
        this._applyInitialTab();
    }

    _addGeneralTab() {
        const generalBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        generalBox.set_margin_top(12);
        
        // Header
        const header = this._createSectionHeader(_('General Settings'));
        generalBox.append(header);

        // History Management
        const historyFrame = this._createFrame(_('History Management'));
        const historyBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        historyFrame.set_child(historyBox);

        // Max entries
        const maxEntriesBox = this._createSpinRow(
            _('Maximum Entries'),
            _('Maximum number of clipboard entries to keep in history'),
            'max-entries',
            10, 100, 50
        );
        historyBox.append(maxEntriesBox);

        // Max entry length
        const maxLengthBox = this._createSpinRow(
            _('Maximum Entry Length'),
            _('Maximum characters per clipboard entry'),
            'max-entry-length',
            100, 10000, 1000
        );
        historyBox.append(maxLengthBox);

        // Minimum entry length
        const minLengthBox = this._createSpinRow(
            _('Minimum Entry Length'),
            _('Ignore entries shorter than this length'),
            'min-entry-length',
            0, 100, 1
        );
        historyBox.append(minLengthBox);

        // Entries per page
        const entriesPerPageBox = this._createSpinRow(
            _('Entries Per Page'),
            _('Number of entries to show per page in the menu'),
            'entries-per-page',
            5, 50, 10
        );
        historyBox.append(entriesPerPageBox);

        const legacyRowsSwitch = this._createSwitchRow(
            _('Use Legacy Menu Rows'),
            _('Render the clipboard menu using the older popup layout in case the new Wayland-safe view has issues on your Shell version.'),
            'use-legacy-menu-items'
        );
        historyBox.append(legacyRowsSwitch);

        // Clear history button
        const clearButton = new Gtk.Button({ label: _('Clear All History') });
        clearButton.set_halign(Gtk.Align.START);
        clearButton.add_css_class('destructive-action');
        clearButton.connect('clicked', () => this._clearHistory());
        historyBox.append(clearButton);

        generalBox.append(historyFrame);

        // Privacy & Security
        const privacyFrame = this._createFrame(_('Privacy & Security'));
        const privacyBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        privacyFrame.set_child(privacyBox);

        // Ignore passwords
        const ignorePasswordsBox = this._createSwitchRow(
            _('Ignore Passwords'),
            _("Don't save clipboard content that looks like passwords. Uses a simple heuristic to detect password-like strings (e.g., contains the word 'password') and prevents them from being saved to history."),
            'ignore-passwords'
        );
        privacyBox.append(ignorePasswordsBox);

        // Clear on logout
        const clearOnLogoutBox = this._createSwitchRow(
            _('Clear on Logout'),
            _('Clear clipboard history when logging out'),
            'clear-on-logout'
        );
        privacyBox.append(clearOnLogoutBox);

        // Auto-clear sensitive data
        const autoClearSensitiveBox = this._createSwitchRow(
            _('Auto-clear Sensitive Data'),
            _('Automatically remove password-like entries after 5 minutes. Any entry detected as sensitive will be automatically deleted from the history 5 minutes after it was copied.'),
            'auto-clear-sensitive'
        );
        privacyBox.append(autoClearSensitiveBox);

        generalBox.append(privacyFrame);

        // Diagnostics
        const diagnosticsFrame = this._createFrame(_('Diagnostics'));
        const diagnosticsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        diagnosticsFrame.set_child(diagnosticsBox);

        const debugLoggingRow = this._createSwitchRow(
            _('Enable Debug Logging'),
            _('Write extra information to GNOME Shell logs to help troubleshoot problems'),
            'enable-debug-logs'
        );
        diagnosticsBox.append(debugLoggingRow);

        const selfCheckButton = new Gtk.Button({ label: _('Run self-check and log environment info') });
        selfCheckButton.set_halign(Gtk.Align.START);
        selfCheckButton.connect('clicked', () => this._runSelfCheck());
        diagnosticsBox.append(selfCheckButton);

        generalBox.append(diagnosticsFrame);

        // Add to notebook
        this._notebook.append_page(generalBox, new Gtk.Label({ label: _('General') }));
        this._setTabIndex('general', this._notebook.get_n_pages() - 1);
    }

    _addBehaviorTab() {
        const behaviorBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        behaviorBox.set_margin_top(12);
        
        // Header
        const header = this._createSectionHeader(_('Behavior Settings'));
        behaviorBox.append(header);

        // Notifications
        const notifyFrame = this._createFrame(_('Notifications'));
        const notifyBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        notifyFrame.set_child(notifyBox);

        const notificationSwitch = this._createSwitchRow(
            _('Show Notifications'),
            _('Display a GNOME notification when ClipFlow Pro copies an entry'),
            'show-copy-notifications'
        );
        notifyBox.append(notificationSwitch);

        const showCopiedPreview = this._createSwitchRow(
            _('Show Copied Preview'),
            _('Include a short preview of copied text in notifications'),
            'show-copied-preview'
        );
        notifyBox.append(showCopiedPreview);

        const previewLen = this._createSpinRow(
            _('Copied Preview Length'),
            _('Characters to show in copy notification preview'),
            'copied-preview-length',
            10, 200, 40
        );
        notifyBox.append(previewLen);

        behaviorBox.append(notifyFrame);

        // Panel Position
        const panelFrame = this._createFrame(_('Panel Position'));
        const panelBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        panelFrame.set_child(panelBox);

        const panelPositionBox = this._createComboRow(
            _('Panel Icon Position'),
            _('Position of clipboard icon in the top panel'),
            'panel-position',
            [
                ['left', _('Left')],
                ['center', _('Center')],
                ['right', _('Right')]
            ]
        );
        panelBox.append(panelPositionBox);

        behaviorBox.append(panelFrame);

        // Clipboard Behavior
        const clipFrame = this._createFrame(_('Clipboard Behavior'));
        const clipBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        clipFrame.set_child(clipBox);

        const capturePrimaryBox = this._createSwitchRow(
            _('Capture PRIMARY Selection'),
            _('Also capture selections from the PRIMARY buffer'),
            'capture-primary'
        );
        clipBox.append(capturePrimaryBox);

        const dedupeModeBox = this._createComboRow(
            _('Duplicate Handling'),
            _('Choose how to handle duplicate entries'),
            'dedupe-mode',
            [
                ['ignore', _('Ignore duplicates')],
                ['promote', _('Move duplicate to top')]
            ]
        );
        clipBox.append(dedupeModeBox);

        const pauseDurationBox = this._createSpinRow(
            _('Pause Duration (minutes)'),
            _('Default duration for Pause Monitoring action'),
            'pause-duration-minutes',
            1, 120, 5
        );
        clipBox.append(pauseDurationBox);

        behaviorBox.append(clipFrame);

        // Add to notebook
        this._notebook.append_page(behaviorBox, new Gtk.Label({ label: _('Behavior') }));
        this._setTabIndex('behavior', this._notebook.get_n_pages() - 1);
    }

    _addAppearanceTab() {
        const appearanceBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        appearanceBox.set_margin_top(12);
        
        // Header
        const header = this._createSectionHeader(_('Appearance Settings'));
        appearanceBox.append(header);

        // Display Options
        const displayFrame = this._createFrame(_('Display Options'));
        const displayBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        displayFrame.set_child(displayBox);

        // Show numbers
        const showNumbersBox = this._createSwitchRow(
            _('Show Entry Numbers'),
            _('Display numbers next to clipboard entries'),
            'show-numbers'
        );
        displayBox.append(showNumbersBox);

        // Show preview
        const showPreviewBox = this._createSwitchRow(
            _('Show Entry Preview'),
            _('Show preview of clipboard entry content in menu'),
            'show-preview'
        );
        displayBox.append(showPreviewBox);

        // Show timestamps
        const showTimestampsBox = this._createSwitchRow(
            _('Show Entry Timestamps'),
            _('Display when each clipboard entry was copied'),
            'show-timestamps'
        );
        displayBox.append(showTimestampsBox);

        appearanceBox.append(displayFrame);

        // Menu Styling
        const styleFrame = this._createFrame(_('Menu Styling'));
        const styleBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        styleFrame.set_child(styleBox);

        // Theme info
        const themeInfo = new Gtk.Label({
            label: _('ClipFlow Pro automatically adapts to your GNOME theme.\nThe menu will match your system\'s dark/light mode preference.'),
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD
        });
        themeInfo.set_halign(Gtk.Align.START);
        styleBox.append(themeInfo);

        const compactToggle = this._createSwitchRow(
            _('Use Compact UI Layout'),
            _('Switch back to the slimmer legacy spacing and lighter backgrounds instead of the modern boxed look.'),
            'use-compact-ui'
        );
        styleBox.append(compactToggle);

        appearanceBox.append(styleFrame);

        // App Exclusions
        const exclFrame = this._createFrame(_('App Exclusions'));
        const exclBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        exclFrame.set_child(exclBox);

        const exclRow = this._createTextRow(
            _('Ignore Apps (comma-separated)'),
            _('App names or IDs to ignore when capturing (e.g., Passwords, org.keepassxc.keepassxc)'),
            'ignore-apps'
        );
        exclBox.append(exclRow);
        appearanceBox.append(exclFrame);

        // Panel Icon
        const iconFrame = this._createFrame(_('Panel Icon'));
        const iconBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        iconFrame.set_child(iconBox);

        const iconSizeOverride = this._createSpinRow(
            _('Icon Size Override (px)'),
            _('0 = auto-size based on panel height and scale'),
            'icon-size-override',
            0, 64, 0
        );
        iconBox.append(iconSizeOverride);

        appearanceBox.append(iconFrame);

        // Add to notebook
        this._notebook.append_page(appearanceBox, new Gtk.Label({ label: _('Appearance') }));
        this._setTabIndex('appearance', this._notebook.get_n_pages() - 1);
    }

    _addShortcutsTab() {
        const shortcutsBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        shortcutsBox.set_margin_top(12);
        
        // Header
        const header = this._createSectionHeader(_('Keyboard Shortcuts'));
        shortcutsBox.append(header);

        // Shortcuts Frame
        const shortcutsFrame = this._createFrame(_('Keyboard Shortcuts'));
        const shortcutsListBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        shortcutsFrame.set_child(shortcutsListBox);

        // Show menu shortcut
        const showMenuBox = this._createShortcutRow(
            _('Show Clipboard Menu'),
            _('Open the clipboard history menu'),
            'show-menu-shortcut',
            '<Super><Shift>v'
        );
        shortcutsListBox.append(showMenuBox);

        // Enhanced copy shortcut
        const copyShortcutBox = this._createShortcutRow(
            _('Enhanced Copy'),
            _('Copy selected text to clipboard history'),
            'enhanced-copy-shortcut',
            '<Super>c'
        );
        shortcutsListBox.append(copyShortcutBox);

        // Enhanced paste shortcut
        const pasteShortcutBox = this._createShortcutRow(
            _('Enhanced Paste'),
            _('Paste with formatting cleanup'),
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
            label: _('Tip: Click a shortcut above to record a new combination. Use Clear to remove it.'),
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD
        });
        infoLabel.set_halign(Gtk.Align.START);
        infoBox.append(infoLabel);

        shortcutsBox.append(infoBox);

        // Add to notebook
        this._notebook.append_page(shortcutsBox, new Gtk.Label({ label: _('Shortcuts') }));
        this._setTabIndex('shortcuts', this._notebook.get_n_pages() - 1);
    }

    _addAboutTab() {
        const aboutBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20
        });
        aboutBox.set_margin_top(12);
        
        // Header
        const header = this._createSectionHeader(_('About ClipFlow Pro'));
        aboutBox.append(header);

        // App info
        const appInfoFrame = this._createFrame(_('Application Information'));
        const appInfoBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15
        });
        appInfoFrame.set_child(appInfoBox);

        // Description
        const description = new Gtk.Label({
            label: _('ClipFlow Pro is a powerful and intelligent clipboard manager for GNOME Shell that provides comprehensive clipboard history management with advanced features like intelligent organization, search capabilities, pin/star functionality, and privacy protection.'),
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
        const versionLabel = new Gtk.Label({ label: _('Version:') });
        const versionValue = new Gtk.Label({
            label: Me.metadata['version-name'] || String(Me.metadata.version ?? ''),
        });
        versionBox.append(versionLabel);
        versionBox.append(versionValue);
        appInfoBox.append(versionBox);

        // Developer info
        const developerBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        const developerLabel = new Gtk.Label({ label: _('Developer:') });
        const developerValue = new Gtk.Label({ label: 'Nick Otmazgin' });
        developerBox.append(developerLabel);
        developerBox.append(developerValue);
        appInfoBox.append(developerBox);

        // Contact info
        const contactBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        const contactLabel = new Gtk.Label({ label: _('Contact:') });
        const contactValue = new Gtk.Label({ 
            label: '<a href="mailto:nickotmazgin.dev@gmail.com">nickotmazgin.dev@gmail.com</a>',
            use_markup: true
        });
        contactBox.append(contactLabel);
        contactBox.append(contactValue);
        appInfoBox.append(contactBox);

        // License info
        const licenseBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        const licenseLabel = new Gtk.Label({ label: _('License:') });
        const licenseValue = new Gtk.Label({ 
            label: '<a href="https://github.com/nickotmazgin/clipflow-pro/blob/main/LICENSE">GPL-3.0-or-later</a>',
            use_markup: true
        });
        licenseBox.append(licenseLabel);
        licenseBox.append(licenseValue);
        appInfoBox.append(licenseBox);

        // Copyright info
        const copyrightBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        const copyrightLabel = new Gtk.Label({ label: _('Copyright:') });
        const copyrightValue = new Gtk.Label({ label: '© 2025 Nick Otmazgin' });
        copyrightBox.append(copyrightLabel);
        copyrightBox.append(copyrightValue);
        appInfoBox.append(copyrightBox);

        aboutBox.append(appInfoFrame);

        // Links
        const linksFrame = this._createFrame(_('Links'));
        const linksBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10
        });
        linksFrame.set_child(linksBox);

        // GitHub link
        const githubButton = new Gtk.Button({ label: _('GitHub Repository') });
        githubButton.set_halign(Gtk.Align.START);
        githubButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/nickotmazgin/clipflow-pro', null);
        });
        linksBox.append(githubButton);

        // README link
        const readmeButton = new Gtk.Button({ label: _('Read Documentation (README.md)') });
        readmeButton.set_halign(Gtk.Align.START);
        readmeButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/nickotmazgin/clipflow-pro/blob/main/README.md', null);
        });
        linksBox.append(readmeButton);

        // PayPal link
        const paypalButton = new Gtk.Button({ label: _('Donate via PayPal') });
        paypalButton.set_halign(Gtk.Align.START);
        paypalButton.connect('clicked', () => {
            Gio.AppInfo.launch_default_for_uri('https://www.paypal.com/donate/?hosted_button_id=4HM44VH47LSMW', null);
        });
        linksBox.append(paypalButton);

        aboutBox.append(linksFrame);

        // Features
        const featuresFrame = this._createFrame(_('Features'));
        const featuresBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5
        });
        featuresFrame.set_child(featuresBox);

        const features = [
            _('• Advanced clipboard history management'),
            _('• Intelligent search and filtering with debouncing'),
            _('• Pin and star system for important entries'),
            _('• Smart content type detection (URLs, emails, code)'),
            _('• Password detection and filtering'),
            _('• Secure local-only storage with privacy protection'),
            _('• Keyboard shortcuts support'),
            _('• Search-aware pagination'),
            _('• GNOME theme integration'),
            _('• Auto-clear sensitive data option')
        ];

        features.forEach(feature => {
            const featureLabel = new Gtk.Label({ label: feature });
            featureLabel.set_halign(Gtk.Align.START);
            featuresBox.append(featureLabel);
        });

        aboutBox.append(featuresFrame);

        // Add to notebook
        this._notebook.append_page(aboutBox, new Gtk.Label({ label: _('About') }));
        this._setTabIndex('about', this._notebook.get_n_pages() - 1);
    }

    _renderMissingSchemaMessage() {
        const messageBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            vexpand: true,
            spacing: 12
        });
        const titleText = _('ClipFlow Pro');
        const title = new Gtk.Label({ use_markup: true });
        title.set_markup(`<b>${GLib.markup_escape_text(titleText, -1)}</b>`);
        title.set_halign(Gtk.Align.START);
        title.set_xalign(0);

        const body = new Gtk.Label({
            label: _('Settings schema not found. Run the build script and reinstall the extension.'),
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD,
            xalign: 0
        });
        body.set_halign(Gtk.Align.START);
        body.add_css_class('dim-label');

        messageBox.append(title);
        messageBox.append(body);
        this.append(messageBox);
    }

    _setTabIndex(name, index) {
        if (!this._tabIndexLookup) {
            this._tabIndexLookup = new Map();
        }
        this._tabIndexLookup.set(name, index);
    }

    _resolveTabIndex(target) {
        if (!target || !this._tabIndexLookup || !this._tabIndexLookup.has(target)) {
            return null;
        }
        return this._tabIndexLookup.get(target);
    }

    _applyInitialTab() {
        try {
            const schema = this._settings.settings_schema;
            if (!schema || typeof schema.has_key !== 'function' || !schema.has_key('target-prefs-tab')) {
                return;
            }

            const target = this._settings.get_string('target-prefs-tab');
            const tabIndex = this._resolveTabIndex(target);

            if (typeof tabIndex === 'number') {
                this._notebook.set_current_page(tabIndex);
            }

            this._settings.set_string('target-prefs-tab', 'general');
        } catch (e) {
            log(`ClipFlow Pro: Failed to apply initial preferences tab: ${e.message}`);
        }
    }

    _createSectionHeader(title) {
        const header = new Gtk.Label({ label: title });
        header.set_markup(`<span size="large" weight="bold">${title}</span>`);
        header.set_halign(Gtk.Align.START);
        return header;
    }

    _createFrame(title) {
        const frame = new Gtk.Frame({ label: title });
        frame.set_margin_top(10);
        frame.set_margin_bottom(10);
        frame.set_margin_start(6);
        frame.set_margin_end(6);
        frame.set_hexpand(true);
        return frame;
    }

    _createSwitchRow(title, description, settingKey) {
        const box = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });
        box.set_hexpand(true);
        box.set_halign(Gtk.Align.FILL);
        box.set_margin_top(6);
        box.set_margin_bottom(6);
        
        const labelBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        labelBox.set_hexpand(true);
        labelBox.set_valign(Gtk.Align.CENTER);
        labelBox.set_margin_end(12);
        const titleLabel = new Gtk.Label({ use_markup: true });
        titleLabel.set_markup(`<b>${GLib.markup_escape_text(title, -1)}</b>`);
        titleLabel.set_halign(Gtk.Align.START);
        titleLabel.set_xalign(0);
        const descLabel = new Gtk.Label({ label: description });
        descLabel.set_halign(Gtk.Align.START);
        descLabel.set_wrap(true);
        descLabel.set_wrap_mode(Pango.WrapMode.WORD);
        descLabel.add_css_class('dim-label');
        descLabel.set_xalign(0);
        
        labelBox.append(titleLabel);
        labelBox.append(descLabel);
        
        const switch_widget = new Gtk.Switch();
        switch_widget.set_halign(Gtk.Align.END);
        switch_widget.set_valign(Gtk.Align.CENTER);
        switch_widget.set_hexpand(false);
        
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
        box.set_hexpand(true);
        box.set_halign(Gtk.Align.FILL);
        box.set_margin_top(6);
        box.set_margin_bottom(6);
        
        const labelBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2
        });
        labelBox.set_hexpand(true);
        labelBox.set_valign(Gtk.Align.CENTER);
        labelBox.set_margin_end(12);
        const titleLabel = new Gtk.Label({ use_markup: true });
        titleLabel.set_markup(`<b>${GLib.markup_escape_text(title, -1)}</b>`);
        titleLabel.set_halign(Gtk.Align.START);
        titleLabel.set_xalign(0);
        const descLabel = new Gtk.Label({ label: description });
        descLabel.set_halign(Gtk.Align.START);
        descLabel.set_wrap(true);
        descLabel.set_wrap_mode(Pango.WrapMode.WORD);
        descLabel.add_css_class('dim-label');
        descLabel.set_xalign(0);
        
        labelBox.append(titleLabel);
        labelBox.append(descLabel);
        
        const spinBox = new Gtk.Box({ 
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5
        });
        spinBox.set_hexpand(false);
        spinBox.set_valign(Gtk.Align.CENTER);
        const spinButton = new Gtk.SpinButton();
        spinButton.set_range(min, max);
        spinButton.set_increments(1, 10);
        spinButton.set_value(this._settings.get_int(settingKey));
        spinButton.set_digits(0);
        spinButton.set_width_chars(5);
        spinButton.set_alignment(1);
        spinButton.set_hexpand(false);
        spinButton.set_valign(Gtk.Align.CENTER);
        
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
            spacing: 10,
            hexpand: true,
            halign: Gtk.Align.FILL,
            margin_top: 6,
            margin_bottom: 6,
        });

        const labelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
            valign: Gtk.Align.CENTER,
            margin_end: 12,
        });

        const titleLabel = new Gtk.Label({
            use_markup: true,
            label: `<b>${GLib.markup_escape_text(title, -1)}</b>`,
            halign: Gtk.Align.START,
            xalign: 0,
        });

        const descLabel = new Gtk.Label({
            label: description,
            halign: Gtk.Align.START,
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD,
            css_classes: ['dim-label'],
            xalign: 0,
        });

        labelBox.append(titleLabel);
        labelBox.append(descLabel);

        const labels = options.map(opt => opt[1]);
        const valueToIndex = new Map(options.map(([value], index) => [value, index]));
        const indexToValue = options.map(opt => opt[0]);

        const comboBox = Gtk.DropDown.new_from_strings(labels);
        comboBox.set_halign(Gtk.Align.END);
        comboBox.set_hexpand(false);
        comboBox.set_valign(Gtk.Align.CENTER);
        comboBox.set_size_request(220, -1);

        const applySelectionFromSettings = () => {
            const currentValue = this._settings.get_string(settingKey);
            const targetIndex = valueToIndex.has(currentValue) ? valueToIndex.get(currentValue) : 0;
            if (comboBox.get_selected() !== targetIndex) {
                comboBox.set_selected(targetIndex);
            }
        };

        applySelectionFromSettings();

        const signalId = this._settings.connect(`changed::${settingKey}`, () => {
            applySelectionFromSettings();
        });
        this._settingsSignals.push(signalId);

        comboBox.connect('notify::selected', () => {
            const selectedIndex = comboBox.get_selected();
            if (selectedIndex < 0 || selectedIndex >= indexToValue.length)
                return;

            const selectedValue = indexToValue[selectedIndex];
            if (this._settings.get_string(settingKey) !== selectedValue) {
                this._settings.set_string(settingKey, selectedValue);
            }
        });

        box.append(labelBox);
        box.append(comboBox);

        return box;
    }

    _createTextRow(title, description, settingKey) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });
        box.set_hexpand(true);
        box.set_halign(Gtk.Align.FILL);
        box.set_margin_top(6);
        box.set_margin_bottom(6);

        const labelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
        });
        labelBox.set_hexpand(true);
        labelBox.set_valign(Gtk.Align.CENTER);
        labelBox.set_margin_end(12);

        const titleLabel = new Gtk.Label({ use_markup: true });
        titleLabel.set_markup(`<b>${GLib.markup_escape_text(title, -1)}</b>`);
        titleLabel.set_halign(Gtk.Align.START);
        titleLabel.set_xalign(0);

        const descLabel = new Gtk.Label({ label: description });
        descLabel.set_halign(Gtk.Align.START);
        descLabel.set_wrap(true);
        descLabel.set_wrap_mode(Pango.WrapMode.WORD);
        descLabel.add_css_class('dim-label');
        descLabel.set_xalign(0);

        labelBox.append(titleLabel);
        labelBox.append(descLabel);

        const entry = new Gtk.Entry();
        entry.set_hexpand(false);
        entry.set_valign(Gtk.Align.CENTER);
        entry.set_width_chars(36);
        entry.set_text(this._settings.get_string(settingKey));
        entry.connect('changed', () => {
            this._settings.set_string(settingKey, entry.get_text());
        });

        box.append(labelBox);
        box.append(entry);

        return box;
    }

    _createShortcutRow(title, description, settingKey, defaultShortcut) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
        });
        box.set_hexpand(true);
        box.set_halign(Gtk.Align.FILL);
        box.set_margin_top(6);
        box.set_margin_bottom(6);

        const labelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
        });
        labelBox.set_hexpand(true);
        labelBox.set_valign(Gtk.Align.CENTER);
        labelBox.set_margin_end(12);

        const titleLabel = new Gtk.Label({ use_markup: true });
        titleLabel.set_markup(`<b>${GLib.markup_escape_text(title, -1)}</b>`);
        titleLabel.set_halign(Gtk.Align.START);
        titleLabel.set_xalign(0);

        const descLabel = new Gtk.Label({ label: description });
        descLabel.set_halign(Gtk.Align.START);
        descLabel.set_xalign(0);
        descLabel.set_wrap(true);
        descLabel.set_wrap_mode(Pango.WrapMode.WORD);
        descLabel.add_css_class('dim-label');

        labelBox.append(titleLabel);
        labelBox.append(descLabel);

        const controlsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
        });
        controlsBox.set_hexpand(false);
        controlsBox.set_valign(Gtk.Align.CENTER);

        const shortcutButton = new Gtk.Button({
            label: _('Not set'),
        });
        shortcutButton.set_halign(Gtk.Align.END);
        shortcutButton.set_receives_default(false);
        shortcutButton.set_tooltip_text(_('Click to set a new shortcut'));

        const clearButton = new Gtk.Button({
            label: _('Clear'),
        });
        clearButton.set_halign(Gtk.Align.END);
        clearButton.set_sensitive(false);
        clearButton.set_tooltip_text(_('Remove the custom shortcut.'));

        controlsBox.append(shortcutButton);
        controlsBox.append(clearButton);

        box.append(labelBox);
        box.append(controlsBox);

        shortcutButton.connect('clicked', () => this._captureShortcut(settingKey));
        clearButton.connect('clicked', () => {
            this._settings.set_strv(settingKey, []);
            this._updateShortcutRow(settingKey);
        });

        const signalId = this._settings.connect(`changed::${settingKey}`, () => {
            this._updateShortcutRow(settingKey);
        });
        this._settingsSignals.push(signalId);

        this._shortcutRows.set(settingKey, {
            button: shortcutButton,
            clearButton,
            defaultShortcut,
        });
        this._updateShortcutRow(settingKey);

        return box;
    }

    _updateShortcutRow(settingKey) {
        if (!this._shortcutRows.has(settingKey))
            return;

        const row = this._shortcutRows.get(settingKey);
        const shortcuts = this._settings.get_strv(settingKey) || [];
        const activeBinding = shortcuts.find(binding => binding && binding.length);
        const label = this._acceleratorToLabel(activeBinding);

        if (label) {
            row.button.set_label(label);
            row.button.set_tooltip_text(_('Click to change this shortcut'));
        } else {
            row.button.set_label(_('Not set'));
            if (row.defaultShortcut) {
                const fallbackLabel = this._acceleratorToLabel(row.defaultShortcut);
                if (fallbackLabel)
                    row.button.set_tooltip_text(_('Suggested default: %s').format(fallbackLabel));
                else
                    row.button.set_tooltip_text(_('Click to set a new shortcut'));
            } else {
                row.button.set_tooltip_text(_('Click to set a new shortcut'));
            }
        }

        row.clearButton.set_sensitive(Boolean(activeBinding));
    }

    _acceleratorToLabel(accel) {
        if (!accel)
            return null;

        const [keyval, mods] = Gtk.accelerator_parse(accel);
        if (!keyval)
            return null;

        const modMask = Gtk.accelerator_get_default_mod_mask();
        const sanitizedMods = mods & modMask;

        if (!Gtk.accelerator_valid(keyval, sanitizedMods))
            return null;

        return Gtk.accelerator_get_label(keyval, sanitizedMods);
    }

    _captureShortcut(settingKey) {
        const dialog = new Gtk.Dialog({
            title: _('Set Shortcut'),
            transient_for: this.get_root(),
            modal: true,
        });
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.set_default_response(Gtk.ResponseType.CANCEL);
        dialog.set_resizable(false);

        const content = dialog.get_content_area();
        content.set_spacing(12);
        content.set_margin_top(16);
        content.set_margin_bottom(16);
        content.set_margin_start(16);
        content.set_margin_end(16);

        const message = new Gtk.Label({
            label: _('Press the new keyboard shortcut now…'),
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD_CHAR,
        });
        message.set_halign(Gtk.Align.CENTER);
        message.set_xalign(0.5);

        const hint = new Gtk.Label({
            label: _('Include Ctrl, Alt, or Super with your key. Press Esc to cancel or Backspace to clear.'),
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD_CHAR,
        });
        hint.set_halign(Gtk.Align.CENTER);
        hint.add_css_class('dim-label');

        content.append(message);
        content.append(hint);

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_controller, keyval, keycode, state) => {
            if (keyval === Gdk.KEY_Escape) {
                dialog.response(Gtk.ResponseType.CANCEL);
                return Gdk.EVENT_STOP;
            }

            if (keyval === Gdk.KEY_BackSpace) {
                this._settings.set_strv(settingKey, []);
                this._updateShortcutRow(settingKey);
                dialog.response(Gtk.ResponseType.OK);
                return Gdk.EVENT_STOP;
            }

            const modifierMask = Gtk.accelerator_get_default_mod_mask();
            const modifiers = state & modifierMask;

            if (!Gtk.accelerator_valid(keyval, modifiers))
                return Gdk.EVENT_STOP;

            const requiredModifiers = Gdk.ModifierType.CONTROL_MASK |
                                      Gdk.ModifierType.MOD1_MASK |
                                      Gdk.ModifierType.SUPER_MASK |
                                      Gdk.ModifierType.META_MASK |
                                      Gdk.ModifierType.HYPER_MASK;

            if ((modifiers & requiredModifiers) === 0)
                return Gdk.EVENT_STOP;

            const display = dialog.get_display();
            const accelerator = Gtk.accelerator_name_with_keycode(display, keyval, keycode, modifiers);

            if (!accelerator)
                return Gdk.EVENT_STOP;

            this._settings.set_strv(settingKey, [accelerator]);
            this._updateShortcutRow(settingKey);
            dialog.response(Gtk.ResponseType.OK);

            return Gdk.EVENT_STOP;
        });

        dialog.add_controller(controller);
        dialog.connect('response', () => dialog.destroy());
        dialog.present();
    }

    _clearHistory() {
        const dialog = new Gtk.Dialog({
            title: _('Clear All History'),
            transient_for: this.get_root(),
            modal: true
        });

        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Clear'), Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.CANCEL);

        const content = dialog.get_content_area();
        content.set_spacing(12);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const message = new Gtk.Label({
            label: _('Are you sure you want to clear all clipboard history? This action cannot be undone.'),
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD_CHAR
        });
        message.set_halign(Gtk.Align.START);

        content.append(message);

        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.OK) {
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
            dlg.destroy();
        });

        dialog.present();
    }

    _runSelfCheck() {
        try {
            const shellVersion = Me.metadata['shell-version'] || [];
            const envWayland = GLib.getenv('XDG_SESSION_TYPE') || '';
            const platform = envWayland.toLowerCase();
            const now = GLib.DateTime.new_now_local().format('%Y-%m-%d %H:%M:%S');
            log(`[ClipFlow Pro] Self-check @ ${now}`);
            log(`[ClipFlow Pro] GNOME Shell versions supported: ${JSON.stringify(shellVersion)}`);
            log(`[ClipFlow Pro] Session type: ${platform}`);
            const settings = this._settings;
            log(`[ClipFlow Pro] Settings snapshot: capture-primary=${settings.get_boolean('capture-primary')}, dedupe-mode=${settings.get_string('dedupe-mode')}, min-entry-length=${settings.get_int('min-entry-length')}, max-entry-length=${settings.get_int('max-entry-length')}, entries-per-page=${settings.get_int('entries-per-page')}, icon-size-override=${settings.get_int('icon-size-override')}`);
            log('[ClipFlow Pro] Self-check completed. Open GNOME Shell logs to view details.');
            // Provide immediate UI feedback
            const dlg = new Gtk.MessageDialog({
                transient_for: this.get_root(),
                modal: true,
                buttons: Gtk.ButtonsType.OK,
                message_type: Gtk.MessageType.INFO,
                text: _('Self-check completed'),
                secondary_text: _('Details written to system logs. Look for "ClipFlow Pro" in GNOME Shell logs.'),
            });
            dlg.connect('response', () => dlg.destroy());
            dlg.present();
        } catch (e) {
            log(`[ClipFlow Pro] Self-check failed: ${e.message}`);
            const dlg = new Gtk.MessageDialog({
                transient_for: this.get_root(),
                modal: true,
                buttons: Gtk.ButtonsType.OK,
                message_type: Gtk.MessageType.ERROR,
                text: _('Self-check failed'),
                secondary_text: String(e?.message ?? e),
            });
            dlg.connect('response', () => dlg.destroy());
            dlg.present();
        }
    }
});

function buildPrefsWidget() {
    return new ClipFlowProPrefsWidget();
}
