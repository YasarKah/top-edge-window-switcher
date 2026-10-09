# Top Edge Window Switcher

> [English](README.md) · **Türkçe**

Bir GNOME Shell eklentisi. **Herhangi bir monitörün üst kenarında** scroll
yapmak, o monitörü kaplayan pencereler — büyütülmüş ve gerçek tam ekran olanlar
— arasında geçiş yapar.

Her monitörün kendi listesi vardır. Sol ekranının üstünde scroll yapmak sol
ekranındaki pencereleri değiştirir, başka hiçbir şeye dokunmaz. Birincil
monitörde tetik doğrudan top bar'ın kendisidir; diğerlerinde aynı yükseklikteki
görünmez bir şerittir ve bu şerit tam ekran bir pencerenin üstünde de çalışmaya
devam eder.

## Kurulum

Kaynaktan:

```sh
make install
gnome-extensions enable top-edge-window-switcher@yasarkah.github.io
```

Ardından Shell'i yeniden yükle: X11'de <kbd>Alt</kbd>+<kbd>F2</kbd> → `r` →
<kbd>Enter</kbd>. Wayland'de oturumu kapatıp açman gerekir.

## Ayarlar

```sh
gnome-extensions prefs top-edge-window-switcher@yasarkah.github.io
```

| Ayar | Varsayılan | Ne yapar |
| --- | --- | --- |
| Büyütülmüş pencereler | açık | İki eksende büyütülmüş pencereler döngüye girer |
| Tam ekran pencereler | açık | Gerçek tam ekran pencereler döngüye girer |
| Küçültülmüş pencereler | açık | Küçültülen pencere döngüde kalır, scroll onu geri çağırır |
| Tüm çalışma alanları | kapalı | Yalnızca etkin olana değil, diğer çalışma alanlarındaki pencerelere de ulaşır |
| Geçiş sırası | son kullanılan | MRU, bir scroll boyunca dondurulur — veya pencerelerin açılış sırasına göre sabit sıra |
| Etkin monitörler | tümü | Top bar'da scroll'u kullanan başka bir eklentin varsa birincili dışarıda bırak |
| Şerit yüksekliği | 1 px | Tetik bandının yüksekliği. Yükseltmeden önce aşağıyı oku |
| Gerekli tuş | yok | Scroll'un pencere değiştirmesi için Ctrl, Alt veya Super şart koşar |
| Şeritten pencere sürükle | açık | Banttaki basış yok sayılmak yerine alttaki pencereyi taşımaya başlar |
| Sonda başa sar | açık | Son pencereden sonra ilkinden devam eder |
| Yönü ters çevir | kapalı | Yukarı scroll'un gittiği yönü değiştirir |
| Pencere adını göster | açık | Geçişte pencere başlığını ekranda gösterir |
| Jest zaman aşımı | 1500 ms | Dondurulmuş sıranın yeniden bağlanacağı boşta kalma süresi |
| Geçişler arası en az süre | 120 ms | Art arda gelen scroll olaylarında pencereleri uçarak geçmeyi engeller |

## Bilinen davranış — lütfen oku

Tetik şeridi Shell'in **girdi bölgesinde** yaşar. X11'de girdi bölgesi olay
türünü ayırt etmez: o bandın içinde yalnızca scroll değil, tıklama, sürükleme ve
hover da uygulamaya ulaşmaz.

Bedeli küçük tutan iki şey var:

1. **Varsayılan şerit yüksekliği 1 px.** Ekranın üst kenarı imleci y=0'a
   kilitlediği için fareyi yukarı savurmak her zaman şeride denk gelir — tek
   piksel kullanılabilirlikten hiçbir şey götürmez.
2. **Şerit, sol tuş basışını geri devreder.** Tıklamayı yutmak yerine alttaki
   pencerede bir taşıma işlemi başlatır, böylece büyütülmüş bir pencereyi üst
   kenarından tutup sürüklemek çalışmaya devam eder.

