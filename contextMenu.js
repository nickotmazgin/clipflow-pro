// ClipFlow Pro - Context Menu Integration
// Created by Nick Otmazgin

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

export class ContextMenuManager {
    constructor(extension, manager) {
        this._extension = extension;
        this._settings = extension.getSettings();
        this._manager = manager;
        this._nautilus = null;
        this._fileManager = null;
        
        this._init();
    }

    _init() {
        // Try to find available file managers
        this._detectFileManager();
        
        // Monitor settings changes
        this._settingsChangedId = this._settings.connect('changed::enable-context-menu', () => {
            this._onContextMenuToggled();
        });
        
        this._fileSettingsChangedId = this._settings.connect('changed::enable-file-integration', () => {
            this._onFileIntegrationToggled();
        });

        // Initialize context menu if enabled
        if (this._settings.get_boolean('enable-context-menu')) {
            this._setupContextMenu();
        }
    }

    _detectFileManager() {
        // Try to find Nautilus (GNOME Files)
        try {
            const nautilusPath = GLib.find_program_in_path('nautilus');
            if (nautilusPath) {
                this._nautilus = nautilusPath;
                this._fileManager = 'nautilus';
                return;
            }
        } catch (e) {
            // Nautilus not found
        }

        // Try other file managers
        const fileManagers = [
            { name: 'nemo', command: 'nemo' },
            { name: 'thunar', command: 'thunar' },
            { name: 'dolphin', command: 'dolphin' },
            { name: 'pcmanfm', command: 'pcmanfm' }
        ];

        for (const fm of fileManagers) {
            try {
                const path = GLib.find_program_in_path(fm.command);
                if (path) {
                    this._fileManager = fm.name;
                    break;
                }
            } catch (e) {
                // File manager not found
            }
        }
    }

    _setupContextMenu() {
        // This would integrate with file manager context menus
        // For now, we'll focus on the clipboard functionality integration
        log('ClipFlow Pro: Context menu integration initialized');
    }

    _onContextMenuToggled() {
        if (this._settings.get_boolean('enable-context-menu')) {
            this._setupContextMenu();
        } else {
            this._removeContextMenu();
        }
    }

    _onFileIntegrationToggled() {
        // Refresh context menu integration
        if (this._settings.get_boolean('enable-context-menu')) {
            this._removeContextMenu();
            this._setupContextMenu();
        }
    }

    _removeContextMenu() {
        // Remove context menu integration
        log('ClipFlow Pro: Context menu integration removed');
    }

    // File operations for context menu
    copyFilePath(filePath) {
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, filePath);
        
