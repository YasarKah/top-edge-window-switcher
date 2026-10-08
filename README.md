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

## Bilinen davranış

Tetik şeridi, pencerelerin üstündeki input bölgesinde yer alır. Bu nedenle
secondary monitörlerin en üst `strip-height` pikselinde (varsayılan 20 px)
uygulamaların kendi scroll'u çalışmaz — o bant eklentiye ayrılmıştır. Primary
monitörde top bar zaten o bandı kapladığı için bir değişiklik olmaz. Bant
yüksekliği tercihlerden değiştirilebilir.

## Ayarlar

    gnome-extensions prefs topbarscrollswitcher@yasarkah.github.com
