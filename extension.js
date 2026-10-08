'use strict';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { ShellBridge } from './lib/shell.js';

export default class TopBarScrollSwitcherExtension extends Extension {
    enable() {
        this._bridge = new ShellBridge();
        for (const monitor of this._bridge.monitors) {
            this._bridge.addStrip(monitor, 20, (monitorIndex, scroll) => {
                console.log(`tbss: monitor=${monitorIndex} scroll=${JSON.stringify(scroll)}`);
                return false;
            });
        }
    }

    disable() {
        this._bridge?.destroy();
        this._bridge = null;
    }
}
