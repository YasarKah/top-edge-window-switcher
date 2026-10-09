import Gio from 'gi://Gio';
import Gettext from 'gettext';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

const [stubPath, repoPath] = ARGV;

Gio.resources_register(Gio.resource_load(stubPath));
Gettext.bindtextdomain('top-edge-window-switcher', `${repoPath}/locale`);
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

// 1) fillPreferencesWindow bastan sona kosuyor mu, VE semadaki her anahtar
//    gercekten bir satira baglaniyor mu. Satir kuruculari sarmalanarak
//    hangi anahtarlarin kullanildigi kaydediliyor; boylece
//    fillPreferencesWindow'dan DUSEN bir anahtar da yakalanir.
const used = [];
const probe = Object.create(Cls.prototype);
probe.getSettings = () => settings;
for (const method of ['_switchRow', '_spinRow', '_comboRow']) {
    const real = Cls.prototype[method];
    if (typeof real !== 'function')
        throw new Error(`${method} yok`);
    probe[method] = function (s, key, ...rest) {
        used.push(key);
        return real.call(this, s, key, ...rest);
    };
}

let captured = null;
Cls.prototype.fillPreferencesWindow.call(probe, { add(page) { captured = page; } });
if (!(captured instanceof Adw.PreferencesPage))
    throw new Error('window.add bir Adw.PreferencesPage almadi');
print('ok   fillPreferencesWindow calisti ve bir Adw.PreferencesPage ekledi');

const declared = schema.list_keys().sort();
const bound = [...used].sort();
const missing = declared.filter(k => !bound.includes(k));
const unknown = bound.filter(k => !declared.includes(k));
const duplicated = bound.filter((k, i) => bound.indexOf(k) !== i);
if (missing.length)
    throw new Error(`semada olup tercihler penceresinde OLMAYAN anahtar: ${missing.join(', ')}`);
if (unknown.length)
    throw new Error(`semada olmayan anahtar baglanmis: ${unknown.join(', ')}`);
if (duplicated.length)
    throw new Error(`ayni anahtar birden fazla satira baglanmis: ${duplicated.join(', ')}`);
print(`ok   semadaki ${declared.length} anahtarin hepsi tam olarak bir satira bagli`);

// 2) bool anahtarlari: SwitchRow gercekten semaya bagli mi
const bools = declared.filter(k => schema.get_key(k).get_value_type().dup_string() === 'b');
for (const key of bools) {
    const row = probe._switchRow(settings, key, key, 'x');
    const want = settings.get_boolean(key);
    if (!(row instanceof Adw.SwitchRow))
        throw new Error(`${key}: Adw.SwitchRow degil`);
    if (row.active !== want)
        throw new Error(`${key}: row.active=${row.active}, sema=${want}`);
}
print(`ok   ${bools.length} bool anahtari SwitchRow'a bagli`);

// 3) int anahtarlari
const ints = [['strip-height', 1, 64, 1],
              ['gesture-timeout-ms', 200, 10000, 100],
              ['switch-debounce-ms', 0, 1000, 10]];
for (const [key, lo, hi, st] of ints) {
    const row = probe._spinRow(settings, key, key, lo, hi, st);
    const want = settings.get_int(key);
    if (!(row instanceof Adw.SpinRow))
        throw new Error(`${key}: Adw.SpinRow degil`);
    if (row.value !== want)
        throw new Error(`${key}: row.value=${row.value}, sema=${want}`);
    if (row.adjustment.lower !== lo || row.adjustment.upper !== hi)
        throw new Error(`${key}: aralik ${row.adjustment.lower}..${row.adjustment.upper}, beklenen ${lo}..${hi}`);
}
print(`ok   ${ints.length} sayisal anahtar SpinRow'a dogru aralikla bagli`);

// 4) combo anahtarlari: secili deger semayla ayni mi ve satir semaya YAZIYOR mu
const combos = [['active-monitors', ['all', 'secondary', 'primary']],
                ['window-order', ['mru', 'stable']],
                ['required-modifier', ['none', 'ctrl', 'alt', 'super']]];
for (const [key, values] of combos) {
    const labels = values.map(v => v.toUpperCase());
    const row = probe._comboRow(settings, key, key, 'x', values, labels);
    if (!(row instanceof Adw.ComboRow))
        throw new Error(`${key}: Adw.ComboRow degil`);
    const original = settings.get_string(key);
    if (row.selected !== values.indexOf(original))
        throw new Error(`${key}: selected=${row.selected}, sema='${original}'`);
    const target = (values.indexOf(original) + 1) % values.length;
    row.selected = target;
    Gio.Settings.sync();
    if (settings.get_string(key) !== values[target])
        throw new Error(`${key}: satir semaya yazmadi (${settings.get_string(key)})`);
    settings.set_string(key, original);
    Gio.Settings.sync();
}
print(`ok   ${combos.length} secim anahtari ComboRow'a bagli ve semaya yaziyor`);

// 5) iki yonlu yazma, sayisal ornek uzerinde
const probeRow = probe._spinRow(settings, 'strip-height', 'strip-height', 1, 64, 1);
const original = settings.get_int('strip-height');
probeRow.value = 33;
Gio.Settings.sync();
if (settings.get_int('strip-height') !== 33)
    throw new Error('bind tek yonlu');
settings.set_int('strip-height', original);
Gio.Settings.sync();
if (settings.get_int('strip-height') !== original)
    throw new Error('geri alma islemedi');
print(`ok   SpinRow -> GSettings yazma calisiyor (33 yazildi, ${original} geri alindi)`);

print('');
print(`prefs.js DOGRULANDI: semadaki ${declared.length} anahtarin hepsi gercek Adw widget'ina bagli`);
