'use strict';

import { test, assertEqual, assertNull } from './harness.js';
import { ScrollKind, scrollFromRaw } from '../lib/scroll.js';

test('scrolling up reads as direction -1', () => {
    assertEqual(scrollFromRaw(ScrollKind.UP, 0), { direction: -1, delta: 0 });
});

test('scrolling down reads as direction +1', () => {
    assertEqual(scrollFromRaw(ScrollKind.DOWN, 0), { direction: 1, delta: 0 });
});

test('a smooth scroll carries its vertical delta and no discrete direction', () => {
    assertEqual(scrollFromRaw(ScrollKind.SMOOTH, -0.75), { direction: 0, delta: -0.75 });
});

test('a horizontal or unknown scroll reads as nothing at all', () => {
    assertNull(scrollFromRaw(ScrollKind.OTHER, 0));
    assertNull(scrollFromRaw('left', 3));
});
