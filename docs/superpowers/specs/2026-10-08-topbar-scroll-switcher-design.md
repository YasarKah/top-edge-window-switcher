# Top Bar Scroll Switcher — Tasarım Belgesi

- Tarih: 2026-10-08
- UUID: `topbarscrollswitcher@yasarkah.github.com`
- Hedef: GNOME Shell 46–50 (geliştirme ortamı: GNOME Shell 46.0, X11)

## 1. Amaç

Mouse imleci bir monitörün en üst şeridinde iken scroll yapmak, **o monitördeki
monitörü kaplayan pencereler** arasında geçiş yapar. Üst şerit, primary monitörde
gerçek top bar hizası, diğer monitörlerde aynı y-bandıdır.

Başarı ölçütü: üç monitörlü masaüstünde her monitörün üst kenarında scroll, yalnızca
o monitöre ait hedef pencereler arasında, aynı yöne scroll edildikçe tahmin edilebilir
biçimde ilerler; top bar tıklamaları bozulmaz; eklenti kapatıldığında iz bırakmaz.

## 2. Kullanıcı kararları ve varsayımlar

Kullanıcının verdiği kararlar:

| Karar | Seçim |
|---|---|
| Tetik alanı | Her monitörün üst şeridi; görünmez; pencerelerin üstünde |
| Geçiş sırası | MRU (son kullanılan) |
| Hedef pencere | "Şu an açık Chrome penceresi neyse o" |

Ölçüm: Chrome penceresinin `_NET_WM_STATE` değeri `_NET_WM_STATE_MAXIMIZED_HORZ,
_NET_WM_STATE_MAXIMIZED_VERT` — yani **maximized**, gerçek fullscreen değil.

Bu ölçümden türetilen ve kullanıcı tarafından onaylanan karar:

> **Hedef pencere = monitörün çalışma alanını kaplayan pencere.** Bu, maximized
> (iki eksende) pencereleri *ve* gerçek fullscreen pencereleri kapsar. Gerekçe: bir
> pencereye F11 basınca döngüden düşmesi istenmez.

Varsayımlar (ayarla değiştirilebilir, parantezde varsayılan):

- Simge durumuna küçültülmüş hedef pencereler döngüde kalır (açık) — küçültülen
  pencerenin döngüden kaybolmaması için; scroll onu geri çağırır.
- Yalnızca etkin çalışma alanı (workspace) dikkate alınır.
- Döngü sonda başa sarar (açık).

## 3. Ortam gerçekleri (ölçülmüş)

- GNOME Shell 46.0, oturum tipi **X11**, `XDG_CURRENT_DESKTOP=ubuntu:GNOME`.
- Monitörler: `DP-0` 1920×1080 @(0,0); `DVI-D-0` 1920×1080 @(1920,0) — **primary**;
  `HDMI-0` 2560×1440 @(3840,0).
- `dash-to-panel` **kurulu ama kapalı**; etkin top bar stok GNOME panelidir ve
  üzerinde ArcMenu, Vitals, UTCClock V2, astra monitor gibi tıklanabilir öğeler var.
- Mutter `experimental-features = ['scale-monitor-framebuffer']`, ancak
  DisplayConfig `global-scale-required: true` bildiriyor → monitör başına kesirli
  ölçekleme yok, global ölçek var. Yine de tüm geometri **mantıksal
  koordinatlardan** (`Main.layoutManager.monitors`) okunacak, X11 pikselinden değil.
- Primary'de maximized pencere panelin altında başlar (ölçüm: y=29). Secondary
  monitörlerde panel yoktur, maximized pencere y=0'a kadar çıkar (ölçüm: Teams PWA
  2560×1440 @(3840,0)) — yani üst şeridi tamamen kaplar.
- `gjs 1.80.2` ve `glib-compile-schemas` mevcut.
- Mutter typelib `/usr/lib/x86_64-linux-gnu/mutter-14/Meta-14.typelib`. Çalışma zamanında
  doğrulanan enum değerleri: `Meta.TabList` = NORMAL(0), DOCKS(1), GROUP(2),
  NORMAL_ALL(3); `Meta.MaximizeFlags` = HORIZONTAL(1), VERTICAL(2), BOTH(3).

## 4. Kritik teknik kısıt

X11'de bir uygulama penceresi üzerindeki scroll olayı **doğrudan istemciye** gider;
compositor onu görmez. Bu nedenle `global.stage` üzerine global `captured-event`
bağlamak çalışmaz. Olayı yakalamak için ilgili bölgede **input region'a dahil gerçek
bir Clutter aktörü** bulunmak zorundadır.

