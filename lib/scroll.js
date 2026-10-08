'use strict';

export const ScrollKind = {
    UP: 'up',
    DOWN: 'down',
    SMOOTH: 'smooth',
    OTHER: 'other',
};

export function scrollFromRaw(kind, deltaY) {
    switch (kind) {
    case ScrollKind.UP:
        return { direction: -1, delta: 0 };
    case ScrollKind.DOWN:
        return { direction: 1, delta: 0 };
    case ScrollKind.SMOOTH:
        return { direction: 0, delta: deltaY };
    default:
        return null;
    }
}
