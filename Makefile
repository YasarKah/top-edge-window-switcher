UUID   = top-edge-window-switcher@yasarkah.github.io
EXTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: test prefs-check check schemas install uninstall log zip

test:
	gjs -m test/run.js

schemas:
	glib-compile-schemas schemas/

install: schemas
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

check: test prefs-check

SCHEMA = schemas/org.gnome.shell.extensions.top-edge-window-switcher.gschema.xml

zip: check
	rm -rf dist
	mkdir -p dist
	gnome-extensions pack --force --out-dir=dist \
		--extra-source=lib \
		--extra-source=NOTICE \
		--extra-source=LICENSE \
		--schema=$(SCHEMA) \
		.
	@echo
	@echo "Paket icerigi (EGO'ya yuklenecek):"
	@unzip -l dist/$(UUID).shell-extension.zip