Kurulu eklentilerden doğrulanmış API'ler:

- `Main.layoutManager.addChrome(actor, { affectsInputRegion, affectsStruts, trackFullscreen })`
  — dash-to-panel `panelManager.js` ve `utils.js` içinde bu kalıpla kullanıyor.
- `Main.layoutManager.addTopChrome(actor)` — dock-window-preview, gsconnect.
- `global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace)` → MRU sırası —
  ArcMenu `openWindows.js`, Forge `window.js`.
- GNOME 50'de `affectsInputRegion` parametresi kaldırılmış; dash-to-panel
  `utils.js:334` bunu `Config.PACKAGE_VERSION >= '50'` kontrolüyle siliyor. Aynı
  korumayı uygulayacağız.

## 5. Tetikleme mimarisi — hibrit (seçilen)

Değerlendirilen üç seçenek:

- **A — Panel dahil her monitöre görünmez şerit.** Tek tip kod, ama primary'de şerit
  panelin üstüne binip top bar tıklamalarını yutar; aktörü panelin altına itmek
  (`set_child_below_sibling`) Shell'in iç aktör sıralamasına bağımlı ve kırılgan.
- **C — Yalnızca panel.** En basit, ama DP-0 ve HDMI-0'da hiç çalışmaz; kullanıcının
  çoklu monitör isteğine ters.
- **B — Hibrit. SEÇİLEN.**

### Seçilen davranış

| Monitör | Normal durum | Primary'de fullscreen pencere varken |
|---|---|---|
| Primary (`DVI-D-0`) | `Main.panel` aktörünün `scroll-event`'i | Panel gizlenir → yedek görünmez şerit devreye girer |
| Secondary (`DP-0`, `HDMI-0`) | Görünmez şerit | Görünmez şerit (değişmez) |

Görünmez şerit özellikleri: `St.Widget`, `reactive: true`, `opacity: 0`, monitörün
mantıksal `x`/`width` değerleri, `y = monitor.y`, yükseklik = ayar (varsayılan 20 px).
`addChrome(strip, { affectsInputRegion: true, affectsStruts: false, trackFullscreen: false })`
— `trackFullscreen: false`, pencere tam ekran olduğunda şeridin input region'dan
düşmemesini sağlar.

Panel yolu, scroll'un panel öğelerinden yukarı kabarmasına dayanır: bir öğe scroll'u
kendisi tüketiyorsa oraya hiç karışmayız — istenen davranış.

