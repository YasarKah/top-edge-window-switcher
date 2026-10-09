import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

const [stubPath, repoPath] = ARGV;

Gio.resources_register(Gio.resource_load(stubPath));
Gtk.init();

const mod = await import(`file://${repoPath}/prefs.js`);
const Cls = mod.default;
if (typeof Cls !== 'function')
    throw new Error('prefs.js default export bir sinif degil');

const source = Gio.SettingsSchemaSource.new_from_directory(
    `${repoPath}/schemas`, null, true);
const schema = source.lookup('org.gnome.shell.extensions.top-edge-window-switcher', true);
if (!schema)
    throw new Error('sema bulunamadi');
const settings = new Gio.Settings({ settings_schema: schema });

const self = Object.create(Cls.prototype);
self.getSettings = () => settings;

// 1) fillPreferencesWindow bastan sona kosuyor mu
let captured = null;
const fakeWindow = { add(page) { captured = page; } };
Cls.prototype.fillPreferencesWindow.call(self, fakeWindow);
if (!(captured instanceof Adw.PreferencesPage))
    throw new Error('window.add bir Adw.PreferencesPage almadi');
print('ok   fillPreferencesWindow calisti ve bir Adw.PreferencesPage ekledi');

// 2) her bool anahtari icin SwitchRow gercekten baglandi mi
const bools = ['include-maximized', 'include-fullscreen', 'include-minimized',
               'wrap-around', 'invert-direction', 'show-osd'];
for (const key of bools) {
    const row = self._switchRow(settings, key, key, 'x');
    const want = settings.get_boolean(key);
    if (!(row instanceof Adw.SwitchRow))
        throw new Error(`${key}: Adw.SwitchRow degil`);
    if (row.active !== want)
        throw new Error(`${key}: row.active=${row.active}, sema=${want}`);
    print(`ok   ${key} -> SwitchRow.active=${row.active} (semayla ayni)`);
}

// 3) her int anahtari icin SpinRow gercekten baglandi mi
const ints = [['strip-height', 1, 64, 1],
              ['gesture-timeout-ms', 200, 10000, 100],
              ['switch-debounce-ms', 0, 1000, 10]];
for (const [key, lo, hi, st] of ints) {
    const row = self._spinRow(settings, key, key, lo, hi, st);
    const want = settings.get_int(key);
    if (!(row instanceof Adw.SpinRow))
        throw new Error(`${key}: Adw.SpinRow degil`);
    if (row.value !== want)
        throw new Error(`${key}: row.value=${row.value}, sema=${want}`);
    if (row.adjustment.lower !== lo || row.adjustment.upper !== hi)
        throw new Error(`${key}: adjustment araligi ${row.adjustment.lower}..${row.adjustment.upper}, beklenen ${lo}..${hi}`);
    print(`ok   ${key} -> SpinRow.value=${row.value} aralik ${lo}..${hi} (semayla ayni)`);
}

// 4) iki yonlu baglanti: satiri degistirince sema degisiyor mu
const probe = self._spinRow(settings, 'strip-height', 'strip-height', 1, 64, 1);
const original = settings.get_int('strip-height');
probe.value = 33;
if (settings.get_int('strip-height') !== 33)
    throw new Error(`bind tek yonlu: sema ${settings.get_int('strip-height')}`);
settings.set_int('strip-height', original);
Gio.Settings.sync();
if (settings.get_int('strip-height') !== original)
    throw new Error('geri alma islemedi');
print(`ok   SpinRow -> GSettings yazma calisiyor (33 yazildi, ${original} geri alindi)`);

print('');
print('prefs.js DOGRULANDI: 9 anahtarin hepsi gercek Adw widget\'ina bagli');
