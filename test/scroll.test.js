'use strict';

import { test, assertEqual, assertNull } from './harness.js';
import { ScrollKind, scrollFromRaw, modifierSatisfied } from '../lib/scroll.js';

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


test('no required modifier is always satisfied', () => {
    assertEqual(modifierSatisfied('none', { ctrl: false, alt: false, super: false }), true);
    assertEqual(modifierSatisfied('none', undefined), true);
});

test('a required modifier is satisfied only while it is held', () => {
    assertEqual(modifierSatisfied('ctrl', { ctrl: true, alt: false, super: false }), true);
    assertEqual(modifierSatisfied('ctrl', { ctrl: false, alt: true, super: true }), false);
});

test('each modifier is checked independently', () => {
    assertEqual(modifierSatisfied('alt', { ctrl: false, alt: true, super: false }), true);
    assertEqual(modifierSatisfied('super', { ctrl: false, alt: false, super: true }), true);
    assertEqual(modifierSatisfied('super', { ctrl: true, alt: true, super: false }), false);
});

test('a missing modifier map never satisfies a required modifier', () => {
    assertEqual(modifierSatisfied('ctrl', undefined), false);
});
