'use strict';

export class Switcher {
    constructor({ bridge, cycler, config }) {
        this._bridge = bridge;
        this._cycler = cycler;
        this._config = config;
        this._stripIndexes = [];
        this._enabled = false;
    }

    enable() {
        this._enabled = true;
        try {
            this._rebuildStrips();
            this._bridge.onMonitorsChanged(() => {
                this._cycler.reset();
                this._rebuildStrips();
            });
            this._bridge.onPanelVisibilityChanged(() => this._syncPrimaryStrip());
            this._bridge.connectPanelScroll((monitorIndex, scroll) =>
                this._onScroll(monitorIndex, scroll));
        } catch (e) {
            // Yarida kalan enable()'da Shell disable()'i CAGIRMAZ; eklenti hata
            // durumunda isaretlenir. Kendimiz toplamazsak eklenmis seritler bir
            // sonraki Shell yeniden baslatmasina kadar input bolgesinde kalir.
            this.disable();
            throw e;
        }
    }

    refresh() {
        if (this._enabled)
            this._rebuildStrips();
    }

    disable() {
        this._enabled = false;
        this._removeStrips();
        this._bridge.disconnectPanelScroll();
        this._bridge.destroy();
    }

    _removeStrips() {
        for (const monitorIndex of this._stripIndexes)
            this._bridge.removeStrip(monitorIndex);
        this._stripIndexes = [];
    }

    _rebuildStrips() {
        this._removeStrips();
        for (const monitor of this._bridge.monitors) {
            this._bridge.addStrip(monitor, this._config.stripHeight,
                (monitorIndex, scroll) => this._onScroll(monitorIndex, scroll));
            this._stripIndexes.push(monitor.index);
        }
        this._syncPrimaryStrip();
    }

    _syncPrimaryStrip() {
        for (const monitor of this._bridge.monitors) {
            if (monitor.isPrimary)
                this._bridge.setStripEnabled(monitor.index, !this._bridge.isPanelVisible);
        }
    }

    _onScroll(monitorIndex, scroll) {
        if (!this._enabled || !scroll)
            return false;
        if (this._bridge.isBlocked)
            return false;

        const result = this._cycler.handleScroll({
            monitorIndex,
            direction: scroll.direction,
            delta: scroll.delta,
            windows: this._bridge.listWindows(),
            focusedId: this._bridge.focusedWindowId,
        });
        if (!result)
            return false;

        this._bridge.activateWindow(result.window);
        if (this._config.showOsd)
            this._bridge.showOsd(monitorIndex, result.window);
        return true;
    }
}
