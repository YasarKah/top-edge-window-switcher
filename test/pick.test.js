'use strict';

import { test, assertEqual, assertNull } from './harness.js';
import { pickWindowAt } from '../lib/pick.js';

function w(id, x, y, width, height) {
    return { id, frame: { x, y, width, height } };
}

test('picks the first window in the list that contains the point', () => {
    const windows = [w(1, 0, 0, 100, 100), w(2, 0, 0, 100, 100)];
    assertEqual(pickWindowAt(windows, 50, 50).id, 1);
});

test('skips windows that do not contain the point', () => {
    const windows = [w(1, 200, 0, 100, 100), w(2, 0, 0, 100, 100)];
    assertEqual(pickWindowAt(windows, 50, 50).id, 2);
});

test('a point on the top edge of a window counts as inside it', () => {
    // Panelsiz monitorde buyutulmus pencerenin cercevesi y=0'dan baslar ve
    // kullanici tam oradan tutar; bu kenar DAHIL olmazsa surukleme hic baslamaz.
    const windows = [w(1, 3840, 0, 2560, 1440)];
    assertEqual(pickWindowAt(windows, 5120, 0).id, 1);
});

test('a point on the left edge of a window counts as inside it', () => {
    const windows = [w(1, 3840, 0, 2560, 1440)];
    assertEqual(pickWindowAt(windows, 3840, 0).id, 1);
});

test('a point just past the bottom right is outside', () => {
    const windows = [w(1, 0, 0, 100, 100)];
    assertNull(pickWindowAt(windows, 100, 100));
});

test('returns null when no window contains the point', () => {
    assertNull(pickWindowAt([w(1, 0, 0, 10, 10)], 500, 500));
});

test('returns null for an empty list', () => {
    assertNull(pickWindowAt([], 0, 0));
});

test('ignores entries without a frame', () => {
    const windows = [{ id: 1 }, w(2, 0, 0, 100, 100)];
    assertEqual(pickWindowAt(windows, 10, 10).id, 2);
});
