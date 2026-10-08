'use strict';

import { test, assertEqual, assertNull, assertTrue } from './harness.js';
import { Cycler } from '../lib/cycler.js';

export function defaultConfig() {
    return {
        includeMaximized: true,
        includeFullscreen: true,
        includeMinimized: true,
        wrapAround: true,
        gestureTimeoutMs: 1500,
        switchDebounceMs: 120,
        invertDirection: false,
    };
}

export function win(id, monitorIndex, overrides = {}) {
    return Object.assign({
        id,
        monitorIndex,
        isNormalType: true,
        isMaximized: true,
        isFullscreen: false,
        isMinimized: false,
    }, overrides);
}

function ids(windows) {
    return windows.map(w => w.id);
}

test('candidates keeps only windows on the asked monitor', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, 1), win(3, 0)];
    assertEqual(ids(c.candidates(windows, 0)), [1, 3]);
    assertEqual(ids(c.candidates(windows, 1)), [2]);
});

test('candidates preserves the given MRU order', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(7, 0), win(3, 0), win(9, 0)];
    assertEqual(ids(c.candidates(windows, 0)), [7, 3, 9]);
});

test('candidates drops windows with monitorIndex -1', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, -1)];
    assertEqual(ids(c.candidates(windows, 0)), [1]);
    assertEqual(ids(c.candidates(windows, -1)), []);
});

test('candidates drops non-normal windows', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, 0, { isNormalType: false })];
    assertEqual(ids(c.candidates(windows, 0)), [1]);
});

test('candidates drops windows that cover neither way', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, 0, { isMaximized: false })];
    assertEqual(ids(c.candidates(windows, 0)), [1]);
});

test('candidates honours includeMaximized', () => {
    const config = defaultConfig();
    config.includeMaximized = false;
    const c = new Cycler({ now: () => 0, config });
    const windows = [win(1, 0), win(2, 0, { isMaximized: false, isFullscreen: true })];
    assertEqual(ids(c.candidates(windows, 0)), [2]);
});

test('candidates honours includeFullscreen', () => {
    const config = defaultConfig();
    config.includeFullscreen = false;
    const c = new Cycler({ now: () => 0, config });
    const windows = [win(1, 0, { isFullscreen: true }), win(2, 0)];
    assertEqual(ids(c.candidates(windows, 0)), [2]);
});

test('a fullscreen window is judged by includeFullscreen even when also maximized', () => {
    const config = defaultConfig();
    config.includeFullscreen = false;
    config.includeMaximized = true;
    const c = new Cycler({ now: () => 0, config });
    const windows = [win(1, 0, { isFullscreen: true, isMaximized: true })];
    assertEqual(ids(c.candidates(windows, 0)), []);
});

test('candidates honours includeMinimized', () => {
    const config = defaultConfig();
    config.includeMinimized = false;
    const c = new Cycler({ now: () => 0, config });
    const windows = [win(1, 0), win(2, 0, { isMinimized: true })];
    assertEqual(ids(c.candidates(windows, 0)), [1]);
});

test('candidates keeps minimized windows by default', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, 0, { isMinimized: true })];
    assertEqual(ids(c.candidates(windows, 0)), [1, 2]);
});

function clockCycler(config = defaultConfig()) {
    const box = { t: 10000 };
    const c = new Cycler({ now: () => box.t, config });
    return { c, box, config };
}

test('first scroll moves one step from the focused window', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    const r = c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 });
    assertEqual(r.window.id, 2);
});

test('scrolling up from the focused window goes the other way', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    const r = c.handleScroll({ monitorIndex: 0, direction: -1, delta: 0, windows, focusedId: 2 });
    assertEqual(r.window.id, 1);
});

test('the snapshot is frozen: MRU reordering mid-gesture does not change the walk', () => {
    const { c, box } = clockCycler();
    const first = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: first, focusedId: 1 }).window.id, 2);
    box.t += 200;
    // Pencere 2 etkinlestigi icin gercek MRU listesi basa doner; fotograf buna aldirmaz.
    const reordered = [win(2, 0), win(1, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: reordered, focusedId: 2 }).window.id, 3);
});

test('the gesture expires after gestureTimeoutMs and rebuilds from MRU', () => {
    const { c, box } = clockCycler();
    const first = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: first, focusedId: 1 }).window.id, 2);
    box.t += 1501;
    const reordered = [win(2, 0), win(1, 0), win(3, 0)];
    // Bayat jest: fotograf yeniden kurulur, indeks odakli pencere 2'nin konumu (0) olur.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: reordered, focusedId: 2 }).window.id, 1);
});

test('each monitor keeps its own independent gesture', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(10, 1), win(20, 1)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 200;
    assertEqual(c.handleScroll({ monitorIndex: 1, direction: 1, delta: 0, windows, focusedId: 10 }).window.id, 20);
});

test('when the focused window is not a candidate the first scroll picks the MRU top', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(99, 1)];
    const r = c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 99 });
    assertEqual(r.window.id, 1);
});

test('a null focusedId also picks the MRU top on the first scroll', () => {
    const { c } = clockCycler();
    const windows = [win(5, 0), win(6, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: -1, delta: 0, windows, focusedId: null }).window.id, 5);
});

