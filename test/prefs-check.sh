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
mkdir -p "$TMP/stub"
printf 'export class ExtensionPreferences {}\n' > "$TMP/stub/extensionPreferences.js"
cat > "$TMP/stub.gresource.xml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<gresources>
  <gresource prefix="/org/gnome/Shell/Extensions/js">
    <file>extensionPreferences.js</file>
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
