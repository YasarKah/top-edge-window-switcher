# Top Edge Window Switcher

GNOME Shell eklentisi. Bir monitörün **üst kenarında** scroll yapmak, o monitörü
kaplayan pencereler (büyütülmüş ve gerçek tam ekran) arasında geçiş yapar.

Her monitörün kendi listesi vardır: sol ekranın üstünde scroll yapmak sol ekranın
pencerelerini değiştirir, başka hiçbir şeyi etkilemez. Primary monitörde tetik
doğrudan top bar'dır; diğerlerinde aynı yükseklikteki görünmez bir şerittir ve bu
şerit tam ekran bir pencerenin üstünde de çalışmaya devam eder.

## Kurulum

    make install
    gnome-extensions enable top-edge-window-switcher@yasarkah.github.io

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

Bu yüzden iki şey yapılıyor:

1. Varsayılan `strip-height` **1 px**'tir — bedel tek satıra iner. Ekranın üst
   kenarı imleci y=0'a kilitlediği için fareyi yukarı savurmak her zaman şeride
   denk gelir, yani 1 px kullanılabilirlikten bir şey götürmez.
2. Şerit, sol tuş basışını yutmak yerine **altındaki pencerenin taşıma işlemini
   kendisi başlatır** (`begin_grab_op(MOVING)`). Böylece büyütülmüş bir pencereyi
   en üst satırından tutup taşımak normal şekilde çalışır.

Bantta hâlâ uygulamaya ulaşmayan şeyler: hover, çift tıklama, sağ tık menüsü ve
başlık çubuğu düğmeleri — hepsi yalnızca o tek piksel satırında.

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

    gnome-extensions prefs top-edge-window-switcher@yasarkah.github.io

## Çeviri

Kaynak dil İngilizce, çeviriler `po/` altında. Yeni dil eklemek için:

    msginit --input=po/top-edge-window-switcher.pot --locale=de --output=po/de.po
    # po/de.po dosyasını çevir
    make check      # eksik/fuzzy çeviri varsa ve POT eskiyse düşer

Arayüz dizgelerini değiştirdikten sonra `make pot && make po` ile katalogları
tazele. `make mo` derlenmiş `.mo` dosyalarını `locale/` altına üretir; `make
install` ve `make zip` bunu kendiliğinden yapar. Paket yalnızca derlenmiş
`.mo`'ları içerir, `.po`/`.pot` kaynakları depoda kalır.

## Paketleme

    make zip

`dist/` altında extensions.gnome.org'a yüklenebilir bir arşiv üretir; yalnızca
çalışma zamanı dosyalarını içerir (test, docs ve Makefile girmez).

## Lisans

GPL-2.0-or-later. Üçüncü taraf atıfları için `NOTICE` dosyasına bak.
