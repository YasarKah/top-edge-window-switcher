'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TopEdgeWindowSwitcherPrefs extends ExtensionPreferences {
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
        which.add(this._switchRow(settings, 'all-workspaces',
            'Tüm çalışma alanları',
            'Kapalıyken yalnızca etkin çalışma alanındaki pencereler. Açıkken '
            + 'diğer çalışma alanlarına da geçilir.'));
        which.add(this._comboRow(settings, 'window-order',
            'Geçiş sırası',
            'Son kullanılan sırası, bir scroll boyunca dondurulur. Sabit sıra '
            + 'pencerelerin açılış sırasını kullanır, konumlar hiç değişmez.',
            ['mru', 'stable'],
            ['Son kullanılan', 'Sabit (açılış sırası)']));
        page.add(which);

        const trigger = new Adw.PreferencesGroup({
            title: 'Tetik alanı',
            description: 'Şerit, Shell’in girdi bölgesinde durur: bandında scroll '
                + 'dışındaki tıklama ve sürüklemeler de uygulamaya ulaşmaz. '
                + 'Varsayılan 1 px bu bedeli tek satıra indirir ve ekranın üst '
                + 'kenarı imleci oraya kilitlediği için isabet her zaman kolaydır.',
        });
        trigger.add(this._comboRow(settings, 'active-monitors',
            'Etkin monitörler',
            'Top bar’da scroll’u zaten kullanan başka bir eklentin varsa '
            + 'primary’yi dışarıda bırak.',
            ['all', 'secondary', 'primary'],
            ['Tümü', 'Primary dışı', 'Yalnızca primary']));
        trigger.add(this._spinRow(settings, 'strip-height', 'Şerit yüksekliği (px)', 1, 64, 1));
        trigger.add(this._comboRow(settings, 'required-modifier',
            'Gerekli tuş',
            'Seçilirse scroll yalnızca bu tuş basılıyken pencere değiştirir.',
            ['none', 'ctrl', 'alt', 'super'],
            ['Yok', 'Ctrl', 'Alt', 'Super']));
        trigger.add(this._switchRow(settings, 'drag-from-strip',
            'Şeritten pencere sürükle',
            'Bandda sol tuşa basınca alttaki pencere taşınmaya başlar. Kapalıyken '
            + 'o bandda tıklamalar tamamen yok sayılır.'));
        page.add(trigger);

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
        behaviour.add(this._spinRow(settings, 'gesture-timeout-ms',
            'Jest zaman aşımı (ms)', 200, 10000, 100));
        behaviour.add(this._spinRow(settings, 'switch-debounce-ms',
            'Geçişler arası en az süre (ms)', 0, 1000, 10));
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

    // Gio.Settings.bind() bir dizgeyi ComboRow'un tam sayi `selected` ozelligine
    // baglayamaz, bu yuzden esleme elle yapiliyor. Satir -> ayar yonu yeterli:
    // pencere acikken ayari baska kimse degistirmez ve boylece pencere
    // kapandiginda sokulmesi gereken bir sinyal kalmaz.
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