**Karşılıklı dışlayıcılık kuralı:** primary monitörde panel bağlantısı ile yedek şerit
asla aynı anda etkin olmaz. Yedek şerit yalnızca `Main.layoutManager.panelBox.visible`
false iken (yani primary'de fullscreen pencere varken) reactive olur; panel geri
görününce şerit `reactive: false` yapılır. Böylece tek scroll olayı iki kez işlenmez.

## 6. Modüller

Her modül tek işli, arayüzü tanımlı ve bağımsız anlaşılabilir.

### 6.1 `lib/cycler.js` — saf mantık, GNOME bağımlılığı yok

Ne yapar: hangi pencereye geçileceğine karar verir. Shell API'si import etmez;
pencereleri ve zamanı dışarıdan enjekte edilen sade nesneler üzerinden görür.

Arayüz:

```
new Cycler({ now, config })
cycler.handleScroll({ monitorIndex, direction, delta, windows, focusedWindow })
  → null | { window }   // null = hiçbir şey yapma
cycler.reset(monitorIndex?)
```

`windows`: `{ id, monitorIndex, isTargetSize, isMinimized, isNormalType }` biçiminde
MRU sıralı sade nesneler (index 0 = en son kullanılan). `direction`: `-1 | +1 | 0`,
`delta`: smooth scroll için.

`direction` ham scroll yönüdür; `config.invertDirection` **`Cycler` içinde** uygulanır
(config'e sahip olan tek modül orası), `triggers.js` içinde değil.

Sorumlulukları:

1. **Filtreleme** — `monitorIndex` eşleşen, `isNormalType` olan ve `isTargetSize` olan
   pencereler. `isMinimized` olanlar `config.includeMinimized` false ise ayrıca
   dışlanır; varsayılan true olduğu için normalde döngüde kalırlar.
2. **Donmuş MRU jesti** — monitör başına durum: `{ snapshot, index, lastScrollTime }`.
   İlk scroll'da veya `now - lastScrollTime > gestureTimeoutMs` olduğunda MRU listesi
   fotoğraflanır ve `index`, odaklı pencerenin fotoğraftaki konumuna ayarlanır
   (bulunamazsa 0). Sonraki scroll'lar fotoğraf üzerinde ilerler. Gerekçe: ham MRU'da
   her geçiş listeyi yeniden dizdiği için aynı yöne scroll iki pencere arasında zıplar;
   fotoğraf hem MRU sıralamasını hem tahmin edilebilir gezinmeyi verir.
3. **İndeks aritmetiği** — sarma açıksa modülo, kapalıysa uçlarda doyum.
4. **Smooth scroll birikimi** — `Clutter.ScrollDirection.SMOOTH` tek fiziksel tık için
   onlarca olay üretir. Delta biriktirilir, `|accum| >= 1.0` olunca bir adım atılır ve
   birikim sıfırlanır. Ayrıca iki geçiş arasında minimum `switchDebounceMs` (120 ms)
   beklenir. Bu olmazsa imleç pencere sürüsü arasında uçar.
5. **Fotoğraf bakımı** — fotoğraftaki bir pencere `windows` içinde artık yoksa (kapandı)
   listeden düşürülür ve `index` sınırlara göre düzeltilir.
6. **Yetersiz hedef** — filtrelenmiş liste 0 veya 1 eleman ise `null` döner.

### 6.2 `lib/triggers.js` — input katmanı

Ne yapar: scroll olaylarını yakalar, `(monitorIndex, direction, delta)` üçlüsüne
çevirir ve `Cycler`'a verir; dönen pencereyi etkinleştirir.

Sorumlulukları:

- Monitör başına şerit kurar/söker; `Main.layoutManager.connect('monitors-changed')`
  ile yeniden kurar.
- Primary'de `Main.panel`'e `scroll-event` bağlar; primary'de fullscreen algılanınca
  yedek şeridi açar/kapatır.
- Shell durum kapıları: `Main.overview.visible` ise, `Main.modalCount > 0` ise veya
  `Main.sessionMode.isLocked` ise olayı hiç işlemez (ve tüketmez).
- `global.display.get_tab_list(Meta.TabList.NORMAL, activeWorkspace)` sonucunu
  `Cycler`'ın beklediği sade nesnelere çevirir. **`NORMAL` seçildi, `NORMAL_ALL` değil:**
  `NORMAL_ALL` skip-taskbar pencereleri de içerir; `NORMAL` Alt+Tab'ın gördüğü kümedir
  ve kullanıcının "pencereler arasında geçiş" beklentisiyle örtüşür. Davranış yanlış
  gelirse tek satırlık değişiklik. `isTargetSize` testi:
  `w.is_fullscreen() || w.get_maximized() === Meta.MaximizeFlags.BOTH`, ayarlara göre
  her iki bileşen ayrı ayrı kapatılabilir.
- Geçişi `metaWindow.activate(global.get_current_time())` ile yapar.
- Olayı işlediyse `Clutter.EVENT_STOP`, işlemediyse `Clutter.EVENT_PROPAGATE` döner.

### 6.3 `extension.js` — yaşam döngüsü

`enable()`: GSettings açar, `Cycler` ve `TriggerManager` kurar, ayar değişikliklerini
dinler. `disable()`: tüm sinyalleri `disconnect`, tüm şeritleri
`Main.layoutManager.removeChrome` + `destroy`, zamanlayıcıları `GLib.source_remove`,
tüm alanları `null`. Eklenti incelemesinin birinci kuralı: `disable()` sonrası hiçbir
referans kalmaz.

OSD: geçişte pencere başlığını `Main.osdWindowManager.show(monitorIndex, icon, label)`
ile ilgili monitörde gösterir; `icon` bir `Gio.Icon`'dur (pencerenin uygulama simgesi,
bulunamazsa `null`), `label` pencere başlığıdır. Ayarla kapatılabilir.

### 6.4 `prefs.js` + `schemas/`

Adwaita tabanlı tek sayfa tercihler penceresi.

| Anahtar | Tip | Varsayılan |
|---|---|---|
| `strip-height` | int (1–64) | 20 |
| `include-maximized` | bool | true |
| `include-fullscreen` | bool | true |
| `include-minimized` | bool | true |
| `wrap-around` | bool | true |
| `gesture-timeout-ms` | int (200–10000) | 1500 |
| `switch-debounce-ms` | int (0–1000) | 120 |
| `invert-direction` | bool | false |
| `show-osd` | bool | true |

## 7. Veri akışı

```
scroll (panel veya şerit)
  → triggers: durum kapıları (overview/modal/lock) → geç veya bırak
  → triggers: monitorIndex, direction, delta çıkar
  → triggers: get_tab_list(NORMAL_ALL, activeWorkspace) → sade nesneler (MRU sıralı)
  → cycler.handleScroll(...) → { window } | null
  → triggers: window.activate(time); OSD göster
  → Clutter.EVENT_STOP
```

## 8. Hata ve kenar durumları

| Durum | Davranış |
|---|---|
| Hedef pencere 0 veya 1 | Sessizce hiçbir şey yapma, olayı tüketme |
| Overview açık | Yok say, olayı tüketme |
| Modal iletişim / kilit ekranı | Yok say |
| Fotoğraftaki pencere kapandı | Fotoğraftan düşür, indeksi düzelt |
| Smooth / yüksek çözünürlüklü scroll | Delta eşiği + debounce ile tek adıma indir |
| Monitör takıldı/çıkarıldı | `monitors-changed` ile şeritleri yeniden kur, jest durumlarını sıfırla |
| Primary'de fullscreen pencere panel'i gizledi | Primary için yedek şeridi etkinleştir |
| Pencere başka monitöre taşındı | Sonraki jestte yeni fotoğrafla doğal olarak düzelir |
| GNOME 50+ | `affectsInputRegion` parametresini sürüm kontrolüyle atla |

## 9. Test stratejisi

**Birim testleri (TDD, zorunlu):** `lib/cycler.js` saf olduğu için `gjs -m test/run.js`
ile Shell'siz test edilir. Kapsam: monitör filtreleme, hedef boyut filtresi, jest
fotoğrafı ve zaman aşımı, sarma açık/kapalı indeks aritmetiği, smooth delta birikimi,
debounce, kapanan pencere bakımı, 0/1 pencere durumu, yön tersleme. Zaman `now`
enjeksiyonu ile kontrol edilir — gerçek zamanlayıcı yok.

**Entegrasyon doğrulaması (elle, X11 avantajı):** Alt+F2 → `r` ile Shell yeniden
yüklenir (X11'de oturum kapatmak gerekmez), `journalctl -f -o cat /usr/bin/gnome-shell`
ile hatalar izlenir. Kontrol listesi:

1. Üç monitörün her birinde üst şeritte scroll doğru pencere setinde geçiş yapıyor.
2. Primary'de top bar tıklamaları (ArcMenu, Vitals, UTCClock, saat) bozulmamış.
3. Panel öğelerinin kendi scroll davranışı (ör. mediacontrols, quick-settings-tweaks
   kaydırıcıları) bozulmamış — bu öğeler scroll'u kendileri tükettiği için bize hiç
   ulaşmaması gerekiyor.
4. Gerçek fullscreen video açıkken ilgili monitörde şerit hâlâ çalışıyor.
5. Aynı yöne tekrar tekrar scroll pencere listesinde ilerliyor, zıplamıyor.
6. Monitör kablosu çıkarılıp takıldıktan sonra hâlâ çalışıyor.
7. Eklenti kapatılınca davranış tamamen kayboluyor, `journalctl`'de hata yok.

## 10. Paketleme

- Depo: `~/Masaüstü/projects/gnome-topbar-scroll-switcher`, dal `main`.
- Geliştirme kurulumu: depodan
  `~/.local/share/gnome-shell/extensions/topbarscrollswitcher@yasarkah.github.com`
  konumuna symlink.
- `metadata.json`: `shell-version: ["46","47","48","49","50"]`,
  `settings-schema: org.gnome.shell.extensions.topbarscrollswitcher`.
- Yardımcı betikler: `make install` (symlink + schema derleme), `make test` (gjs birim
  testleri), `make reload` (Alt+F2 `r` hatırlatması + journal takibi).

## 11. Kapsam dışı (YAGNI)

Klavye kısayolu, pencere önizlemesi/thumbnail, çalışma alanları arası geçiş, kenar
"hot corner" animasyonları, dash-to-panel ile özel entegrasyon, Wayland'a özel kod
yolları (API aynı; Wayland'da zaten çalışması beklenir ama bu sürümde doğrulanmaz).
