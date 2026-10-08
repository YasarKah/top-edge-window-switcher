'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensionPreferences.js';

export default class TopBarScrollSwitcherPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        const which = new Adw.PreferencesGroup({
            title: 'Hangi pencereler',
            description: 'Scroll ile aralarında geçiş yapılacak pencereler.',
        });
        which.add(this._switchRow(settings, 'include-maximized',
            'Büyütülmüş pencereler',
            'İki eksende büyütülmüş pencereler döngüye girer.'));
        which.add(this._switchRow(settings, 'include-fullscreen',
            'Tam ekran pencereler',
            'Gerçek tam ekran pencereler döngüye girer.'));
        which.add(this._switchRow(settings, 'include-minimized',
            'Küçültülmüş pencereler',
            'Küçültülen pencere döngüde kalır, scroll onu geri çağırır.'));
        page.add(which);

        const behaviour = new Adw.PreferencesGroup({ title: 'Davranış' });
        behaviour.add(this._switchRow(settings, 'wrap-around',
            'Sonda başa sar',
            'Son pencereden sonra ilk pencereye döner.'));
        behaviour.add(this._switchRow(settings, 'invert-direction',
            'Yönü ters çevir',
            'Yukarı scroll ile gidilen yönü değiştirir.'));
        behaviour.add(this._switchRow(settings, 'show-osd',
            'Pencere adını göster',
            'Geçişte pencere başlığını ekranda gösterir.'));
        page.add(behaviour);

        const tuning = new Adw.PreferencesGroup({
            title: 'Tetik alanı ve zamanlama',
            description: 'Şerit yüksekliği, her monitörün üstünde scroll’a duyarlı bandı belirler. ' +
                         'Bu bantta uygulamaların kendi scroll’u çalışmaz.',
        });
        tuning.add(this._spinRow(settings, 'strip-height', 'Şerit yüksekliği (px)', 1, 64, 1));
        tuning.add(this._spinRow(settings, 'gesture-timeout-ms', 'Jest zaman aşımı (ms)', 200, 10000, 100));
        tuning.add(this._spinRow(settings, 'switch-debounce-ms', 'Geçişler arası en az süre (ms)', 0, 1000, 10));
        page.add(tuning);

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
}