O tek satırın içinde yine de kaybolanlar: hover, çift tıklama, sağ tık menüleri
ve başlık çubuğu düğmeleri. `strip-height` değerini yükseltmek bu bandı
orantılı olarak büyütür; yalnızca kenara değmeden şeride isabet etmeyi tercih
ediyorsan yükselt.

Birincil monitörde bandı zaten top bar kapladığı için orada bir kayıp yoktur.
Şerit birincil monitörde yalnızca tam ekran bir pencere paneli gizlediğinde
etkinleşir.

## GNOME sürüm desteği

`metadata.json` yalnızca GNOME Shell **46** bildirir, çünkü gerçekten
çalıştırıldığı tek sürüm odur. Daha yeni bir sürümde denemek için listeye ekle
ve en azından şunları doğrula: şeritler her monitörde scroll yakalıyor mu, top
bar tıklamaları bozulmamış mı, `disable()` geriye iz bırakmıyor mu. GNOME 50'nin
`affectsInputRegion` chrome parametresini kaldırdığı biliniyor ve kod bunu
sürüm kontrolüyle zaten atlıyor.

## İlgili eklentiler

[CHC-E (Custom Hot Corners – Extended)][chce] bu alanla büyük ölçüde örtüşüyor:
bir monitör kenarındaki scroll'a *Next/Previous Window (current monitor)*
eylemini atayabiliyor, ayrıca başa sarma, küçültülmüşleri atlama ve sabit sıra
seçenekleri de sunuyor. Onu zaten kullanıyorsan buna ihtiyacın olmayabilir.

Bu eklentinin eklediği şey boyut filtresi — monitördeki her pencere yerine
yalnızca onu **kaplayan** pencereler arasında geçiş — ve hiçbir yapılandırma
gerektirmemesi. [Scroll Panel][sp] ve [Desktop Scroller][ds] top bar'da veya üst
kenarda scroll alıyor ama çalışma alanı değiştiriyor ya da birincil monitörle
sınırlı.

[chce]: https://extensions.gnome.org/extension/4167/custom-hot-corners-extended/
[sp]: https://extensions.gnome.org/extension/4257/scroll-panel/
[ds]: https://extensions.gnome.org/extension/3709/desktop-scroller-gnome-338/

## Geliştirme

```sh
make check         # aşağıdakilerin tamamı
make test          # yalnızca birim testleri, Shell gerekmez
make prefs-check   # prefs.js'i Xvfb altında gerçekten inşa eder, hermetik
make i18n-check    # kataloglar tam mı, ve .mo gerçekten yükleniyor mu
```

Karar mantığı (`lib/cycler.js`, `lib/scroll.js`, `lib/pick.js`) ve orkestrasyon
(`lib/switcher.js`) GNOME'dan hiçbir şey import etmez, bu yüzden düz `gjs` ile
koşarlar. Tüm GNOME API çağrıları kendi başına hiç mantık taşımayan
`lib/shell.js` içinde toplanmıştır.

### Çeviri

Kaynak dil İngilizce; kataloglar `po/` altında. Yeni bir dil eklemek için:

```sh
msginit --input=po/top-edge-window-switcher.pot --locale=de --output=po/de.po
# po/de.po dosyasını çevir
make check   # eksik veya fuzzy girdide ya da eskimiş POT'ta düşer
```

Arayüz dizgelerini değiştirdikten sonra `make pot && make po` çalıştır. `make
mo` katalogları `locale/` altına derler; `make install` ve `make zip` bunu
kendiliğinden yapar. Arşiv yalnızca derlenmiş `.mo` dosyalarını taşır — `.po` ve
`.pot` kaynakları depoda kalır.

### Paketleme

```sh
make zip
```

`dist/` altında extensions.gnome.org'a yüklenmeye hazır, yalnızca çalışma
zamanı dosyalarını içeren bir arşiv üretir.

## Lisans

GPL-2.0-or-later. Üçüncü taraf atıfları için `NOTICE` dosyasına bak.
