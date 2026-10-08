'use strict';

import GLib from 'gi://GLib';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { Cycler } from './lib/cycler.js';
import { ShellBridge } from './lib/shell.js';
import { Switcher } from './lib/switcher.js';

export default class TopBarScrollSwitcherExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._config = {};
        this._syncConfig();

        this._settingsId = this._settings.connect('changed', () => {
            const previousHeight = this._config.stripHeight;
            this._syncConfig();
            if (this._config.stripHeight !== previousHeight)
                this._switcher?.refresh();
        });

        this._bridge = new ShellBridge();
        this._cycler = new Cycler({
            now: () => GLib.get_monotonic_time() / 1000,
            config: this._config,
        });
        this._switcher = new Switcher({
            bridge: this._bridge,
            cycler: this._cycler,
            config: this._config,
        });
        this._switcher.enable();
    }

    disable() {
        this._switcher?.disable();
        this._switcher = null;
        this._cycler = null;
        this._bridge = null;

        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        this._settings = null;
        this._config = null;
    }

    _syncConfig() {
        const settings = this._settings;
        const config = this._config;
        config.stripHeight = settings.get_int('strip-height');
        config.includeMaximized = settings.get_boolean('include-maximized');
        config.includeFullscreen = settings.get_boolean('include-fullscreen');
        config.includeMinimized = settings.get_boolean('include-minimized');
        config.wrapAround = settings.get_boolean('wrap-around');
        config.gestureTimeoutMs = settings.get_int('gesture-timeout-ms');
        config.switchDebounceMs = settings.get_int('switch-debounce-ms');
        config.invertDirection = settings.get_boolean('invert-direction');
        config.showOsd = settings.get_boolean('show-osd');
    }
}
