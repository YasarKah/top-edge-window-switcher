'use strict';

export class Cycler {
    constructor({ now, config }) {
        this._now = now;
        this._config = config;
        this._states = new Map();
    }

    handleScroll({ monitorIndex, direction, delta, windows, focusedId }) {
        const cfg = this._config;
        const now = this._now();
        const state = this._stateFor(monitorIndex);
        const step = direction;
        if (step === 0)
            return null;

        const stale = state.lastScrollTime === null ||
                      (now - state.lastScrollTime) > cfg.gestureTimeoutMs;

        const candidates = this.candidates(windows, monitorIndex);
        if (candidates.length < 2) {
            state.snapshot = null;
            state.lastScrollTime = now;
            return null;
        }

        if (stale || state.snapshot === null) {
            state.snapshot = candidates.slice();
            const at = state.snapshot.findIndex(w => w.id === focusedId);
            state.lastScrollTime = now;
            if (at < 0) {
                state.index = 0;
                return { window: state.snapshot[0] };
            }
            state.index = at;
        }

        state.lastScrollTime = now;
        const next = state.index + step;
        const n = state.snapshot.length;
        state.index = ((next % n) + n) % n;
        return { window: state.snapshot[state.index] };
    }

    _stateFor(monitorIndex) {
        let state = this._states.get(monitorIndex);
        if (!state) {
            state = { snapshot: null, index: 0, lastScrollTime: null, accum: 0 };
            this._states.set(monitorIndex, state);
        }
        return state;
    }

    candidates(windows, monitorIndex) {
        const cfg = this._config;
        return windows.filter(w =>
            w.monitorIndex >= 0 &&
            w.monitorIndex === monitorIndex &&
            w.isNormalType &&
            (cfg.includeMinimized || !w.isMinimized) &&
            this._isTargetSize(w));
    }

    _isTargetSize(w) {
        const cfg = this._config;
        if (w.isFullscreen)
            return cfg.includeFullscreen;
        if (w.isMaximized)
            return cfg.includeMaximized;
        return false;
    }
}
