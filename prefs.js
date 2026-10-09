'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TopEdgeWindowSwitcherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        const which = new Adw.PreferencesGroup({
            title: _('Which windows'),
            description: _('The windows a scroll cycles through.'),
        });
        which.add(this._switchRow(settings, 'include-maximized',
            _('Maximized windows'),
            _('Windows maximized on both axes join the cycle.')));
        which.add(this._switchRow(settings, 'include-fullscreen',
            _('Fullscreen windows'),
            _('Genuinely fullscreen windows join the cycle.')));
        which.add(this._switchRow(settings, 'include-minimized',
            _('Minimized windows'),
            _('A minimized window stays in the cycle, so scrolling brings it back.')));
        which.add(this._switchRow(settings, 'all-workspaces',
            _('All workspaces'),
            _('Off: only windows on the active workspace. On: scrolling reaches windows on other workspaces too.')));
        which.add(this._comboRow(settings, 'window-order',
            _('Cycle order'),
            _('Most recently used, frozen for the duration of one scroll. A stable order follows when each window was opened, so positions never change.'),
            ['mru', 'stable'],
            [_('Most recently used'), _('Stable (open order)')]));
        page.add(which);

        const trigger = new Adw.PreferencesGroup({
            title: _('Trigger area'),
            description: _('The strip sits in the shell’s input region, so inside its band clicks and drags do not reach the application either, not just scroll. The default of 1 px keeps that cost to a single row, and the screen’s top edge clamps the pointer to it so it is always easy to hit.'),
        });
        trigger.add(this._comboRow(settings, 'active-monitors',
            _('Active monitors'),
            _('Leave the primary monitor out if another extension already uses top bar scrolling.'),
            ['all', 'secondary', 'primary'],
            [_('All'), _('Except primary'), _('Primary only')]));
        trigger.add(this._spinRow(settings, 'strip-height', _('Strip height (px)'), 1, 64, 1));
        trigger.add(this._comboRow(settings, 'required-modifier',
            _('Required key'),
            _('When set, scrolling only switches windows while this key is held.'),
            ['none', 'ctrl', 'alt', 'super'],
            [_('None'), _('Ctrl'), _('Alt'), _('Super')]));
        trigger.add(this._switchRow(settings, 'drag-from-strip',
            _('Drag windows from the strip'),
            _('A primary-button press in the band starts dragging the window underneath. Off: clicks in the band are discarded.')));
        page.add(trigger);

        const behaviour = new Adw.PreferencesGroup({ title: _('Behaviour') });
        behaviour.add(this._switchRow(settings, 'wrap-around',
            _('Wrap around'),
            _('After the last window, continue from the first.')));
        behaviour.add(this._switchRow(settings, 'invert-direction',
            _('Invert direction'),
            _('Swap which way scrolling up moves through the list.')));
        behaviour.add(this._switchRow(settings, 'show-osd',
            _('Show the window name'),
            _('Display the window title on screen when switching.')));
        behaviour.add(this._spinRow(settings, 'gesture-timeout-ms',
            _('Gesture timeout (ms)'), 200, 10000, 100));
        behaviour.add(this._spinRow(settings, 'switch-debounce-ms',
            _('Minimum time between switches (ms)'), 0, 1000, 10));
        page.add(behaviour);

        window.add(page);
    }

    _switchRow(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({ title, subtitle });
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _spinRow(settings, key, title, lower, upper, stepIncrement) {
        const row = new Adw.SpinRow({
            title,
            adjustment: new Gtk.Adjustment({
                lower,
                upper,
                step_increment: stepIncrement,
            }),
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    // Gio.Settings.bind() cannot bind a string to ComboRow's integer `selected`,
    // so the mapping is manual. Row -> setting is enough: nothing else writes
    // these keys while the window is open, and this leaves no signal to
    // disconnect when it closes.
    _comboRow(settings, key, title, subtitle, values, labels) {
        const row = new Adw.ComboRow({
            title,
            subtitle,
            model: new Gtk.StringList({ strings: labels }),
        });
        const current = values.indexOf(settings.get_string(key));
        row.selected = current < 0 ? 0 : current;
        row.connect('notify::selected', () => {
            const value = values[row.selected];
            if (value !== undefined && value !== settings.get_string(key))
                settings.set_string(key, value);
        });
        return row;
    }
}
