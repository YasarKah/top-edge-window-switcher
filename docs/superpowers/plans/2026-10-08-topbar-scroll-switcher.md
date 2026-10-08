# Top Bar Scroll Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mouse imleci bir monitörün üst şeridinde iken scroll yapmak, o monitörün çalışma alanını kaplayan pencereler arasında geçiş yapar.

**Architecture:** Karar mantığı (`lib/cycler.js`) ve orkestrasyon (`lib/switcher.js`) GNOME API'si import etmez; tüm Shell teması tek bir ince sarmalayıcıda (`lib/shell.js`) toplanır. Böylece davranışın tamamı Shell çalıştırmadan `gjs` ile unit test edilir. Tetikleme hibrittir: primary monitörde `Main.panel`'in `scroll-event`'i, diğer monitörlerde input region'a eklenmiş görünmez `St.Widget` şeritleri.

**Tech Stack:** GNOME Shell 46–50 ESM eklenti API'si, GJS 1.80, Clutter/St/Meta/Shell GI, GSettings + libadwaita (prefs), `glib-compile-schemas`, test için düz `gjs -m`.

**Spec:** `docs/superpowers/specs/2026-10-08-topbar-scroll-switcher-design.md`

## Global Constraints

- UUID tam olarak `topbarscrollswitcher@yasarkah.github.com`.
- `metadata.json` → `"shell-version": ["46","47","48","49","50"]`, `"settings-schema": "org.gnome.shell.extensions.topbarscrollswitcher"`.
- Şema id'si `org.gnome.shell.extensions.topbarscrollswitcher`, yolu `/org/gnome/shell/extensions/topbarscrollswitcher/`.
- `lib/cycler.js` ve `lib/switcher.js` **hiçbir** `gi://` veya `resource:///` import'u içermez. Bu kural planın test stratejisinin temelidir; ihlali testleri çalıştırılamaz hale getirir.
- Tüm geometri mantıksal koordinatlardan (`Main.layoutManager.monitors`) okunur, X11 pikselinden değil (ortamda `global-scale-required: true`).
- `Main.layoutManager.addChrome` çağrısında `trackFullscreen: false`; `affectsInputRegion: true` yalnızca Shell ana sürümü < 50 ise geçilir (GNOME 50'de parametre kaldırıldı).
- Pencere listesi `Meta.TabList.NORMAL` ile alınır, `NORMAL_ALL` ile değil.
- Hedef pencere testi: `isFullscreen` ise `includeFullscreen` ayarına, değil ama `isMaximized` ise `includeMaximized` ayarına bakılır; ikisi de değilse hedef değildir.
- Doğrulanmış enum değerleri: `Meta.TabList.NORMAL=0`, `NORMAL_ALL=3`; `Meta.MaximizeFlags.BOTH=3`.
- Zaman her yerde **monotonik milisaniye**dir (`GLib.get_monotonic_time() / 1000`); `Cycler` zamanı yalnızca enjekte edilen `now()` ile görür, kendi zamanlayıcısı yoktur.
- `disable()` sonrası eklentiye ait hiçbir sinyal, aktör, chrome kaydı veya nesne referansı kalmaz.
- Varsayılan ayar değerleri: `strip-height=20`, `include-maximized=true`, `include-fullscreen=true`, `include-minimized=true`, `wrap-around=true`, `gesture-timeout-ms=1500`, `switch-debounce-ms=120`, `invert-direction=false`, `show-osd=true`.

## Spec'ten Bilinçli Sapmalar

Bunlar spec §6'nın "her modül bağımsız test edilebilir" hedefini daha iyi karşılamak için yapıldı ve plan boyunca tutarlı uygulanır:

1. **`lib/triggers.js` ikiye bölündü.** Spec tek bir input katmanı öngörüyordu. `lib/shell.js` (yalnızca GNOME API sarmalayıcı, unit test edilemez, bu yüzden mantık içermez) + `lib/switcher.js` (orkestrasyon, sahte bir bridge ile tam test edilir) ayrımı, test edilemeyen yüzeyi minimuma indirir.
2. **Pencere nesnesi `isTargetSize` yerine `isMaximized` ve `isFullscreen` taşır.** Spec önceden hesaplanmış tek bayrak öngörüyordu; ancak `include-maximized` ve `include-fullscreen` ayrı ayarlar olduğu için karar `Cycler` içinde verilmek zorunda.
3. **`focusedWindow` yerine `focusedId`.** Nesne değil kimlik taşımak testleri sadeleştirir, davranış aynıdır.
4. **Yeni, belgelenmiş davranış:** şerit input region'da olduğu için orada tüketilmeyen scroll alttaki pencereye **iletilmez**; secondary monitörlerin en üst `strip-height` pikselinde uygulama scroll'u çalışmaz. Varsayılan 20 px ve ayarlanabilir olması bu yüzden önemlidir; README'de açıkça yazılır.

## Review Focus

Spec'in ima ettiği ama hiçbir görevin doğal akışında test etmeyeceği, kullanıcıyı en çok ısıracak beş girdi sınıfı. Her biri için testin sahibi görev parantezde belirtildi ve o görevin adımlarına eklendi.

1. **Jest ortasında pencere başka monitöre taşınırsa** o pencere donmuş fotoğraftan düşürülür ve yürüme kalanlar arasında devam eder; monitör 0'da scroll yapan kullanıcı asla monitör 1'deki bir pencereye gönderilmemelidir. Fotoğraf 2'nin altına inerse veya üzerinde durulan pencere düşerse fotoğraf yeniden kurulur. (Görev 6)
2. **`get_monitor()` === -1 olan pencere** (henüz eşlenmemiş/kapanmakta olan) hiçbir monitörün listesine girmemeli, aksi halde var olmayan pencereye geçiş denenir. (Görev 2)
3. **Yatay scroll (LEFT/RIGHT) ve sıfır deltalı smooth scroll** hiçbir geçiş tetiklemmemeli ve olayı tüketmemeli; aksi halde yatay kaydırma jestleri pencere değiştirir. (Görev 5)
4. **Jest ortasında ayar değişirse** (ör. `include-maximized` kapatılırsa) fotoğraf geçersiz pencereler içerir; beklenen davranış fotoğrafın yeni ölçütle yeniden kurulmasıdır, çökme veya kapanmış pencereye geçiş değil. (Görev 6)
5. **Monitör takılıp çıkarılması** şeritleri yeniden kurmakla kalmamalı, `Cycler`'ın monitör indeksine bağlı tüm jest durumunu da sıfırlamalı; aksi halde indeksler kayar ve yanlış monitörün penceresine geçilir. (Görev 9)

---

### Task 1: İskelet, test koşucusu ve yüklenebilir no-op eklenti

**Files:**
- Create: `metadata.json`
- Create: `schemas/org.gnome.shell.extensions.topbarscrollswitcher.gschema.xml`
- Create: `extension.js`
- Create: `test/harness.js`
- Create: `test/run.js`
- Create: `Makefile`
- Create: `README.md`

**Interfaces:**
- Consumes: hiçbir şey (ilk görev).
- Produces: `test/harness.js` → `test(name, fn)`, `assertEqual(actual, expected, msg?)`, `assertNull(actual, msg?)`, `assertTrue(value, msg?)`, `summary() → number`. `make test` komutu testleri koşturur, `make install` symlink kurup şemayı derler.

- [ ] **Step 1: `metadata.json` oluştur**

```json
{
  "name": "Top Bar Scroll Switcher",
  "description": "Scroll in the top strip of any monitor to cycle through the windows that cover that monitor.",
  "uuid": "topbarscrollswitcher@yasarkah.github.com",
  "settings-schema": "org.gnome.shell.extensions.topbarscrollswitcher",
  "gettext-domain": "topbarscrollswitcher",
  "shell-version": ["46", "47", "48", "49", "50"],
  "version": 1
}
```

- [ ] **Step 2: GSettings şemasını oluştur**

`schemas/org.gnome.shell.extensions.topbarscrollswitcher.gschema.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <schema id="org.gnome.shell.extensions.topbarscrollswitcher"
          path="/org/gnome/shell/extensions/topbarscrollswitcher/">
    <key name="strip-height" type="i">
      <range min="1" max="64"/>
      <default>20</default>
      <summary>Trigger strip height in pixels</summary>
      <description>Height of the invisible scroll-sensitive strip at the top of each monitor.</description>
    </key>
    <key name="include-maximized" type="b">
      <default>true</default>
      <summary>Include maximized windows</summary>
      <description>Cycle through windows maximized on both axes.</description>
    </key>
    <key name="include-fullscreen" type="b">
      <default>true</default>
      <summary>Include fullscreen windows</summary>
      <description>Cycle through genuinely fullscreen windows.</description>
    </key>
    <key name="include-minimized" type="b">
      <default>true</default>
      <summary>Keep minimized windows in the cycle</summary>
      <description>When enabled, a minimized window stays in the cycle so scrolling can restore it.</description>
    </key>
    <key name="wrap-around" type="b">
      <default>true</default>
      <summary>Wrap around at the ends</summary>
      <description>Continue from the first window after the last one.</description>
    </key>
    <key name="gesture-timeout-ms" type="i">
      <range min="200" max="10000"/>
      <default>1500</default>
      <summary>Gesture timeout in milliseconds</summary>
      <description>Idle time after which the frozen window order is discarded and rebuilt from the most-recently-used order.</description>
    </key>
    <key name="switch-debounce-ms" type="i">
      <range min="0" max="1000"/>
      <default>120</default>
      <summary>Minimum milliseconds between switches</summary>
      <description>Guards against flying past windows when the mouse emits a burst of scroll events.</description>
    </key>
    <key name="invert-direction" type="b">
      <default>false</default>
      <summary>Invert scroll direction</summary>
      <description>Swap which direction scrolling up moves through the window list.</description>
    </key>
    <key name="show-osd" type="b">
      <default>true</default>
      <summary>Show the window title on switch</summary>
      <description>Display an on-screen label naming the window that was switched to.</description>
    </key>
  </schema>
</schemalist>
```

- [ ] **Step 3: Test koşucusunu yaz**

`test/harness.js`:

```js
'use strict';

const results = { pass: 0, fail: 0 };

export function test(name, fn) {
    try {
        fn();
        results.pass++;
        print(`  ok   ${name}`);
    } catch (e) {
        results.fail++;
        print(`  FAIL ${name}`);
        print(`       ${e.message}`);
    }
}

export function assertEqual(actual, expected, msg = '') {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b)
        throw new Error(`${msg} expected ${b}, got ${a}`);
}

export function assertNull(actual, msg = '') {
    if (actual !== null)
        throw new Error(`${msg} expected null, got ${JSON.stringify(actual)}`);
}

export function assertTrue(value, msg = '') {
    if (value !== true)
        throw new Error(`${msg} expected true, got ${JSON.stringify(value)}`);
}

export function summary() {
    print('');
    print(`${results.pass} passed, ${results.fail} failed`);
    return results.fail === 0 ? 0 : 1;
}
```

`test/run.js`:

```js
'use strict';

import System from 'system';
import { summary } from './harness.js';

const code = summary();
System.exit(code);
```

- [ ] **Step 4: No-op `extension.js` yaz**

```js
'use strict';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class TopBarScrollSwitcherExtension extends Extension {
    enable() {
    }

    disable() {
    }
}
```

- [ ] **Step 5: `Makefile` yaz**

**DİKKAT: Makefile'da komut satırlarının başı boşluk değil TAB karakteri olmalıdır.**

```make
UUID   = topbarscrollswitcher@yasarkah.github.com
EXTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: test schemas install uninstall log

test:
	gjs -m test/run.js

schemas:
	glib-compile-schemas schemas/

install: schemas
	mkdir -p $(HOME)/.local/share/gnome-shell/extensions
	rm -rf $(EXTDIR)
	ln -s $(CURDIR) $(EXTDIR)
	@echo "Kuruldu: $(EXTDIR)"
	@echo "Etkinlestir: gnome-extensions enable $(UUID)"
	@echo "Shell'i yeniden yukle: Alt+F2 -> r -> Enter"

uninstall:
	rm -f $(EXTDIR)

log:
	journalctl -f -o cat /usr/bin/gnome-shell
```

- [ ] **Step 6: `README.md` yaz**

```markdown
# Top Bar Scroll Switcher

GNOME Shell eklentisi. Mouse imleci bir monitörün en üst şeridinde iken scroll
yapmak, o monitörün çalışma alanını kaplayan pencereler (maximized ve gerçek
fullscreen) arasında geçiş yapar. Çoklu monitör destekler: her monitör kendi
pencere listesine sahiptir.

## Kurulum

    make install
    gnome-extensions enable topbarscrollswitcher@yasarkah.github.com

Ardından Shell'i yeniden yükle: Alt+F2 → `r` → Enter (X11). Wayland'de oturumu
yeniden açmak gerekir.

## Test

    make test

## Bilinen davranış

Tetik şeridi, pencerelerin üstündeki input bölgesinde yer alır. Bu nedenle
secondary monitörlerin en üst `strip-height` pikselinde (varsayılan 20 px)
uygulamaların kendi scroll'u çalışmaz — o bant eklentiye ayrılmıştır. Primary
monitörde top bar zaten o bandı kapladığı için bir değişiklik olmaz. Bant
yüksekliği tercihlerden değiştirilebilir.

## Ayarlar

    gnome-extensions prefs topbarscrollswitcher@yasarkah.github.com
```

- [ ] **Step 7: Test koşucusunun çalıştığını doğrula**

Run: `make test`
Expected: `0 passed, 0 failed` yazar ve çıkış kodu 0 olur. Doğrulamak için:
`make test; echo "exit=$?"` → `exit=0`.

- [ ] **Step 8: Eklentinin hatasız yüklendiğini doğrula**

Run:
```bash
make install
gnome-extensions enable topbarscrollswitcher@yasarkah.github.com
gnome-extensions info topbarscrollswitcher@yasarkah.github.com
```
Expected: `State: ACTIVE` (Shell yeniden yüklendikten sonra; Alt+F2 → `r`).
Ardından `journalctl -b -o cat /usr/bin/gnome-shell | tail -30` çıktısında
`topbarscrollswitcher` ile ilgili hata **olmamalı**.

- [ ] **Step 9: Commit**

```bash
git add metadata.json schemas extension.js test Makefile README.md .gitignore
git commit -m "feat: scaffold extension, schema and gjs test runner"
```

---

### Task 2: Cycler — aday pencere filtreleme

**Files:**
- Create: `lib/cycler.js`
- Create: `test/cycler.test.js`
- Modify: `test/run.js`

**Interfaces:**
- Consumes: `test/harness.js` → `test`, `assertEqual`, `assertNull`, `assertTrue`.
- Produces: `lib/cycler.js` → `export class Cycler`. Yapıcı: `new Cycler({ now, config })` — `now: () => number` (monotonik ms), `config` canlı okunan nesne: `{ includeMaximized, includeFullscreen, includeMinimized, wrapAround, gestureTimeoutMs, switchDebounceMs, invertDirection }`. Metot: `candidates(windows, monitorIndex) → Array<window>`. Pencere nesnesi şekli: `{ id, monitorIndex, isNormalType, isMaximized, isFullscreen, isMinimized }`.

- [ ] **Step 1: Başarısız testi yaz**

`test/cycler.test.js`:

```js
'use strict';

import { test, assertEqual, assertNull, assertTrue } from './harness.js';
import { Cycler } from '../lib/cycler.js';

export function defaultConfig() {
    return {
        includeMaximized: true,
        includeFullscreen: true,
        includeMinimized: true,
        wrapAround: true,
        gestureTimeoutMs: 1500,
        switchDebounceMs: 120,
        invertDirection: false,
    };
}

export function win(id, monitorIndex, overrides = {}) {
    return Object.assign({
        id,
        monitorIndex,
        isNormalType: true,
        isMaximized: true,
        isFullscreen: false,
        isMinimized: false,
    }, overrides);
}

function ids(windows) {
    return windows.map(w => w.id);
}

test('candidates keeps only windows on the asked monitor', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, 1), win(3, 0)];
    assertEqual(ids(c.candidates(windows, 0)), [1, 3]);
    assertEqual(ids(c.candidates(windows, 1)), [2]);
});

test('candidates preserves the given MRU order', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(7, 0), win(3, 0), win(9, 0)];
    assertEqual(ids(c.candidates(windows, 0)), [7, 3, 9]);
});

test('candidates drops windows with monitorIndex -1', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, -1)];
    assertEqual(ids(c.candidates(windows, 0)), [1]);
    assertEqual(ids(c.candidates(windows, -1)), []);
});

test('candidates drops non-normal windows', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, 0, { isNormalType: false })];
    assertEqual(ids(c.candidates(windows, 0)), [1]);
});

test('candidates drops windows that cover neither way', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, 0, { isMaximized: false })];
    assertEqual(ids(c.candidates(windows, 0)), [1]);
});

test('candidates honours includeMaximized', () => {
    const config = defaultConfig();
    config.includeMaximized = false;
    const c = new Cycler({ now: () => 0, config });
    const windows = [win(1, 0), win(2, 0, { isMaximized: false, isFullscreen: true })];
    assertEqual(ids(c.candidates(windows, 0)), [2]);
});

test('candidates honours includeFullscreen', () => {
    const config = defaultConfig();
    config.includeFullscreen = false;
    const c = new Cycler({ now: () => 0, config });
    const windows = [win(1, 0, { isFullscreen: true }), win(2, 0)];
    assertEqual(ids(c.candidates(windows, 0)), [2]);
});

test('a fullscreen window is judged by includeFullscreen even when also maximized', () => {
    const config = defaultConfig();
    config.includeFullscreen = false;
    config.includeMaximized = true;
    const c = new Cycler({ now: () => 0, config });
    const windows = [win(1, 0, { isFullscreen: true, isMaximized: true })];
    assertEqual(ids(c.candidates(windows, 0)), []);
});

test('candidates honours includeMinimized', () => {
    const config = defaultConfig();
    config.includeMinimized = false;
    const c = new Cycler({ now: () => 0, config });
    const windows = [win(1, 0), win(2, 0, { isMinimized: true })];
    assertEqual(ids(c.candidates(windows, 0)), [1]);
});

test('candidates keeps minimized windows by default', () => {
    const c = new Cycler({ now: () => 0, config: defaultConfig() });
    const windows = [win(1, 0), win(2, 0, { isMinimized: true })];
    assertEqual(ids(c.candidates(windows, 0)), [1, 2]);
});
```

`test/run.js`'i testleri yükleyecek şekilde değiştir:

```js
'use strict';

import System from 'system';
import { summary } from './harness.js';
import './cycler.test.js';

const code = summary();
System.exit(code);
```

- [ ] **Step 2: Testi koştur, başarısız olduğunu gör**

Run: `make test`
Expected: FAIL — `lib/cycler.js` yok, gjs `Error: Module not found` veya benzeri import hatası verir.

- [ ] **Step 3: Minimal implementasyonu yaz**

`lib/cycler.js`:

```js
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
```

- [ ] **Step 4: Testi koştur, geçtiğini gör**

Run: `make test`
Expected: `10 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add lib/cycler.js test/cycler.test.js test/run.js
git commit -m "feat(cycler): filter candidate windows per monitor and settings"
```

---

### Task 3: Cycler — donmuş MRU jesti

**Files:**
- Modify: `lib/cycler.js`
- Modify: `test/cycler.test.js`

**Interfaces:**
- Consumes: Görev 2'den `Cycler` yapıcısı, `candidates()`, test yardımcıları `defaultConfig()` ve `win()`.
- Produces: `cycler.handleScroll({ monitorIndex, direction, delta, windows, focusedId }) → null | { window }`. `direction: -1 | 0 | 1`, `delta: number`, `focusedId: number | null`. Dönen `window`, girilen pencere nesnesinin aynısıdır.

Jest kuralları (bu görevde kilitlenen davranış):

- Jest, bir monitör için `now - lastScrollTime > gestureTimeoutMs` olduğunda veya hiç başlamamışsa **bayat**tır.
- Bayat bir scroll'da aday listesi MRU sırasında fotoğraflanır ve indeks odaklı pencerenin fotoğraftaki konumuna ayarlanır.
- Odaklı pencere fotoğrafta **yoksa** ilk scroll, yön ne olursa olsun, doğrudan fotoğrafın başındaki (en son kullanılan) pencereyi etkinleştirir.
- Aday sayısı 2'den azsa hiçbir şey yapılmaz, fotoğraf atılır ve `null` dönülür.

- [ ] **Step 1: Başarısız testi yaz**

`test/cycler.test.js` sonuna ekle:

```js
function clockCycler(config = defaultConfig()) {
    const box = { t: 10000 };
    const c = new Cycler({ now: () => box.t, config });
    return { c, box, config };
}

test('first scroll moves one step from the focused window', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    const r = c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 });
    assertEqual(r.window.id, 2);
});

test('scrolling up from the focused window goes the other way', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    const r = c.handleScroll({ monitorIndex: 0, direction: -1, delta: 0, windows, focusedId: 2 });
    assertEqual(r.window.id, 1);
});

test('the snapshot is frozen: MRU reordering mid-gesture does not change the walk', () => {
    const { c, box } = clockCycler();
    const first = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: first, focusedId: 1 }).window.id, 2);
    box.t += 200;
    // Pencere 2 etkinlestigi icin gercek MRU listesi basa doner; fotograf buna aldirmaz.
    const reordered = [win(2, 0), win(1, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: reordered, focusedId: 2 }).window.id, 3);
});

test('the gesture expires after gestureTimeoutMs and rebuilds from MRU', () => {
    const { c, box } = clockCycler();
    const first = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: first, focusedId: 1 }).window.id, 2);
    box.t += 1501;
    const reordered = [win(2, 0), win(1, 0), win(3, 0)];
    // Bayat jest: fotograf yeniden kurulur, indeks odakli pencere 2'nin konumu (0) olur.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: reordered, focusedId: 2 }).window.id, 1);
});

test('each monitor keeps its own independent gesture', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(10, 1), win(20, 1)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 200;
    assertEqual(c.handleScroll({ monitorIndex: 1, direction: 1, delta: 0, windows, focusedId: 10 }).window.id, 20);
});

test('when the focused window is not a candidate the first scroll picks the MRU top', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(99, 1)];
    const r = c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 99 });
    assertEqual(r.window.id, 1);
});

test('a null focusedId also picks the MRU top on the first scroll', () => {
    const { c } = clockCycler();
    const windows = [win(5, 0), win(6, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: -1, delta: 0, windows, focusedId: null }).window.id, 5);
});

test('fewer than two candidates does nothing', () => {
    const { c } = clockCycler();
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: [], focusedId: null }));
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: [win(1, 0)], focusedId: 1 }));
});
```

- [ ] **Step 2: Testi koştur, başarısız olduğunu gör**

Run: `make test`
Expected: FAIL — `handleScroll is not a function`.

- [ ] **Step 3: Minimal implementasyonu yaz**

`lib/cycler.js` içinde `candidates` metodundan sonra ekle ve yapıcıyı güncelle:

```js
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
```

- [ ] **Step 4: Testi koştur, geçtiğini gör**

Run: `make test`
Expected: `18 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add lib/cycler.js test/cycler.test.js
git commit -m "feat(cycler): frozen MRU gesture with per-monitor state and timeout"
```

---

### Task 4: Cycler — indeks aritmetiği, sarma ve yön tersleme

**Files:**
- Modify: `lib/cycler.js`
- Modify: `test/cycler.test.js`

**Interfaces:**
- Consumes: Görev 3'ten `handleScroll({ monitorIndex, direction, delta, windows, focusedId })`, test yardımcıları `clockCycler()`, `defaultConfig()`, `win()`.
- Produces: Davranış değişikliği, yeni genel arayüz yok. `config.wrapAround === false` iken uçta `null` dönülür (geçiş yapılmaz). `config.invertDirection === true` iken adım yönü ters çevrilir.

- [ ] **Step 1: Başarısız testi yaz**

`test/cycler.test.js` sonuna ekle:

```js
test('wrapping forward past the end lands on the first window', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 3 }).window.id, 1);
    box.t += 200;
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
});

test('wrapping backward past the start lands on the last window', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: -1, delta: 0, windows, focusedId: 1 }).window.id, 3);
});

test('without wrapAround the walk saturates at the end and reports no switch', () => {
    const config = defaultConfig();
    config.wrapAround = false;
    const { c } = clockCycler(config);
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 3 }));
});

test('without wrapAround the walk saturates at the start and reports no switch', () => {
    const config = defaultConfig();
    config.wrapAround = false;
    const { c } = clockCycler(config);
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertNull(c.handleScroll({ monitorIndex: 0, direction: -1, delta: 0, windows, focusedId: 1 }));
});

test('without wrapAround the walk still advances away from an edge', () => {
    const config = defaultConfig();
    config.wrapAround = false;
    const { c } = clockCycler(config);
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
});

test('invertDirection reverses which way scrolling walks', () => {
    const config = defaultConfig();
    config.invertDirection = true;
    const { c } = clockCycler(config);
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }).window.id, 1);
});
```

- [ ] **Step 2: Testi koştur, başarısız olduğunu gör**

Run: `make test`
Expected: FAIL — `wrapAround` ve `invertDirection` yok sayıldığı için saturasyon testleri `expected null, got {...}` ile, tersleme testi `expected 1, got 3` ile düşer.

- [ ] **Step 3: Minimal implementasyonu yaz**

`lib/cycler.js` içinde `handleScroll`'un **`state.lastScrollTime = now;` satırından sonra gelen son dört satırını** (yani `const next = ...`'tan metodun `return`'üne kadar) şununla değiştir. `state.lastScrollTime = now;` satırı yerinde kalır:

```js
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
        return { window: state.snapshot[next] };
```

- [ ] **Step 4: Testi koştur, geçtiğini gör**

Run: `make test`
Expected: `24 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add lib/cycler.js test/cycler.test.js
git commit -m "feat(cycler): wrap-around, edge saturation and inverted direction"
```

---

### Task 5: Cycler — smooth scroll birikimi ve geçiş debounce'u

**Files:**
- Modify: `lib/cycler.js`
- Modify: `test/cycler.test.js`

**Interfaces:**
- Consumes: Görev 4'ten `handleScroll`, `_stateFor`.
- Produces: Davranış değişikliği. `direction === 0` iken `delta` biriktirilir; `|birikim| >= 1.0` olunca bir adım atılır ve birikim sıfırlanır. Taze olmayan bir jestte son geçişten `config.switchDebounceMs` geçmeden yeni geçiş yapılmaz, ancak jest canlı tutulur.

Neden gerekli: yüksek çözünürlüklü scroll (touchpad, bazı Logitech mouse'lar) tek fiziksel tık için `Clutter.ScrollDirection.SMOOTH` türünde onlarca olay üretir. Bu olmadan tek tık pencere listesinin sonuna kadar uçar.

- [ ] **Step 1: Başarısız testi yaz**

`test/cycler.test.js` sonuna ekle:

```js
test('smooth deltas below the threshold do nothing', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 }));
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 }));
});

test('an accumulated smooth delta fires exactly one step', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 });
    c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 });
    const r = c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 });
    assertEqual(r.window.id, 2);
});

test('the smooth accumulator resets after firing', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    for (let i = 0; i < 3; i++)
        c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 1 });
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0.4, windows, focusedId: 2 }));
});

test('a negative smooth delta steps the other way', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    c.handleScroll({ monitorIndex: 0, direction: 0, delta: -0.6, windows, focusedId: 1 });
    const r = c.handleScroll({ monitorIndex: 0, direction: 0, delta: -0.6, windows, focusedId: 1 });
    assertEqual(r.window.id, 3);
});

test('a zero direction with zero delta does nothing', () => {
    const { c } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 0, delta: 0, windows, focusedId: 1 }));
});

test('debounce rejects a second switch inside switchDebounceMs', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 50;
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }));
});

test('a debounced scroll keeps the gesture alive', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 50;
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }));
    box.t += 100;
    // Jest hala canli oldugu icin fotograf korunur ve yurume 2'den devam eder.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }).window.id, 3);
});

test('debounce never blocks the first scroll of a gesture', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 5000;
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 2 }).window.id, 3);
});
```

- [ ] **Step 2: Testi koştur, başarısız olduğunu gör**

Run: `make test`
Expected: FAIL — smooth testleri `expected {...}, got null` ile (delta yok sayılıyor), debounce testi `expected null, got {...}` ile düşer.

- [ ] **Step 3: Minimal implementasyonu yaz**

`lib/cycler.js` içinde `_stateFor`'u `lastSwitchTime` taşıyacak şekilde güncelle:

```js
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
```

`handleScroll`'un başındaki `const step = direction; if (step === 0) return null;` satırlarını şununla değiştir:

```js
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
```

`const stale = ...` satırının hemen ardına debounce kapısını ekle:

```js
        if (!stale && (now - state.lastSwitchTime) < cfg.switchDebounceMs) {
            state.lastScrollTime = now;
            return null;
        }
```

Son olarak geçiş yapılan **her iki** dönüş noktasında `lastSwitchTime`'ı işaretle. Bayat jestteki erken dönüşü:

```js
            if (at < 0) {
                state.index = 0;
                state.lastSwitchTime = now;
                return { window: state.snapshot[0] };
            }
```

ve metodun son dönüşünü:

```js
        if (next === state.index)
            return null;
        state.index = next;
        state.lastSwitchTime = now;
        return { window: state.snapshot[next] };
```

- [ ] **Step 4: Testi koştur, geçtiğini gör**

Run: `make test`
Expected: `32 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add lib/cycler.js test/cycler.test.js
git commit -m "feat(cycler): accumulate smooth scroll and debounce switches"
```

---

### Task 6: Cycler — fotoğraf bakımı ve durum sıfırlama

**Files:**
- Modify: `lib/cycler.js`
- Modify: `test/cycler.test.js`

**Interfaces:**
- Consumes: Görev 5'ten `handleScroll`, `candidates`, `_stateFor`.
- Produces: `cycler.reset(monitorIndex?) → void`. Argüman verilmezse tüm monitörlerin jest durumu silinir, verilirse yalnızca o monitörün. Ayrıca `handleScroll` içinde jest ortası fotoğraf bakımı: artık aday olmayan pencereler fotoğraftan düşürülür; fotoğraf 2'nin altına inerse veya üzerinde durulan pencere düşerse fotoğraf bayat jest gibi yeniden kurulur.

Bu görev Review Focus 1 ve 4'ü kapatır.

- [ ] **Step 1: Başarısız testi yaz**

`test/cycler.test.js` sonuna ekle:

```js
test('a closed window is pruned and the walk continues from where it stood', () => {
    const { c, box } = clockCycler();
    const all = [win(1, 0), win(2, 0), win(3, 0), win(4, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    // Pencere 1 kapandi; fotograf [2,3,4] olur, uzerinde durulan 2 hayatta, yurume 3'e gider.
    const after = [win(2, 0), win(3, 0), win(4, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: after, focusedId: 2 }).window.id, 3);
});

test('a window that left the monitor is pruned from the frozen snapshot', () => {
    const { c, box } = clockCycler();
    const all = [win(1, 0), win(2, 0), win(3, 0), win(4, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    // Pencere 3 monitor 1'e tasindi; monitor 0'da scroll onu asla etkinlestirmemeli.
    const moved = [win(1, 0), win(2, 0), win(3, 1), win(4, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: moved, focusedId: 2 }).window.id, 4);
});

test('pruning below two candidates rebuilds instead of switching blindly', () => {
    const { c, box } = clockCycler();
    const all = [win(1, 0), win(2, 0), win(3, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    assertNull(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: [win(2, 0)], focusedId: 2 }));
});

test('a settings change mid-gesture rebuilds the snapshot with the new criterion', () => {
    const { c, box, config } = clockCycler();
    const all = [win(1, 0), win(2, 0), win(3, 0, { isMaximized: false, isFullscreen: true }), win(4, 0, { isMaximized: false, isFullscreen: true })];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    config.includeMaximized = false;
    // Adaylar [3,4]'e duser; uzerinde durulan 2 artik aday degil, fotograf yeniden kurulur.
    // Odakli pencere 2 de aday olmadigi icin MRU tepesi olan 3 etkinlesir.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 2 }).window.id, 3);
});

test('a newly opened window is not added to a frozen snapshot', () => {
    const { c, box } = clockCycler();
    const all = [win(1, 0), win(2, 0)];
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: all, focusedId: 1 }).window.id, 2);
    box.t += 200;
    const withNew = [win(9, 0), win(1, 0), win(2, 0)];
    // Fotograf hala [1,2]; 2'den ileri sarma 1'e doner, yeni 9 jest bitene kadar girmez.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows: withNew, focusedId: 2 }).window.id, 1);
});

test('reset(monitorIndex) clears only that monitor', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0), win(10, 1), win(20, 1), win(30, 1)];
    c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 });
    c.handleScroll({ monitorIndex: 1, direction: 1, delta: 0, windows, focusedId: 10 });
    c.reset(0);
    box.t += 200;
    // Monitor 0 yeniden kuruldu: odakli 1'den bir adim -> 2.
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
    box.t += 200;
    // Monitor 1'in jesti korundu: 20'de duruyordu, bir adim -> 30.
    assertEqual(c.handleScroll({ monitorIndex: 1, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 30);
});

test('reset() clears every monitor', () => {
    const { c, box } = clockCycler();
    const windows = [win(1, 0), win(2, 0), win(3, 0)];
    c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 });
    c.reset();
    box.t += 200;
    assertEqual(c.handleScroll({ monitorIndex: 0, direction: 1, delta: 0, windows, focusedId: 1 }).window.id, 2);
});
```

- [ ] **Step 2: Testi koştur, başarısız olduğunu gör**

Run: `make test`
Expected: FAIL — `reset is not a function` ve bakım testleri yanlış pencere kimliğiyle düşer (ör. `expected 4, got 3`).

- [ ] **Step 3: Minimal implementasyonu yaz**

`lib/cycler.js` içinde `reset` ve `_startGesture` yardımcısını ekle, `handleScroll`'un fotoğraf bölümünü yeniden yaz. `handleScroll`'un tamamı şu hale gelir:

```js
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
```

Not: `pruned.length < 2` dalında fotoğraf yeniden kurulduğu için, 2'nin altına inen bir fotoğraf asla kullanılmaz.

- [ ] **Step 4: Testi koştur, geçtiğini gör**

Run: `make test`
Expected: `39 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add lib/cycler.js test/cycler.test.js
git commit -m "feat(cycler): prune and rebuild the frozen snapshot, add reset()"
```

---

### Task 7: Scroll okuma (saf) ve şeritlerin kurulması

**Files:**
- Create: `lib/scroll.js`
- Create: `test/scroll.test.js`
- Create: `lib/shell.js`
- Modify: `test/run.js`
- Modify: `extension.js`

**Interfaces:**
- Consumes: `test/harness.js` yardımcıları.
- Produces:
  - `lib/scroll.js` → `export const ScrollKind = { UP: 'up', DOWN: 'down', SMOOTH: 'smooth', OTHER: 'other' }` ve `export function scrollFromRaw(kind, deltaY) → null | { direction, delta }`.
  - `lib/shell.js` → `export function scrollFromEvent(event) → null | { direction, delta }` ve `export class ShellBridge` şu üyelerle: `get monitors`, `addStrip(monitor, height, onScroll)`, `removeStrip(monitorIndex)`, `setStripReactive(monitorIndex, reactive)`, `onMonitorsChanged(callback)`, `destroy()`. `onScroll(monitorIndex, scroll) → boolean` sözleşmesi: `true` olayı tüketir.

Bu görev Review Focus 3'ü kapatır (yatay scroll hiçbir şey yapmamalı).

- [ ] **Step 1: Başarısız testi yaz**

`test/scroll.test.js`:

```js
'use strict';

import { test, assertEqual, assertNull } from './harness.js';
import { ScrollKind, scrollFromRaw } from '../lib/scroll.js';

test('scrolling up reads as direction -1', () => {
    assertEqual(scrollFromRaw(ScrollKind.UP, 0), { direction: -1, delta: 0 });
});

test('scrolling down reads as direction +1', () => {
    assertEqual(scrollFromRaw(ScrollKind.DOWN, 0), { direction: 1, delta: 0 });
});

test('a smooth scroll carries its vertical delta and no discrete direction', () => {
    assertEqual(scrollFromRaw(ScrollKind.SMOOTH, -0.75), { direction: 0, delta: -0.75 });
});

test('a horizontal or unknown scroll reads as nothing at all', () => {
    assertNull(scrollFromRaw(ScrollKind.OTHER, 0));
    assertNull(scrollFromRaw('left', 3));
});
```

`test/run.js`'e import ekle:

```js
'use strict';

import System from 'system';
import { summary } from './harness.js';
import './cycler.test.js';
import './scroll.test.js';

const code = summary();
System.exit(code);
```

- [ ] **Step 2: Testi koştur, başarısız olduğunu gör**

Run: `make test`
Expected: FAIL — `lib/scroll.js` bulunamaz.

- [ ] **Step 3: `lib/scroll.js`'i yaz**

```js
'use strict';

export const ScrollKind = {
    UP: 'up',
    DOWN: 'down',
    SMOOTH: 'smooth',
    OTHER: 'other',
};

export function scrollFromRaw(kind, deltaY) {
    switch (kind) {
    case ScrollKind.UP:
        return { direction: -1, delta: 0 };
    case ScrollKind.DOWN:
        return { direction: 1, delta: 0 };
    case ScrollKind.SMOOTH:
        return { direction: 0, delta: deltaY };
    default:
        return null;
    }
}
```

- [ ] **Step 4: Testi koştur, geçtiğini gör**

Run: `make test`
Expected: `43 passed, 0 failed`

- [ ] **Step 5: `lib/shell.js`'i şeritlerle yaz**

```js
'use strict';

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import { ScrollKind, scrollFromRaw } from './scroll.js';

const SHELL_MAJOR = parseInt(Config.PACKAGE_VERSION.split('.')[0], 10);

function kindFromEvent(event) {
    switch (event.get_scroll_direction()) {
    case Clutter.ScrollDirection.UP:
        return ScrollKind.UP;
    case Clutter.ScrollDirection.DOWN:
        return ScrollKind.DOWN;
    case Clutter.ScrollDirection.SMOOTH:
        return ScrollKind.SMOOTH;
    default:
        return ScrollKind.OTHER;
    }
}

export function scrollFromEvent(event) {
    const kind = kindFromEvent(event);
    let deltaY = 0;
    if (kind === ScrollKind.SMOOTH)
        [, deltaY] = event.get_scroll_delta();
    return scrollFromRaw(kind, deltaY);
}

export class ShellBridge {
    constructor() {
        this._strips = new Map();
        this._signals = [];
        this._panelSignal = null;
    }

    get monitors() {
        const primaryIndex = Main.layoutManager.primaryIndex;
        return Main.layoutManager.monitors.map((monitor, index) => ({
            index,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            isPrimary: index === primaryIndex,
        }));
    }

    addStrip(monitor, height, onScroll) {
        const strip = new St.Widget({
            name: `tbss-strip-${monitor.index}`,
            reactive: true,
            opacity: 0,
            can_focus: false,
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height,
        });

        const params = { affectsStruts: false, trackFullscreen: false };
        if (SHELL_MAJOR < 50)
            params.affectsInputRegion = true;
        Main.layoutManager.addChrome(strip, params);

        const id = strip.connect('scroll-event', (_actor, event) => {
            const handled = onScroll(monitor.index, scrollFromEvent(event));
            return handled ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        });
        this._strips.set(monitor.index, { strip, id });
    }

    removeStrip(monitorIndex) {
        const entry = this._strips.get(monitorIndex);
        if (!entry)
            return;
        this._strips.delete(monitorIndex);
        entry.strip.disconnect(entry.id);
        Main.layoutManager.removeChrome(entry.strip);
        entry.strip.destroy();
    }

    setStripReactive(monitorIndex, reactive) {
        const entry = this._strips.get(monitorIndex);
        if (entry)
            entry.strip.reactive = reactive;
    }

    onMonitorsChanged(callback) {
        const id = Main.layoutManager.connect('monitors-changed', () => callback());
        this._signals.push([Main.layoutManager, id]);
    }

    destroy() {
        for (const monitorIndex of [...this._strips.keys()])
            this.removeStrip(monitorIndex);
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
    }
}
```

- [ ] **Step 6: Şeritleri gözlemlenebilir kılmak için `extension.js`'i geçici olarak bağla**

Bu bağlama Görev 10'da kalıcı hâliyle değiştirilecek; şimdilik şeritlerin gerçekten scroll yakaladığını üç monitörde kanıtlamak için var.

```js
'use strict';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { ShellBridge } from './lib/shell.js';

export default class TopBarScrollSwitcherExtension extends Extension {
    enable() {
        this._bridge = new ShellBridge();
        for (const monitor of this._bridge.monitors) {
            this._bridge.addStrip(monitor, 20, (monitorIndex, scroll) => {
                console.log(`tbss: monitor=${monitorIndex} scroll=${JSON.stringify(scroll)}`);
                return false;
            });
        }
    }

    disable() {
        this._bridge?.destroy();
        this._bridge = null;
    }
}
```

- [ ] **Step 7: Şeritlerin üç monitörde de scroll yakaladığını doğrula**

Run:
```bash
make install
gnome-extensions enable topbarscrollswitcher@yasarkah.github.com
```
Shell'i yeniden yükle: Alt+F2 → `r` → Enter. Ardından ayrı bir terminalde:
```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep tbss
```
Şimdi sırayla DP-0, DVI-D-0 ve HDMI-0 monitörlerinin en üst ~20 pikseline imleci götürüp scroll yap.

Expected: her monitör için `tbss: monitor=N scroll={"direction":1,"delta":0}` benzeri satırlar. Üç farklı `monitor=` değeri görülmeli ve bunlar `Main.layoutManager.monitors` sırasına karşılık gelmeli. Yukarı scroll `direction:-1`, aşağı scroll `direction:1` vermeli.

Eğer primary monitörde hiç satır çıkmazsa bu beklenen durumdur: orada top bar şeridin üstünde durur ve olayı panel alır — Görev 8 ve 9 bu yolu ekler.

- [ ] **Step 8: Commit**

```bash
git add lib/scroll.js lib/shell.js test/scroll.test.js test/run.js extension.js
git commit -m "feat(shell): read scroll events and install invisible strips per monitor"
```

---

### Task 8: ShellBridge — pencere listesi, etkinleştirme, OSD ve durum kapıları

**Files:**
- Modify: `lib/shell.js`
- Modify: `extension.js`

**Interfaces:**
- Consumes: Görev 7'den `ShellBridge`, `scrollFromEvent`.
- Produces: `ShellBridge`'e eklenen üyeler: `get isBlocked`, `get isPanelVisible`, `get focusedWindowId`, `listWindows()`, `activateWindow(window)`, `showOsd(monitorIndex, window)`, `connectPanelScroll(onScroll)`, `disconnectPanelScroll()`, `onPanelVisibilityChanged(callback)`. `listWindows()` şu şekilde nesneler döner: `{ id, monitorIndex, isNormalType, isMaximized, isFullscreen, isMinimized, title, metaWindow }`.

- [ ] **Step 1: `lib/shell.js`'in import bloğunu genişlet**

Dosyanın başındaki import'lara ekle:

```js
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
```

- [ ] **Step 2: Pencere ve durum üyelerini `ShellBridge`'e ekle**

`monitors` getter'ından sonra ekle:

```js
    get isBlocked() {
        return Main.overview.visible ||
               Main.modalCount > 0 ||
               Main.sessionMode.isLocked;
    }

    get isPanelVisible() {
        return Main.layoutManager.panelBox.visible;
    }

    get focusedWindowId() {
        const focused = global.display.focus_window;
        return focused ? focused.get_id() : null;
    }

    listWindows() {
        const workspace = global.workspace_manager.get_active_workspace();
        return global.display.get_tab_list(Meta.TabList.NORMAL, workspace).map(w => ({
            id: w.get_id(),
            monitorIndex: w.get_monitor(),
            isNormalType: w.window_type === Meta.WindowType.NORMAL,
            isMaximized: w.get_maximized() === Meta.MaximizeFlags.BOTH,
            isFullscreen: w.is_fullscreen(),
            isMinimized: w.minimized,
            title: w.get_title() ?? '',
            metaWindow: w,
        }));
    }

    activateWindow(window) {
        window.metaWindow.activate(global.get_current_time());
    }

    showOsd(monitorIndex, window) {
        const app = Shell.WindowTracker.get_default().get_window_app(window.metaWindow);
        const icon = app ? app.get_icon() : null;
        Main.osdWindowManager.show(
            monitorIndex,
            icon ?? new Gio.ThemedIcon({ name: 'focus-windows-symbolic' }),
            window.title,
            null);
    }

    connectPanelScroll(onScroll) {
        const id = Main.panel.connect('scroll-event', (_actor, event) => {
            const monitorIndex = Main.layoutManager.primaryIndex;
            const handled = onScroll(monitorIndex, scrollFromEvent(event));
            return handled ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        });
        this._panelSignal = [Main.panel, id];
    }

    disconnectPanelScroll() {
        if (!this._panelSignal)
            return;
        const [object, id] = this._panelSignal;
        object.disconnect(id);
        this._panelSignal = null;
    }

    onPanelVisibilityChanged(callback) {
        const panelBox = Main.layoutManager.panelBox;
        const id = panelBox.connect('notify::visible', () => callback());
        this._signals.push([panelBox, id]);
    }
```

`primaryIndex` kasten **handler'ın içinde** okunuyor: monitör düzeni değişince primary monitör değişebilir, kurulum anında yakalanan değer bayatlar.

- [ ] **Step 3: `destroy()`'u panel sinyalini de sökecek şekilde güncelle**

```js
    destroy() {
        this.disconnectPanelScroll();
        for (const monitorIndex of [...this._strips.keys()])
            this.removeStrip(monitorIndex);
        for (const [object, id] of this._signals)
            object.disconnect(id);
        this._signals = [];
    }
```

- [ ] **Step 4: `extension.js`'in geçici bağlamasını pencere dökümü yapacak şekilde genişlet**

```js
'use strict';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { ShellBridge } from './lib/shell.js';

export default class TopBarScrollSwitcherExtension extends Extension {
    enable() {
        this._bridge = new ShellBridge();
        const dump = (monitorIndex, scroll) => {
            const windows = this._bridge.listWindows()
                .filter(w => w.monitorIndex === monitorIndex)
                .map(w => `${w.id}:${w.isMaximized ? 'M' : '-'}${w.isFullscreen ? 'F' : '-'}${w.isMinimized ? 'm' : '-'}:${w.title}`);
            console.log(`tbss: monitor=${monitorIndex} scroll=${JSON.stringify(scroll)} ` +
                `blocked=${this._bridge.isBlocked} panel=${this._bridge.isPanelVisible} ` +
                `focused=${this._bridge.focusedWindowId} windows=[${windows.join(' | ')}]`);
            return false;
        };
        for (const monitor of this._bridge.monitors)
            this._bridge.addStrip(monitor, 20, dump);
        this._bridge.connectPanelScroll(dump);
    }

    disable() {
        this._bridge?.destroy();
        this._bridge = null;
    }
}
```

- [ ] **Step 5: Pencere listesinin doğru olduğunu doğrula**

Run: `make install`, Shell'i yeniden yükle (Alt+F2 → `r`), sonra
`journalctl -f -o cat /usr/bin/gnome-shell | grep tbss`

Doğrulama adımları:

1. Primary monitörde top bar üzerinde scroll yap → `monitor=` değeri primary indeks, `panel=true` olmalı ve o monitörde büyütülmüş pencereler `M` işaretiyle listelenmeli.
2. HDMI-0'ın üst şeridinde scroll yap → yalnızca o monitördeki pencereler listelenmeli; başka monitörün pencereleri listede olmamalı.
3. Bir pencereyi küçült, tekrar scroll yap → o pencere `m` işaretiyle hâlâ listede olmalı.
4. Bir pencerede F11 ile tam ekrana geç, o monitörün üst şeridinde scroll yap → pencere `F` işaretli olmalı ve satır yine düşmeli (şerit tam ekranın üstünde kalıyor).
5. Overview'u aç (Super), top bar üzerinde scroll yap → `blocked=true` olmalı.

Expected: beş maddenin hepsi yukarıdaki gibi. Özellikle 4. madde `trackFullscreen: false`'un çalıştığının kanıtıdır.

- [ ] **Step 6: Commit**

```bash
git add lib/shell.js extension.js
git commit -m "feat(shell): expose window list, activation, OSD and state gates"
```

---

### Task 9: Switcher — orkestrasyon

**Files:**
- Create: `lib/switcher.js`
- Create: `test/switcher.test.js`
- Modify: `test/run.js`

**Interfaces:**
- Consumes: Görev 6'dan `Cycler` (`handleScroll`, `reset`), Görev 7–8'den `ShellBridge`'in genel arayüzü.
- Produces: `lib/switcher.js` → `export class Switcher`. Yapıcı: `new Switcher({ bridge, cycler, config })`. Metotlar: `enable()`, `refresh()`, `disable()`. `config`'ten `stripHeight` ve `showOsd` okur.

`bridge` sözleşmesi (gerçek `ShellBridge` ve testteki sahte bridge aynısını sağlar): `get monitors`, `get isBlocked`, `get isPanelVisible`, `get focusedWindowId`, `listWindows()`, `activateWindow(w)`, `showOsd(monitorIndex, w)`, `addStrip(monitor, height, onScroll)`, `removeStrip(monitorIndex)`, `setStripReactive(monitorIndex, reactive)`, `connectPanelScroll(onScroll)`, `disconnectPanelScroll()`, `onMonitorsChanged(cb)`, `onPanelVisibilityChanged(cb)`, `destroy()`.

Bu görev Review Focus 5'i kapatır (monitör değişiminde cycler durumu sıfırlanmalı).

- [ ] **Step 1: Başarısız testi yaz**

`test/switcher.test.js`:

```js
'use strict';

import { test, assertEqual, assertNull, assertTrue } from './harness.js';
import { Switcher } from '../lib/switcher.js';

function fakeBridge(options = {}) {
    const bridge = {
        monitors: options.monitors ?? [
            { index: 0, x: 0, y: 0, width: 1920, height: 1080, isPrimary: false },
            { index: 1, x: 1920, y: 0, width: 1920, height: 1080, isPrimary: true },
        ],
        isBlocked: options.isBlocked ?? false,
        isPanelVisible: options.isPanelVisible ?? true,
        focusedWindowId: options.focusedWindowId ?? 1,
        windows: options.windows ?? [],

        strips: [],
        reactive: new Map(),
        activated: [],
        osd: [],
        panelHandler: null,
        monitorsChangedHandler: null,
        panelVisibilityHandler: null,
        destroyed: false,
        panelDisconnected: false,

        listWindows() {
            return this.windows;
        },
        activateWindow(window) {
            this.activated.push(window.id);
        },
        showOsd(monitorIndex, window) {
            this.osd.push([monitorIndex, window.id]);
        },
        addStrip(monitor, height, onScroll) {
            this.strips.push({ index: monitor.index, height, onScroll });
        },
        removeStrip(monitorIndex) {
            this.strips = this.strips.filter(s => s.index !== monitorIndex);
        },
        setStripReactive(monitorIndex, reactive) {
            this.reactive.set(monitorIndex, reactive);
        },
        connectPanelScroll(onScroll) {
            this.panelHandler = onScroll;
        },
        disconnectPanelScroll() {
            this.panelDisconnected = true;
            this.panelHandler = null;
        },
        onMonitorsChanged(callback) {
            this.monitorsChangedHandler = callback;
        },
        onPanelVisibilityChanged(callback) {
            this.panelVisibilityHandler = callback;
        },
        destroy() {
            this.destroyed = true;
        },
    };
    return bridge;
}

function fakeCycler(result) {
    return {
        calls: [],
        resets: [],
        handleScroll(args) {
            this.calls.push(args);
            return result;
        },
        reset(monitorIndex) {
            this.resets.push(monitorIndex);
        },
    };
}

function defaults() {
    return { stripHeight: 20, showOsd: true };
}

test('enable installs one strip per monitor at the configured height', () => {
    const bridge = fakeBridge();
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    switcher.enable();
    assertEqual(bridge.strips.map(s => s.index), [0, 1]);
    assertEqual(bridge.strips.map(s => s.height), [20, 20]);
});

test('a switch activates the window the cycler chose and consumes the event', () => {
    const bridge = fakeBridge({ windows: [{ id: 7 }] });
    const cycler = fakeCycler({ window: { id: 7, title: 'x' } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    const handled = bridge.strips[0].onScroll(0, { direction: 1, delta: 0 });
    assertTrue(handled);
    assertEqual(bridge.activated, [7]);
});

test('the cycler receives the monitor, the scroll and the current window state', () => {
    const windows = [{ id: 3 }];
    const bridge = fakeBridge({ windows, focusedWindowId: 3 });
    const cycler = fakeCycler(null);
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    bridge.strips[0].onScroll(0, { direction: -1, delta: 0 });
    assertEqual(cycler.calls[0].monitorIndex, 0);
    assertEqual(cycler.calls[0].direction, -1);
    assertEqual(cycler.calls[0].focusedId, 3);
    assertEqual(cycler.calls[0].windows, windows);
});

test('declining to switch leaves the event to propagate', () => {
    const bridge = fakeBridge();
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    switcher.enable();
    assertEqual(bridge.strips[0].onScroll(0, { direction: 1, delta: 0 }), false);
    assertEqual(bridge.activated, []);
});

test('a null scroll never reaches the cycler', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler({ window: { id: 1 } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    assertEqual(bridge.strips[0].onScroll(0, null), false);
    assertEqual(cycler.calls.length, 0);
});

test('nothing happens while the shell is blocked', () => {
    const bridge = fakeBridge({ isBlocked: true });
    const cycler = fakeCycler({ window: { id: 1 } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    assertEqual(bridge.strips[0].onScroll(0, { direction: 1, delta: 0 }), false);
    assertEqual(cycler.calls.length, 0);
});

test('the OSD names the window on the monitor that was scrolled', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler({ window: { id: 42, title: 'Chrome' } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    bridge.strips[1].onScroll(1, { direction: 1, delta: 0 });
    assertEqual(bridge.osd, [[1, 42]]);
});

test('showOsd false suppresses the OSD but still switches', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler({ window: { id: 42, title: 'Chrome' } });
    const config = defaults();
    config.showOsd = false;
    const switcher = new Switcher({ bridge, cycler, config });
    switcher.enable();
    bridge.strips[0].onScroll(0, { direction: 1, delta: 0 });
    assertEqual(bridge.osd, []);
    assertEqual(bridge.activated, [42]);
});

test('the primary strip is reactive only while the panel is hidden', () => {
    const bridge = fakeBridge({ isPanelVisible: true });
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    switcher.enable();
    assertEqual(bridge.reactive.get(1), false);
    bridge.isPanelVisible = false;
    bridge.panelVisibilityHandler();
    assertEqual(bridge.reactive.get(1), true);
});

test('a monitor layout change rebuilds the strips and clears all cycler state', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler(null);
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    bridge.monitors = [{ index: 0, x: 0, y: 0, width: 2560, height: 1440, isPrimary: true }];
    bridge.monitorsChangedHandler();
    assertEqual(bridge.strips.map(s => s.index), [0]);
    assertEqual(cycler.resets, [undefined]);
});

test('refresh reinstalls the strips at the new height', () => {
    const bridge = fakeBridge();
    const config = defaults();
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config });
    switcher.enable();
    config.stripHeight = 40;
    switcher.refresh();
    assertEqual(bridge.strips.map(s => s.height), [40, 40]);
});

test('disable removes every strip and tears the bridge down', () => {
    const bridge = fakeBridge();
    const switcher = new Switcher({ bridge, cycler: fakeCycler(null), config: defaults() });
    switcher.enable();
    switcher.disable();
    assertEqual(bridge.strips, []);
    assertTrue(bridge.panelDisconnected);
    assertTrue(bridge.destroyed);
});

test('a scroll arriving after disable is ignored', () => {
    const bridge = fakeBridge();
    const cycler = fakeCycler({ window: { id: 1 } });
    const switcher = new Switcher({ bridge, cycler, config: defaults() });
    switcher.enable();
    const strip = bridge.strips[0];
    switcher.disable();
    assertEqual(strip.onScroll(0, { direction: 1, delta: 0 }), false);
    assertEqual(cycler.calls.length, 0);
});
```

`test/run.js`'e import ekle:

```js
'use strict';

import System from 'system';
import { summary } from './harness.js';
import './cycler.test.js';
import './scroll.test.js';
import './switcher.test.js';

const code = summary();
System.exit(code);
```

- [ ] **Step 2: Testi koştur, başarısız olduğunu gör**

Run: `make test`
Expected: FAIL — `lib/switcher.js` bulunamaz.

- [ ] **Step 3: Minimal implementasyonu yaz**

`lib/switcher.js`:

```js
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
        this._rebuildStrips();
        this._bridge.onMonitorsChanged(() => {
            this._cycler.reset();
            this._rebuildStrips();
        });
        this._bridge.onPanelVisibilityChanged(() => this._syncPrimaryStrip());
        this._bridge.connectPanelScroll((monitorIndex, scroll) =>
            this._onScroll(monitorIndex, scroll));
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
                this._bridge.setStripReactive(monitor.index, !this._bridge.isPanelVisible);
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
```

- [ ] **Step 4: Testi koştur, geçtiğini gör**

Run: `make test`
Expected: `56 passed, 0 failed`

- [ ] **Step 5: Commit**

```bash
git add lib/switcher.js test/switcher.test.js test/run.js
git commit -m "feat(switcher): orchestrate strips, panel path and cycler decisions"
```

---

### Task 10: Eklenti yaşam döngüsü ve uçtan uca doğrulama

**Files:**
- Modify: `extension.js`

**Interfaces:**
- Consumes: Görev 6'dan `Cycler`, Görev 8'den `ShellBridge`, Görev 9'dan `Switcher`.
- Produces: Çalışan eklenti. `config` nesnesi `enable()` içinde bir kez oluşturulur ve ayar değiştikçe **yerinde** güncellenir; `Cycler` ve `Switcher` aynı nesneye referans tuttuğu için ayar değişiklikleri anında görünür.

- [ ] **Step 1: `extension.js`'i kalıcı hâliyle yaz**

Görev 7–8'deki geçici hata ayıklama bağlamasının tamamını şununla değiştir:

```js
'use strict';

import GLib from 'gi://GLib';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { Cycler } from './lib/cycler.js';
import { ShellBridge } from './lib/shell.js';
import { Switcher } from './lib/switcher.js';

export default class TopBarScrollSwitcherExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._config = {};
        this._syncConfig();

        this._settingsId = this._settings.connect('changed', () => {
            const previousHeight = this._config.stripHeight;
            this._syncConfig();
            if (this._config.stripHeight !== previousHeight)
                this._switcher?.refresh();
        });

        this._bridge = new ShellBridge();
        this._cycler = new Cycler({
            now: () => GLib.get_monotonic_time() / 1000,
            config: this._config,
        });
        this._switcher = new Switcher({
            bridge: this._bridge,
            cycler: this._cycler,
            config: this._config,
        });
        this._switcher.enable();
    }

    disable() {
        this._switcher?.disable();
        this._switcher = null;
        this._cycler = null;
        this._bridge = null;

        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        this._settings = null;
        this._config = null;
    }

    _syncConfig() {
        const settings = this._settings;
        const config = this._config;
        config.stripHeight = settings.get_int('strip-height');
        config.includeMaximized = settings.get_boolean('include-maximized');
        config.includeFullscreen = settings.get_boolean('include-fullscreen');
        config.includeMinimized = settings.get_boolean('include-minimized');
        config.wrapAround = settings.get_boolean('wrap-around');
        config.gestureTimeoutMs = settings.get_int('gesture-timeout-ms');
        config.switchDebounceMs = settings.get_int('switch-debounce-ms');
        config.invertDirection = settings.get_boolean('invert-direction');
        config.showOsd = settings.get_boolean('show-osd');
    }
}
```

Yalnızca `strip-height` değişince şeritler yeniden kurulur; diğer ayarlar `config` üzerinden canlı okunduğu için yeniden kuruluma gerek yoktur ve gereksiz aktör yıkımı önlenir.

- [ ] **Step 2: Birim testlerinin hâlâ geçtiğini doğrula**

Run: `make test`
Expected: `56 passed, 0 failed`

- [ ] **Step 3: Kurulumu yenile ve hata olmadığını doğrula**

Run:
```bash
make install
```
Shell'i yeniden yükle: Alt+F2 → `r` → Enter. Ardından:
```bash
journalctl -b -o cat /usr/bin/gnome-shell | grep -i -E "topbarscrollswitcher|tbss" | tail -20
```
Expected: hiçbir hata/uyarı satırı yok (geçici `tbss:` log satırları da artık çıkmamalı, çünkü hata ayıklama bağlaması kaldırıldı).

- [ ] **Step 4: Spec §9'un yedi maddelik kabul listesini elle doğrula**

Her maddeyi tek tek işaretle:

1. `DP-0` üst şeridinde scroll → yalnızca o monitördeki büyütülmüş/tam ekran pencereler arasında geçiş yapıyor.
2. `DVI-D-0` (primary) top bar üzerinde scroll → yalnızca o monitördeki pencereler arasında geçiş yapıyor.
3. `HDMI-0` üst şeridinde scroll → yalnızca o monitördeki pencereler arasında geçiş yapıyor.
4. Primary'de top bar tıklamaları bozulmamış: ArcMenu açılıyor, saat menüsü açılıyor, Vitals ve UTCClock menüleri açılıyor.
5. Panel öğelerinin kendi scroll davranışı korunmuş: mediacontrols / quick-settings-tweaks kaydırıcıları üzerinde scroll hâlâ onların işini yapıyor.
6. Bir pencerede F11 ile tam ekrana geçip aynı monitörün üst şeridinde scroll → geçiş çalışıyor.
7. Aynı yöne üst üste scroll pencere listesinde ilerliyor, iki pencere arasında zıplamıyor.
8. Monitör kablosunu çıkar/tak → üç monitörde de hâlâ çalışıyor, yanlış monitörün penceresine geçmiyor.
9. `gnome-extensions disable topbarscrollswitcher@yasarkah.github.com` → davranış tamamen kayboluyor, top bar normal, `journalctl`'de yeni hata yok.
10. Tekrar `enable` → yeniden çalışıyor (enable/disable döngüsü sızıntısız).

Expected: on maddenin hepsi geçer. Geçmeyen madde varsa `superpowers:systematic-debugging` ile ilerle, maddeyi atlama.

- [ ] **Step 5: Commit**

```bash
git add extension.js
git commit -m "feat: wire settings, cycler, bridge and switcher into the extension"
```

---

### Task 11: Tercihler penceresi

**Files:**
- Create: `prefs.js`

**Interfaces:**
- Consumes: Görev 1'deki GSettings şeması (dokuz anahtar).
- Produces: `prefs.js` → `export default class TopBarScrollSwitcherPrefs extends ExtensionPreferences` with `fillPreferencesWindow(window)`.

- [ ] **Step 1: `prefs.js`'i yaz**

```js
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
```

- [ ] **Step 2: Tercihler penceresinin açıldığını ve ayarları yazdığını doğrula**

Run:
```bash
gnome-extensions prefs topbarscrollswitcher@yasarkah.github.com
```
Expected: üç gruplu pencere açılır, hata vermez.

Ardından pencereden "Şerit yüksekliği"ni 40 yap ve doğrula:
```bash
gsettings --schemadir schemas get org.gnome.shell.extensions.topbarscrollswitcher strip-height
```
Expected: `40`

Son olarak secondary monitörün üst 40 pikselinde scroll'un hâlâ çalıştığını, 50. pikselde çalışmadığını kontrol et; sonra değeri 20'ye geri al.

Ayrıca "Tam ekran pencereler" anahtarını kapat, F11 ile tam ekran yapılmış bir pencerenin döngüden düştüğünü doğrula, sonra geri aç.

- [ ] **Step 3: Commit**

```bash
git add prefs.js
git commit -m "feat: add preferences window for all nine settings"
```
