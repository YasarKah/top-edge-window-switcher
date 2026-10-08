UUID   = topbarscrollswitcher@yasarkah.github.com
EXTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: test prefs-check check schemas install uninstall log

test:
	gjs -m test/run.js

schemas:
	glib-compile-schemas schemas/

install: schemas
	mkdir -p $(HOME)/.local/share/gnome-shell/extensions
	rm -rf $(EXTDIR)
	ln -s $(CURDIR) $(EXTDIR)
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
