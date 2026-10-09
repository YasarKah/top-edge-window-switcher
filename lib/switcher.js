'use strict';

import { pickWindowAt } from './pick.js';
import { modifierSatisfied } from './scroll.js';

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
        for (const monitor of this._monitorsInScope()) {
            this._bridge.addStrip(monitor, this._config.stripHeight, {
                onScroll: (monitorIndex, scroll) => this._onScroll(monitorIndex, scroll),
                onButtonPress: (monitorIndex, press) => this._onButtonPress(monitorIndex, press),
            });
            this._stripIndexes.push(monitor.index);
        }
        this._syncPrimaryStrip();
    }

    // Hangi monitorlerde tetik etkin. Primary'yi disarida birakmak, top bar'da
    // scroll'u zaten kullanan baska bir eklenti varken carpismayi onler.
    _monitorsInScope() {
        const scope = this._config.activeMonitors ?? 'all';
        return this._bridge.monitors.filter(monitor =>
            scope === 'all' ||
            (scope === 'primary' && monitor.isPrimary) ||
            (scope === 'secondary' && !monitor.isPrimary));
    }

    _indexInScope(monitorIndex) {
        return this._monitorsInScope().some(monitor => monitor.index === monitorIndex);
    }

    _syncPrimaryStrip() {
        for (const monitor of this._monitorsInScope()) {
            if (monitor.isPrimary && this._stripIndexes.includes(monitor.index))
                this._bridge.setStripEnabled(monitor.index, !this._bridge.isPanelVisible);
        }
    }

    // Serit, Shell'in girdi bolgesinde durdugu icin bandindaki tiklamalar
    // alttaki pencereye HIC ulasmaz. Bu yuzden basisi yutmak yerine pencerenin
    // tasima islemini kendimiz baslatiyoruz, aksi halde panelsiz monitorlerde
    // buyutulmus bir pencere en ust satirindan tutulup tasinamiyordu.
    _onButtonPress(monitorIndex, press) {
        if (!this._enabled || !press || press.button !== 1)
            return false;
        if (this._config.dragFromStrip === false)
            return false;
        if (!this._indexInScope(monitorIndex))
            return false;
        if (this._bridge.isBlocked)
            return false;

        const target = pickWindowAt(
            this._bridge.listDraggableWindows(monitorIndex), press.x, press.y);
        if (!target)
            return false;

        this._bridge.beginWindowDrag(target, press);
        return true;
    }

    _onScroll(monitorIndex, scroll) {
        if (!this._enabled || !scroll)
            return false;
        if (!this._indexInScope(monitorIndex))
            return false;
        if (!modifierSatisfied(this._config.requiredModifier, scroll.modifiers))
            return false;
        if (this._bridge.isBlocked)
            return false;

        const result = this._cycler.handleScroll({
            monitorIndex,
            direction: scroll.direction,
            delta: scroll.delta,
            windows: this._bridge.listWindows(this._config.allWorkspaces === true),
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
