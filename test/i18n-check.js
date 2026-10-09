import Gettext from 'gettext';
import GLib from 'gi://GLib';

const [repo, domain, msgid, expected] = ARGV;

Gettext.bindtextdomain(domain, `${repo}/locale`);
const got = Gettext.dgettext(domain, msgid);
const loc = GLib.getenv('LC_ALL') || GLib.getenv('LANG') || '?';

if (got !== expected) {
    printerr(`HATA [${loc}] '${msgid}' -> '${got}', beklenen '${expected}'`);
    imports.system.exit(1);
}
print(`ok   [${loc}] '${msgid}' -> '${got}'`);
