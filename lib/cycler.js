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

        let step = 0;
        if (direction !== 0) {
            step = direction;
            state.accum = 0;
        } else if (delta) {
            state.accum += delta;
            if (Math.abs(state.accum) >= 1.0) {
                step = state.accum > 0 ? 1 : -1;
                state.accum = 0;
            }
        }
        if (step === 0)
            return null;

        const stale = state.lastScrollTime === null ||
                      (now - state.lastScrollTime) > cfg.gestureTimeoutMs;

        if (!stale && (now - state.lastSwitchTime) < cfg.switchDebounceMs) {
            state.lastScrollTime = now;
            return null;
        }

        const candidates = this.candidates(windows, monitorIndex);
        if (candidates.length < 2) {
            state.snapshot = null;
            state.lastScrollTime = now;
            return null;
        }

        state.lastScrollTime = now;

        let rebuilt = null;
        if (stale || state.snapshot === null) {
            rebuilt = this._startGesture(state, candidates, focusedId, now);
        } else {
            const live = new Set(candidates.map(w => w.id));
            const standingId = state.snapshot[state.index]?.id ?? null;
            const pruned = state.snapshot.filter(w => live.has(w.id));
            if (pruned.length < 2) {
                rebuilt = this._startGesture(state, candidates, focusedId, now);
            } else {
                state.snapshot = pruned;
                const at = pruned.findIndex(w => w.id === standingId);
                if (at < 0)
                    rebuilt = this._startGesture(state, candidates, focusedId, now);
                else
                    state.index = at;
            }
        }
        if (rebuilt !== null)
            return rebuilt;

        const dir = cfg.invertDirection ? -step : step;
        const n = state.snapshot.length;
        let next = state.index + dir;
        if (cfg.wrapAround) {
            next = ((next % n) + n) % n;
        } else {
            if (next < 0)
                next = 0;
            if (next > n - 1)
                next = n - 1;
        }
        if (next === state.index)
            return null;
        state.index = next;
        state.lastSwitchTime = now;
        return { window: state.snapshot[next] };
    }

    _startGesture(state, candidates, focusedId, now) {
        state.snapshot = candidates.slice();
        const at = state.snapshot.findIndex(w => w.id === focusedId);
        if (at < 0) {
            state.index = 0;
            state.lastSwitchTime = now;
            return { window: state.snapshot[0] };
        }
        state.index = at;
        return null;
    }

    reset(monitorIndex) {
        if (monitorIndex === undefined)
            this._states.clear();
        else
            this._states.delete(monitorIndex);
    }

    _stateFor(monitorIndex) {
        let state = this._states.get(monitorIndex);
        if (!state) {
            state = {
                snapshot: null,
                index: 0,
                lastScrollTime: null,
                lastSwitchTime: -Infinity,
                accum: 0,
            };
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
