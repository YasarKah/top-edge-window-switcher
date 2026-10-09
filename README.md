# Top Edge Window Switcher

A GNOME Shell extension. Scroll at the **top edge of any monitor** to cycle
through the windows that fill that monitor — maximized and genuinely fullscreen
ones.

Each monitor keeps its own list. Scrolling at the top of your left screen
switches the windows on your left screen and touches nothing else. On the
primary monitor the trigger is the top bar itself; on the others it is an
invisible strip at the same height, which keeps working even over a fullscreen
window.

## Install

From source:

```sh
make install
gnome-extensions enable top-edge-window-switcher@yasarkah.github.io
```

Then reload the shell: <kbd>Alt</kbd>+<kbd>F2</kbd> → `r` → <kbd>Enter</kbd> on
X11. On Wayland, log out and back in.

## Settings

```sh
gnome-extensions prefs top-edge-window-switcher@yasarkah.github.io
```

| Setting | Default | What it does |
| --- | --- | --- |
| Maximized windows | on | Windows maximized on both axes join the cycle |
| Fullscreen windows | on | Genuinely fullscreen windows join the cycle |
| Minimized windows | on | A minimized window stays in the cycle, so scrolling brings it back |
| All workspaces | off | Reach windows on other workspaces, not just the active one |
| Cycle order | most recently used | MRU, frozen for one scroll — or a stable order by when each window was opened |
| Active monitors | all | Leave the primary out if another extension already uses top bar scrolling |
| Strip height | 1 px | Height of the trigger band. See below before raising it |
| Required key | none | Require Ctrl, Alt or Super before a scroll switches anything |
| Drag windows from the strip | on | A press in the band drags the window underneath instead of being discarded |
| Wrap around | on | After the last window, continue from the first |
| Invert direction | off | Swap which way scrolling up moves |
| Show the window name | on | Display the window title on screen when switching |
| Gesture timeout | 1500 ms | Idle time after which the frozen order is re-anchored |
| Minimum time between switches | 120 ms | Guards against flying past windows on a burst of scroll events |

## Known behaviour — please read

The trigger strip lives in the shell's **input region**. On X11 an input region
does not distinguish event types: inside that band, clicks, drags and hovers do
not reach the application either, not just scroll.

Two things keep the cost small:

1. **The default strip height is 1 px.** The screen's top edge clamps the
   pointer to y=0, so throwing the mouse upwards always lands on the strip —
   one pixel costs nothing in usability.
2. **The strip hands primary-button presses back.** Instead of swallowing the
   click it starts a move grab on the window underneath, so dragging a
   maximized window by its top edge still works.

Still lost inside that single row: hover, double-click, right-click menus and
titlebar buttons. Raising `strip-height` makes that band proportionally larger,
so raise it only if you prefer hitting the strip without touching the edge.

On the primary monitor the top bar already occupies the band, so nothing is
lost there. The strip only becomes active on the primary monitor while a
fullscreen window hides the panel.

## GNOME version support

`metadata.json` declares GNOME Shell **46** only, because that is the one
version this has actually run on. To try a newer release, add it to the list
and verify at least: the strips capture scroll on every monitor, top bar clicks
still work, and `disable()` leaves nothing behind. GNOME 50 is known to have
removed the `affectsInputRegion` chrome parameter, and the code already skips
it by version.

## Related extensions

[CHC-E (Custom Hot Corners – Extended)][chce] overlaps substantially: it can
assign *Next/Previous Window (current monitor)* to a scroll on a monitor edge,
and it also offers wrap-around, skip-minimized and a stable order. If you
already use it, you may not need this.

What this extension adds is the size filter — cycling only the windows that
*fill* the monitor rather than every window on it — and working with no
configuration at all. [Scroll Panel][sp] and [Desktop Scroller][ds] scroll on
the top bar or the top edge, but switch workspaces or are limited to the
primary monitor.

[chce]: https://extensions.gnome.org/extension/4167/custom-hot-corners-extended/
[sp]: https://extensions.gnome.org/extension/4257/scroll-panel/
[ds]: https://extensions.gnome.org/extension/3709/desktop-scroller-gnome-338/

## Development

```sh
make check         # everything below
make test          # unit tests only, no shell required
make prefs-check   # actually builds prefs.js under Xvfb, hermetically
make i18n-check    # catalogues complete, and the .mo really loads
```

The decision logic (`lib/cycler.js`, `lib/scroll.js`, `lib/pick.js`) and the
orchestration (`lib/switcher.js`) import nothing from GNOME, so they run under
plain `gjs`. Every GNOME API call is confined to `lib/shell.js`, which holds no
logic of its own.

### Translation

English is the source language; catalogues live in `po/`. To add one:

```sh
msginit --input=po/top-edge-window-switcher.pot --locale=de --output=po/de.po
# translate po/de.po
make check   # fails on missing or fuzzy entries, or a stale POT
```

After changing interface strings, run `make pot && make po`. `make mo` compiles
catalogues into `locale/`; `make install` and `make zip` do it for you. The
archive ships only the compiled `.mo` files — the `.po` and `.pot` sources stay
in the repository.

### Packaging

```sh
make zip
```

Produces an archive under `dist/` ready for extensions.gnome.org, containing
runtime files only.

## License

GPL-2.0-or-later. See `NOTICE` for third-party attribution.
