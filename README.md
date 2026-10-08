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

    make check      # birim testleri + prefs.js dogrulamasi
    make test       # yalnizca birim testleri (Shell gerekmez)
    make prefs-check  # prefs.js'i gercekten insa eder (Xvfb altinda, hermetik)

## Bilinen davranış — oku

Tetik şeridi Shell'in **girdi bölgesinde** yer alır. X11'de girdi bölgesi olay
türüne bakmaz: o bantta yalnızca scroll değil **tıklama, sürükleme ve hover da**
uygulamaya hiç ulaşmaz. Pratik sonucu: panelsiz (secondary) monitörlerde
büyütülmüş bir pencereyi en üst satırından tutup taşıyamazsın.

Bu yüzden varsayılan `strip-height` **1 px**'tir — bedel tek satıra iner.
Ekranın üst kenarı imleci y=0'a kilitlediği için fareyi yukarı savurmak her
zaman şeride denk gelir, yani 1 px kullanılabilirlikten bir şey götürmez.
Pencere taşımak isterken en üst satırdan değil, 1-2 piksel aşağıdan tut.

Primary monitörde top bar zaten o bandı kapladığından orada bir kayıp yoktur;
şerit primary'de yalnızca tam ekran bir pencere paneli gizlediğinde görünür
olur ve o sırada panelin kapladığı alandan fazlasını almaz.

## Sürüm desteği

`metadata.json` yalnızca GNOME Shell **46** bildirir, çünkü test edilmiş tek
sürüm odur. Daha yeni bir sürümde denemek için listeye ekle ve en azından şunu
doğrula: şeritler scroll yakalıyor mu, top bar tıklamaları bozulmamış mı,
`disable()` sonrası iz kalmıyor mu. GNOME 50'de `affectsInputRegion`
parametresinin kaldırıldığı biliniyor ve kod bunu zaten sürüm kontrolüyle
atlıyor.

## Ayarlar

    gnome-extensions prefs topbarscrollswitcher@yasarkah.github.com
