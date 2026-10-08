'use strict';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { ShellBridge } from './lib/shell.js';

export default class TopBarScrollSwitcherExtension extends Extension {
    enable() {
        this._bridge = new ShellBridge();
        const dump = (monitorIndex, scroll) => {
            const windows = this._bridge.listWindows()
                .filter(w => w.monitorIndex === monitorIndex)
                .map(w => `${w.id}:${w.isMaximized ? 'M' : '-'}${w.isFullscreen ? 'F' : '-'}${w.isMinimized ? 'm' : '-'}:${w.title}`);
            console.log(`tbss: monitor=${monitorIndex} scroll=${JSON.stringify(scroll)} ` +
                `blocked=${this._bridge.isBlocked} panel=${this._bridge.isPanelVisible} ` +
                `focused=${this._bridge.focusedWindowId} windows=[${windows.join(' | ')}]`);
            return false;
        };
        for (const monitor of this._bridge.monitors)
            this._bridge.addStrip(monitor, 20, dump);
        this._bridge.connectPanelScroll(dump);
    }

    disable() {
        this._bridge?.destroy();
        this._bridge = null;
    }
}