        // Add to clipboard history
        this._manager._addEntry(new this._manager.ClipboardEntry(filePath, 'file-path'));
    }

    copyFileName(filePath) {
        const fileName = GLib.path_get_basename(filePath);
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, fileName);
        
        // Add to clipboard history
        this._manager._addEntry(new this._manager.ClipboardEntry(fileName, 'file-name'));
    }

    copyDirectoryPath(filePath) {
        const dirPath = GLib.path_get_dirname(filePath);
        const clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, dirPath);
        
        // Add to clipboard history
        this._manager._addEntry(new this._manager.ClipboardEntry(dirPath, 'directory-path'));
    }

    openTerminalHere(filePath) {
        try {
            const dirPath = GLib.file_test(filePath, GLib.FileTest.IS_DIR) ? 
                filePath : GLib.path_get_dirname(filePath);

            // Try different terminal emulators
            const terminals = [
                'gnome-terminal --working-directory',
                'konsole --workdir',
                'xfce4-terminal --working-directory',
                'mate-terminal --working-directory',
                'tilix --working-directory',
                'alacritty --working-directory'
            ];

            for (const terminalCmd of terminals) {
                try {
                    const [terminal, ...args] = terminalCmd.split(' ');
                    const terminalPath = GLib.find_program_in_path(terminal);
                    
                    if (terminalPath) {
                        const argv = [terminalPath, ...args, dirPath];
                        GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            // Fallback to xterm
            try {
                const argv = ['xterm', '-e', `cd "${dirPath}" && $SHELL`];
                GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
                return true;
            } catch (e) {
                log(`ClipFlow Pro: Failed to open terminal: ${e}`);
                return false;
            }
            
        } catch (e) {
            log(`ClipFlow Pro: Error opening terminal: ${e}`);
            return false;
        }
    }

    openInFileManager(filePath) {
        try {
            if (!this._fileManager) {
                return false;
            }

            let argv;
            switch (this._fileManager) {
                case 'nautilus':
                    argv = ['nautilus', '--select', filePath];
                    break;
                case 'nemo':
                    argv = ['nemo', filePath];
                    break;
                case 'thunar':
                    argv = ['thunar', filePath];
                    break;
                case 'dolphin':
                    argv = ['dolphin', '--select', filePath];
                    break;
                case 'pcmanfm':
                    argv = ['pcmanfm', filePath];
                    break;
                default:
                    return false;
            }

            GLib.spawn_async(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
            return true;

        } catch (e) {
            log(`ClipFlow Pro: Error opening file manager: ${e}`);
            return false;
        }
    }

    getFileInfo(filePath) {
        try {
            const file = Gio.File.new_for_path(filePath);
            const info = file.query_info(
                'standard::*,time::*,access::*',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            const fileInfo = {
                name: info.get_name(),
                displayName: info.get_display_name(),
                size: info.get_size(),
                type: info.get_file_type(),
                contentType: info.get_content_type(),
                modifiedTime: info.get_modification_date_time(),
                isDirectory: info.get_file_type() === Gio.FileType.DIRECTORY,
                isHidden: info.get_is_hidden(),
                canRead: info.get_attribute_boolean('access::can-read'),
                canWrite: info.get_attribute_boolean('access::can-write'),
                canExecute: info.get_attribute_boolean('access::can-execute')
            };

            return fileInfo;
        } catch (e) {
            log(`ClipFlow Pro: Error getting file info: ${e}`);
            return null;
        }
    }

    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    createFileContextMenu(filePath) {
        if (!this._settings.get_boolean('enable-file-integration')) {
            return null;
        }

        const menu = new PopupMenu.PopupMenuSection();
        const fileInfo = this.getFileInfo(filePath);

        if (!fileInfo) {
            return null;
        }

        // Separator
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // ClipFlow Pro submenu
        const clipflowSubmenu = new PopupMenu.PopupSubMenuMenuItem(_('ClipFlow Pro'), true);
        clipflowSubmenu.icon.icon_name = 'edit-paste-symbolic';

        // Copy full path
        const copyFullPathItem = new PopupMenu.PopupMenuItem(_('Copy Full Path'));
        copyFullPathItem.connect('activate', () => {
            this.copyFilePath(filePath);
        });
        clipflowSubmenu.menu.addMenuItem(copyFullPathItem);

        // Copy file name
        const copyFileNameItem = new PopupMenu.PopupMenuItem(_('Copy File Name'));
        copyFileNameItem.connect('activate', () => {
            this.copyFileName(filePath);
        });
        clipflowSubmenu.menu.addMenuItem(copyFileNameItem);

        // Copy directory path
        const copyDirPathItem = new PopupMenu.PopupMenuItem(_('Copy Directory Path'));
        copyDirPathItem.connect('activate', () => {
            this.copyDirectoryPath(filePath);
        });
        clipflowSubmenu.menu.addMenuItem(copyDirPathItem);

        clipflowSubmenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Open terminal here
        const openTerminalItem = new PopupMenu.PopupMenuItem(_('Open Terminal Here'));
        openTerminalItem.connect('activate', () => {
            this.openTerminalHere(filePath);
        });
        clipflowSubmenu.menu.addMenuItem(openTerminalItem);

        // File information
        if (fileInfo) {
            clipflowSubmenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            
            const infoItem = new PopupMenu.PopupMenuItem(
                `${fileInfo.displayName} (${this.formatFileSize(fileInfo.size)})`
            );
            infoItem.reactive = false;
            clipflowSubmenu.menu.addMenuItem(infoItem);
        }

        menu.addMenuItem(clipflowSubmenu);

        return menu;
    }

    destroy() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        if (this._fileSettingsChangedId) {
            this._settings.disconnect(this._fileSettingsChangedId);
            this._fileSettingsChangedId = null;
        }

        this._removeContextMenu();
    }
}