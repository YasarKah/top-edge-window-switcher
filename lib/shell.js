'use strict';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
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

    get isBlocked() {
        return Main.overview.visible ||
               Main.modalCount > 0 ||
               Main.sessionMode.isLocked;
    }

    get isPanelVisible() {
        return Main.layoutManager.panelBox.visible;
    }

    get focusedWindowId() {
        const focused = global.display.focus_window;
        return focused ? focused.get_id() : null;
    }

    listWindows() {
        const workspace = global.workspace_manager.get_active_workspace();
        return global.display.get_tab_list(Meta.TabList.NORMAL, workspace).map(w => ({
            id: w.get_id(),
            monitorIndex: w.get_monitor(),
            isNormalType: w.window_type === Meta.WindowType.NORMAL,
            isMaximized: w.get_maximized() === Meta.MaximizeFlags.BOTH,
            isFullscreen: w.is_fullscreen(),
            isMinimized: w.minimized,
            title: w.get_title() ?? '',
            metaWindow: w,
        }));
    }

    activateWindow(window) {
        window.metaWindow.activate(global.get_current_time());
    }

    showOsd(monitorIndex, window) {
        const app = Shell.WindowTracker.get_default().get_window_app(window.metaWindow);
        const icon = app ? app.get_icon() : null;
        Main.osdWindowManager.show(
            monitorIndex,
            icon ?? new Gio.ThemedIcon({ name: 'focus-windows-symbolic' }),
            window.title,
            null);
    }

    connectPanelScroll(onScroll) {
        const id = Main.panel.connect('scroll-event', (_actor, event) => {
            const monitorIndex = Main.layoutManager.primaryIndex;
            const handled = onScroll(monitorIndex, scrollFromEvent(event));
            return handled ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        });
        this._panelSignal = [Main.panel, id];
    }

    disconnectPanelScroll() {
        if (!this._panelSignal)
            return;
        const [object, id] = this._panelSignal;
        object.disconnect(id);
        this._panelSignal = null;
    }

    onPanelVisibilityChanged(callback) {
        const panelBox = Main.layoutManager.panelBox;
        const id = panelBox.connect('notify::visible', () => callback());
        this._signals.push([panelBox, id]);
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

    // DIKKAT: `reactive = false` YETMEZ. LayoutManager'in input bolgesi
    // hesabi reactive'e hic bakmaz, yalnizca get_paint_visibility()'ye bakar;
    // reactive olmayan ama gorunur bir serit bandi input bolgesinde tutmaya
    // devam eder ve orayi her turlu isaretci girdisine olu hale getirir.
    // `visible = false` seridi bolgeden tamamen cikarir.
    setStripEnabled(monitorIndex, enabled) {
        const entry = this._strips.get(monitorIndex);
        if (entry)
            entry.strip.visible = enabled;
    }

    onMonitorsChanged(callback) {
        const id = Main.layoutManager.connect('monitors-changed', () => callback());
        this._signals.push([Main.layoutManager, id]);
    }

    destroy() {
        this.disconnectPanelScroll();
        for (const monitorIndex of [...this._strips.keys()])
            this.removeStrip(monitorIndex);
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
    }
}
