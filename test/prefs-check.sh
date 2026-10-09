#!/bin/sh
# prefs.js'i gercekten insa ederek dogrular: Adw widget'lari kuruluyor mu ve
# dokuz GSettings anahtari iki yonlu bagli mi. Shell gerekmez; ekran gerekir,
# bu yuzden varsa Xvfb altinda kosar (kullanicinin canli ekranina pencere acmaz).
set -e
REPO=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ExtensionPreferences yalnizca Shell'in prefs surecinde var; o resource yoluna
# bir stub kaydedip asil prefs.js'i import ediyoruz.
#
# TUZAK: stub'i prefs.js'in import ettigi yola kaydetmek testi HER ZAMAN yesil
# yapar, yol yanlis olsa bile -- bu bir kere gercekten oldu ve prefs penceresi
# canlida ImportError ile acilmadi. Bu yuzden once yolu GNOME'un KENDI paket
# eklentilerine karsi dogruluyoruz; onlar calistigi bilinen yer gercegidir.
EXPECTED='resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'
USED=$(grep -oh "resource:[^']*" "$REPO/prefs.js" | head -1)
if [ "$USED" != "$EXPECTED" ]; then
    echo "HATA: prefs.js '$USED' import ediyor, beklenen '$EXPECTED'" >&2
    exit 1
fi
REF=$(grep -rhoh "resource:[^']*prefs.js" \
        /usr/share/gnome-shell/extensions/*/prefs.js 2>/dev/null | sort -u | head -1)
if [ -n "$REF" ] && [ "$REF" != "$EXPECTED" ]; then
    echo "HATA: GNOME'un kendi eklentileri '$REF' kullaniyor, biz '$EXPECTED'" >&2
    exit 1
fi
echo "ok   import yolu GNOME'un kendi eklentileriyle ayni: ${REF:-(paket eklentisi yok, yalnizca sabit dogrulandi)}"
mkdir -p "$TMP/stub"
# Stub, asil prefs.js'in import ettigi her seyi saglamali: sinif ve gettext.
# gettext'i gercek katalogdan okutuyoruz, boylece bu kontrol ayni zamanda
# cevirinin prefs.js icinden de calistigini gosterir.
cat > "$TMP/stub/prefs.js" <<'STUB'
import Gettext from 'gettext';
export class ExtensionPreferences {}
export function gettext(str) {
    return Gettext.dgettext('top-edge-window-switcher', str);
}
STUB
cat > "$TMP/stub.gresource.xml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<gresources>
  <gresource prefix="/org/gnome/Shell/Extensions/js/extensions">
    <file>prefs.js</file>
  </gresource>
</gresources>
XML
glib-compile-resources --sourcedir="$TMP/stub" \
    --target="$TMP/stub.gresource" "$TMP/stub.gresource.xml"

export GSETTINGS_BACKEND=memory

if command -v xvfb-run >/dev/null 2>&1; then
    exec xvfb-run -a gjs -m "$REPO/test/prefs-check.js" "$TMP/stub.gresource" "$REPO"
else
    exec gjs -m "$REPO/test/prefs-check.js" "$TMP/stub.gresource" "$REPO"
fi
