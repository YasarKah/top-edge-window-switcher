UUID   = top-edge-window-switcher@yasarkah.github.io
EXTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: test prefs-check i18n-check check schemas install uninstall log zip pot po mo shexli

test:
	gjs -m test/run.js

schemas:
	glib-compile-schemas schemas/

install: schemas mo
	@test -n "$(UUID)" || { echo "UUID bos, kurulum reddedildi"; exit 1; }
	mkdir -p $(HOME)/.local/share/gnome-shell/extensions
	rm -rf '$(EXTDIR)'
	ln -sfn '$(CURDIR)' '$(EXTDIR)'
	@echo "Kuruldu: $(EXTDIR)"
	@echo "Etkinlestir: gnome-extensions enable $(UUID)"
	@echo "Shell'i yeniden yukle: Alt+F2 -> r -> Enter"

uninstall:
	rm -f $(EXTDIR)

log:
	journalctl -f -o cat /usr/bin/gnome-shell

prefs-check: schemas
	./test/prefs-check.sh

check: test prefs-check i18n-check

SCHEMA = schemas/org.gnome.shell.extensions.top-edge-window-switcher.gschema.xml

zip: check
	rm -rf dist
	mkdir -p dist
	gnome-extensions pack --force --out-dir=dist \
		--extra-source=lib \
		--extra-source=locale \
		--extra-source=NOTICE \
		--extra-source=LICENSE \
		--schema=$(SCHEMA) \
		.
	@echo
	@echo "Paket icerigi (EGO'ya yuklenecek):"
	@unzip -l dist/$(UUID).shell-extension.zip

DOMAIN = top-edge-window-switcher
POT    = po/$(DOMAIN).pot
POS    = $(wildcard po/*.po)

# Kaynak dizgeleri prefs.js'ten yeniden cikarir.
pot:
	xgettext --from-code=UTF-8 -L JavaScript -k_ \
		--package-name="Top Edge Window Switcher" \
		--copyright-holder="Yasar Kahramaner" \
		--msgid-bugs-address="https://github.com/YasarKah/top-edge-window-switcher/issues" \
		-o $(POT) prefs.js

# Mevcut cevirileri yeni POT ile birlestirir.
po: pot
	for f in $(POS); do msgmerge --update --backup=none $$f $(POT); done

# Calisma zamaninda okunan .mo dosyalarini uretir.
mo:
	for f in $(POS); do \
		lang=$$(basename $$f .po); \
		mkdir -p locale/$$lang/LC_MESSAGES; \
		msgfmt --check -o locale/$$lang/LC_MESSAGES/$(DOMAIN).mo $$f; \
	done
	@echo "Diller: $$(ls locale 2>/dev/null | tr '\n' ' ')"

# Her .po dosyasinda eksik/fuzzy ceviri var mi ve .mo gercekten yukleniyor mu.
i18n-check: mo
	./test/i18n-check.sh

# extensions.gnome.org'un statik analiz araci. Hedef KLASOR degil ZIP olmali:
# klasorde .git/, Makefile, test/ ve po/ gibi pakete hic girmeyen dosyalar
# bulgu uretir. Kurulu degilse atlar.
#   pip install -U shexli
shexli: zip
	@if command -v shexli >/dev/null 2>&1; then \
		shexli dist/$(UUID).shell-extension.zip; \
	else \
		echo "shexli kurulu degil, atlandi (pip install -U shexli)"; \
	fi