test('fewer than two candidates does nothing', () => {
    const { c } = clockCycler();
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: [], focusedId: null }));
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: [win(1, 0)], focusedId: 1 }));
});

test('wrapping forward past the end lands on the first window', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 3 }).window.id, 1);
    box.t += 200;
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
});

test('wrapping backward past the start lands on the last window', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: -1, delta: 0, windows, focusedId: 1 }).window.id, 3);
});

test('without wrapAround the walk saturates at the end and reports no switch', () => {
    const config = defaultConfig();
    config.wrapAround = false;
    const { c } = clockCycler(config);
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 3 }));
});

test('without wrapAround the walk saturates at the start and reports no switch', () => {
    const config = defaultConfig();
    config.wrapAround = false;
    const { c } = clockCycler(config);
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertNull(c.handleScroll({ monitorIndex: 0, direction: -1, delta: 0, windows, focusedId: 1 }));
});

test('without wrapAround the walk still advances away from an edge', () => {
    const config = defaultConfig();
    config.wrapAround = false;
    const { c } = clockCycler(config);
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
});

test('invertDirection reverses which way scrolling walks', () => {
    const config = defaultConfig();
    config.invertDirection = true;
    const { c } = clockCycler(config);
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }).window.id, 1);
});

test('smooth deltas below the threshold do nothing', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 }));
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 }));
});

test('an accumulated smooth delta fires exactly one step', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 });
    c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 });
    const r = c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 });
    assertEqual(r.window.id, 2);
});

test('the smooth accumulator resets after firing', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    for (let i = 0; i < 3; i++)
        c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 });
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 2 }));
});

test('a negative smooth delta steps the other way', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    c.handleScroll({ monitorIndex: 0, direction: 0, delta: -0.6, windows, focusedId: 1 });
    const r = c.handleScroll({ monitorIndex: 0, direction: 0, delta: -0.6, windows, focusedId: 1 });
    assertEqual(r.window.id, 3);
});

test('a zero direction with zero delta does nothing', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0, windows, focusedId: 1 }));
});

test('debounce rejects a second switch inside switchDebounceMs', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 50;
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }));
});

test('a debounced scroll keeps the gesture alive', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 50;
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }));
    box.t += 100;
    // Jest hala canli oldugu icin fotograf korunur ve yurume 2'den devam eder.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }).window.id, 3);
});

test('debounce never blocks the first scroll of a gesture', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 5000;
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }).window.id, 3);
});

test('a closed window is pruned and the walk continues from where it stood', () => {
    const { c, box } = clockCycler();
    const all = [win(1, 0), win(2, 0), win(3, 0), win(4, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    // Pencere 1 kapandi; fotograf [2,3,4] olur, uzerinde durulan 2 hayatta, yurume 3'e gider.
    const after = [win(2, 0), win(3, 0), win(4, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: after, focusedId: 2 }).window.id, 3);
});

test('a window that left the monitor is pruned from the frozen snapshot', () => {
    const { c, box } = clockCycler();
    const all = [win(1, 0), win(2, 0), win(3, 0), win(4, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    // Pencere 3 monitor 1'e tasindi; monitor 0'da scroll onu asla etkinlestirmemeli.
    const moved = [win(1, 0), win(2, 0), win(3, 1), win(4, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: moved, focusedId: 2 }).window.id, 4);
});

test('pruning below two candidates rebuilds instead of switching blindly', () => {
    const { c, box } = clockCycler();
    const all = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: [win(2, 0)], focusedId: 2 }));
});

test('a settings change mid-gesture rebuilds the snapshot with the new criterion', () => {
    const { c, box, config } = clockCycler();
    const all = [win(1, 0), win(2, 0), win(3, 0, { isMaximized: false, isFullscreen: true }), win(4, 0, { isMaximized: false, isFullscreen: true })];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    config.includeMaximized = false;
    // Adaylar [3,4]'e duser; uzerinde durulan 2 artik aday degil, fotograf yeniden kurulur.
    // Odakli pencere 2 de aday olmadigi icin MRU tepesi olan 3 etkinlesir.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 2 }).window.id, 3);
});

test('a newly opened window is not added to a frozen snapshot', () => {
    const { c, box } = clockCycler();
    const all = [win(1, 0), win(2, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    const withNew = [win(9, 0), win(1, 0), win(2, 0)];
    // Fotograf hala [1,2]; 2'den ileri sarma 1'e doner, yeni 9 jest bitene kadar girmez.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: withNew, focusedId: 2 }).window.id, 1);
});

test('reset(monitorIndex) clears only that monitor', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0), win(10, 1), win(20, 1), win(30, 1)];
    c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 });
    c.handleScroll({ monitorIndex: 1, direction: 1, delta: 0, windows, focusedId: 10 });
    c.reset(0);
    box.t += 200;
    // Monitor 0 yeniden kuruldu: odakli 1'den bir adim -> 2.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 200;
    // Monitor 1'in jesti korundu: 20'de duruyordu, bir adim -> 30.
    assertEqual(c.handleScroll({ monitorIndex: 1, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 30);
});

test('reset() clears every monitor', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 });
    c.reset();
    box.t += 200;
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
});
