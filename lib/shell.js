'use strict';

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import { ScrollKind, scrollFromRaw } from './scroll.js';

const SHELL_MAJOR = parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);

function kindFromEvent(event) {
    switch (event.get_scroll_direction()) {
    case Clutter.ScrollDirection.UP:
        return ScrollKind.UP;
    case Clutter.ScrollDirection.DOWN:
        return ScrollKind.DOWN;
    case Clutter.ScrollDirection.SMOOTH:
        return ScrollKind.SMOOTH;
    default:
        return ScrollKind.OTHER;
    }
}

export function scrollFromEvent(event) {
    const kind = kindFromEvent(event);
    let deltaY = 0;
    if (kind === ScrollKind.SMOOTH)
        [, deltaY] = event.get_scroll_delta();
    return scrollFromRaw(kind, deltaY);
}

export class ShellBridge {
    constructor() {
        this._strips = new Map();
        this._signals = [];
        this._panelSignal = null;
    }

    get monitors() {
        const primaryIndex = Main.layoutManager.primaryIndex;
        return Main.layoutManager.monitors.map((monitor, index) => ({
            index,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            isPrimary: index === primaryIndex,
        }));
    }

    addStrip(monitor, height, onScroll) {
        const strip = new St.Widget({
            name: `tbss-strip-${monitor.index}`,
            reactive: true,
            opacity: 0,
            can_focus: false,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height,
        });

        const params = { affectsStruts: false, trackFullscreen: false };
        if (SHELL_MAJOR < 50)
            params.affectsInputRegion = true;
        Main.layoutManager.addChrome(strip, params);

        const id = strip.connect('scroll-event', (_actor, event) => {
            const handled = onScroll(monitor.index, scrollFromEvent(event));
            return handled ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        });
        this._strips.set(monitor.index, { strip, id });
    }

    removeStrip(monitorIndex) {
        const entry = this._strips.get(monitorIndex);
        if (!entry)
            return;
        this._strips.delete(monitorIndex);
        entry.strip.disconnect(entry.id);
        Main.layoutManager.removeChrome(entry.strip);
        entry.strip.destroy();
    }

    setStripReactive(monitorIndex, reactive) {
        const entry = this._strips.get(monitorIndex);
        if (entry)
            entry.strip.reactive = reactive;
    }

    onMonitorsChanged(callback) {
        const id = Main.layoutManager.connect('monitors-changed', () => callback());
        this._signals.push([Main.layoutManager, id]);
    }

    destroy() {
        for (const monitorIndex of [...this._strips.keys()])
            this.removeStrip(monitorIndex);
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
    }
}
