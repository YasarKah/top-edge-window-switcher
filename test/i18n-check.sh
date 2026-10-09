#!/bin/sh
# Ceviri altyapisini dogrular:
#   1. POT prefs.js ile guncel mi (unutulmus yeni dizge var mi)
#   2. her .po tam mi (eksik veya fuzzy ceviri yok)
#   3. derlenmis .mo calisma zamaninda GERCEKTEN yukleniyor mu
# Ucuncusu onemli: ilk ikisi gecip de .mo yanlis yere kurulursa kullanici
# yine Ingilizce gorur, ve bunu yalnizca gercek bir dgettext cagrisi yakalar.
set -e
REPO=$(cd "$(dirname "$0")/.." && pwd)
DOMAIN=top-edge-window-switcher
POT="$REPO/po/$DOMAIN.pot"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# 1) POT guncel mi
xgettext --from-code=UTF-8 -L JavaScript -k_ -o "$TMP/fresh.pot" "$REPO/prefs.js"
msgcomm --unique --output-file="$TMP/only-in-source.po" "$TMP/fresh.pot" "$POT" 2>/dev/null || true
if [ -s "$TMP/only-in-source.po" ] && grep -q '^msgid "..*"' "$TMP/only-in-source.po"; then
    echo "HATA: prefs.js'te POT'ta olmayan dizge var. 'make pot' calistir:" >&2
    grep '^msgid "..*"' "$TMP/only-in-source.po" >&2
    exit 1
fi
echo "ok   POT prefs.js ile guncel"

# 2) her .po tam mi
for po in "$REPO"/po/*.po; do
    [ -e "$po" ] || continue
    lang=$(basename "$po" .po)
    msgfmt --check -o /dev/null "$po"
    missing=$(msgattrib --untranslated "$po" | grep -c '^msgid "..*"' || true)
    fuzzy=$(msgattrib --fuzzy "$po" | grep -c '^msgid "..*"' || true)
    if [ "$missing" -ne 0 ] || [ "$fuzzy" -ne 0 ]; then
        echo "HATA: $lang eksik=$missing fuzzy=$fuzzy" >&2
        exit 1
    fi
    total=$(grep -c '^msgid "..*"' "$po")
    echo "ok   $lang tam ($total dizge, eksik yok, fuzzy yok)"
done

# 3) .mo gercekten yukleniyor mu: once kaynak dil, sonra her ceviri
LC_ALL=C.UTF-8 gjs -m "$REPO/test/i18n-check.js" "$REPO" "$DOMAIN" Behaviour Behaviour

for po in "$REPO"/po/*.po; do
    [ -e "$po" ] || continue
    lang=$(basename "$po" .po)
    want=$(msgattrib --translated "$po" | awk '/^msgid "Behaviour"$/{getline; sub(/^msgstr "/,""); sub(/"$/,""); print; exit}')
    [ -n "$want" ] || { echo "atla $lang: 'Behaviour' cevirisi yok"; continue; }
    if ! locale -a 2>/dev/null | grep -qi "^${lang}_.*utf8$"; then
        echo "atla $lang: sistemde ${lang}_*.UTF-8 locale yok"
        continue
    fi
    loc=$(locale -a 2>/dev/null | grep -i "^${lang}_.*utf8$" | head -1)
    LC_ALL="$loc" gjs -m "$REPO/test/i18n-check.js" "$REPO" "$DOMAIN" Behaviour "$want"
done
