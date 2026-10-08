'use strict';

import { test, assertEqual, assertNull, assertTrue } from './harness.js';
import { Switcher } from '../lib/switcher.js';

function fakeBridge(options = {}) {
    const bridge = {
        monitors: options.monitors ?? [
            { index: 0, x: 0, y: 0, width: 1920, height: 1080, isPrimary: false },
            { index: 1, x: 1920, y: 0, width: 1920, height: 1080, isPrimary: true },
        ],
        isBlocked: options.isBlocked ?? false,
        isPanelVisible: options.isPanelVisible ?? true,
        focusedWindowId: options.focusedWindowId ?? 1,
        windows: options.windows ?? [],

        strips: [],
        enabled: new Map(),
        activated: [],
        osd: [],
        panelHandler: null,
        monitorsChangedHandler: null,
        panelVisibilityHandler: null,
        destroyed: false,
        panelDisconnected: false,

        listWindows() {
            return this.windows;
        },
        activateWindow(window) {
            this.activated.push(window.id);
        },
        showOsd(monitorIndex, window) {
            this.osd.push([monitorIndex, window.id]);
        },
        addStrip(monitor, height, onScroll) {
            this.strips.push({ index: monitor.index, height, onScroll });
        },
        removeStrip(monitorIndex) {
            this.strips = this.strips.filter(s => s.index !== monitorIndex);
        },
        setStripEnabled(monitorIndex, enabled) {
            this.enabled.set(monitorIndex, enabled);
        },
        connectPanelScroll(onScroll) {
            this.panelHandler = onScroll;
        },
        disconnectPanelScroll() {
            this.panelDisconnected = true;
            this.panelHandler = null;
        },
        onMonitorsChanged(callback) {
            this.monitorsChangedHandler = callback;
        },
        onPanelVisibilityChanged(callback) {
            this.panelVisibilityHandler = callback;
        },
        destroy() {
            this.destroyed = true;
        },
    };
    return bridge;
}

function fakeCycler(result) {
    return {
        calls: [],
        resets: [],
        handleScroll(args) {
            this.calls.push(args);
            return result;
        },
        reset(monitorIndex) {
            this.resets.push(monitorIndex);
        },
    };
}

function defaults() {
    return { stripHeight: 20, showOsd: true };
}

test('enable installs one strip per monitor at the configured height', () => {
    const bridge = fakeBridge();
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    switcher.enable();
    assertEqual(bridge.strips.map(s => s.index), [0, 1]);
    assertEqual(bridge.strips.map(s => s.height), [20, 20]);
});

test('a switch activates the window the cycler chose and consumes the event', () => {
    const bridge = fakeBridge({ windows: [{ id: 7 }] });
    const cycler = fakeCycler({ window: { id: 7, title: 'x' } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    const handled = bridge.strips[0].onScroll(0, { direction: 1, delta: 0 });
    assertTrue(handled);
    assertEqual(bridge.activated, [7]);
});

test('the cycler receives the monitor, the scroll and the current window state', () => {
    const windows = [{ id: 3 }];
    const bridge = fakeBridge({ windows, focusedWindowId: 3 });
    const cycler = fakeCycler(null);
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    bridge.strips[0].onScroll(0, { direction: -1, delta: 0 });
    assertEqual(cycler.calls[0].monitorIndex, 0);
    assertEqual(cycler.calls[0].direction, -1);
    assertEqual(cycler.calls[0].focusedId, 3);
    assertEqual(cycler.calls[0].windows, windows);
});

test('declining to switch leaves the event to propagate', () => {
    const bridge = fakeBridge();
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    switcher.enable();
    assertEqual(bridge.strips[0].onScroll(0, { direction: 1, delta: 0 }), false);
    assertEqual(bridge.activated, []);
});

test('a null scroll never reaches the cycler', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler({ window: { id: 1 } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    assertEqual(bridge.strips[0].onScroll(0, null), false);
    assertEqual(cycler.calls.length, 0);
});

test('nothing happens while the shell is blocked', () => {
    const bridge = fakeBridge({ isBlocked: true });
    const cycler = fakeCycler({ window: { id: 1 } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    assertEqual(bridge.strips[0].onScroll(0, { direction: 1, delta: 0 }), false);
    assertEqual(cycler.calls.length, 0);
});

test('the OSD names the window on the monitor that was scrolled', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler({ window: { id: 42, title: 'Chrome' } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    bridge.strips[1].onScroll(1, { direction: 1, delta: 0 });
    assertEqual(bridge.osd, [[1, 42]]);
});

test('showOsd false suppresses the OSD but still switches', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler({ window: { id: 42, title: 'Chrome' } });
    const config = defaults();
    config.showOsd = false;
    const switcher = new Switcher({ bridge, cycler, config });
    switcher.enable();
    bridge.strips[0].onScroll(0, { direction: 1, delta: 0 });
    assertEqual(bridge.osd, []);
    assertEqual(bridge.activated, [42]);
});

test('the primary strip is enabled only while the panel is hidden', () => {
    const bridge = fakeBridge({ isPanelVisible: true });
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    switcher.enable();
    assertEqual(bridge.enabled.get(1), false);
    bridge.isPanelVisible = false;
    bridge.panelVisibilityHandler();
    assertEqual(bridge.enabled.get(1), true);
});

test('a failure part way through enable tears down what was already installed', () => {
    const bridge = fakeBridge();
    const realAddStrip = bridge.addStrip.bind(bridge);
    let calls = 0;
    bridge.addStrip = function (monitor, height, onScroll) {
        calls++;
        if (calls === 2)
            throw new Error('addStrip failed');
        realAddStrip(monitor, height, onScroll);
    };
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    let threw = false;
    try {
        switcher.enable();
    } catch (e) {
        threw = true;
    }
    assertTrue(threw, 'enable should rethrow so the shell marks the extension in error');
    assertEqual(bridge.strips, []);
    assertTrue(bridge.panelDisconnected);
    assertTrue(bridge.destroyed);
});

test('a monitor layout change rebuilds the strips and clears all cycler state', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler(null);
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    bridge.monitors = [{ index: 0, x: 0, y: 0, width: 2560, height: 1440, isPrimary: true }];
    bridge.monitorsChangedHandler();
    assertEqual(bridge.strips.map(s => s.index), [0]);
    assertEqual(cycler.resets, [undefined]);
});

test('refresh reinstalls the strips at the new height', () => {
    const bridge = fakeBridge();
    const config = defaults();
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config });
    switcher.enable();
    config.stripHeight = 40;
    switcher.refresh();
    assertEqual(bridge.strips.map(s => s.height), [40, 40]);
});

test('disable removes every strip and tears the bridge down', () => {
    const bridge = fakeBridge();
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    switcher.enable();
    switcher.disable();
    assertEqual(bridge.strips, []);
    assertTrue(bridge.panelDisconnected);
    assertTrue(bridge.destroyed);
});

test('a scroll arriving after disable is ignored', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler({ window: { id: 1 } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    const strip = bridge.strips[0];
    switcher.disable();
    assertEqual(strip.onScroll(0, { direction: 1, delta: 0 }), false);
    assertEqual(cycler.calls.length, 0);
});
