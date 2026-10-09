'use strict';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Graphene from 'gi://Graphene';
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

function modifiersFromEvent(event) {
    const state = event.get_state();
    return {
        ctrl: (state & Clutter.ModifierType.CONTROL_MASK) !== 0,
        alt: (state & Clutter.ModifierType.MOD1_MASK) !== 0,
        super: (state & Clutter.ModifierType.SUPER_MASK) !== 0,
    };
}

export function scrollFromEvent(event) {
    const kind = kindFromEvent(event);
    let deltaY = 0;
    if (kind === ScrollKind.SMOOTH)
        [, deltaY] = event.get_scroll_delta();
    const scroll = scrollFromRaw(kind, deltaY);
    if (scroll === null)
        return null;
    scroll.modifiers = modifiersFromEvent(event);
    return scroll;
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

    // allWorkspaces true ise workspace olarak null gecilir; Mutter bunu
    // "tum calisma alanlari" diye yorumlar.
    listWindows(allWorkspaces = false) {
        const workspace = allWorkspaces
            ? null
            : global.workspace_manager.get_active_workspace();
        return global.display.get_tab_list(Meta.TabList.NORMAL, workspace).map(w => ({
            id: w.get_id(),
            monitorIndex: w.get_monitor(),
            isNormalType: w.window_type === Meta.WindowType.NORMAL,
            isMaximized: w.get_maximized() === Meta.MaximizeFlags.BOTH,
            isFullscreen: w.is_fullscreen(),
            isMinimized: w.minimized,
            stableSequence: w.get_stable_sequence(),
            title: w.get_title() ?? '',
            metaWindow: w,
        }));
    }

    // Ustten alta sirali, o monitorde gercekten tasinabilir pencereler.
    listDraggableWindows(monitorIndex) {
        const workspace = global.workspace_manager.get_active_workspace();
        return global.display
            .sort_windows_by_stacking(workspace.list_windows())
            .reverse()
            .filter(w =>
                w.get_monitor() === monitorIndex &&
                w.showing_on_its_workspace() &&
                !w.is_fullscreen() &&
                w.get_window_type() !== Meta.WindowType.DESKTOP)
            .map(w => {
                const rect = w.get_frame_rect();
                return {
                    id: w.get_id(),
                    frame: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    metaWindow: w,
                };
            });
    }

    // Imza Mutter surumleri arasinda degisti; <50 icin device+sequence, >=50 icin
    // backend sprite'i aliyor. Kalip dash-to-panel panel.js:1270-1287'den alindi.
    beginWindowDrag(window, press) {
        const event = press.native;
        const args = [Meta.GrabOp.MOVING];
        if (SHELL_MAJOR < 50)
            args.push(event.get_device(), event.get_event_sequence());
        else
            args.push(global.stage.get_context().get_backend().get_sprite(global.stage, event));

        window.metaWindow.begin_grab_op(
            ...args,
            event.get_time(),
            new Graphene.Point({ x: press.x, y: press.y }));
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

    addStrip(monitor, height, handlers) {
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

        const scrollId = strip.connect('scroll-event', (_actor, event) => {
            const handled = handlers.onScroll(monitor.index, scrollFromEvent(event));
            return handled ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        });
        const pressId = strip.connect('button-press-event', (_actor, event) => {
            const [x, y] = event.get_coords();
            const handled = handlers.onButtonPress(monitor.index, {
                x,
                y,
                button: event.get_button(),
                native: event,
            });
            return handled ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        });
        this._strips.set(monitor.index, { strip, scrollId, pressId });
    }

    removeStrip(monitorIndex) {
        const entry = this._strips.get(monitorIndex);
        if (!entry)
            return;
        this._strips.delete(monitorIndex);
        entry.strip.disconnect(entry.scrollId);
        entry.strip.disconnect(entry.pressId);
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
