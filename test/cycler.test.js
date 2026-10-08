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
