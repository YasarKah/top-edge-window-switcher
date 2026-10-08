'use strict';

export class Cycler {
    constructor({ now, config }) {
        this._now = now;
        this._config = config;
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
