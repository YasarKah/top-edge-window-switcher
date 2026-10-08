'use strict';

const results = { pass: 0, fail: 0 };

export function test(name, fn) {
    try {
        fn();
        results.pass++;
        print(`  ok   ${name}`);
    } catch (e) {
        results.fail++;
        print(`  FAIL ${name}`);
        print(`       ${e.message}`);
    }
}

export function assertEqual(actual, expected, msg = '') {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b)
        throw new Error(`${msg} expected ${b}, got ${a}`);
}

export function assertNull(actual, msg = '') {
    if (actual !== null)
        throw new Error(`${msg} expected null, got ${JSON.stringify(actual)}`);
}

export function assertTrue(value, msg = '') {
    if (value !== true)
        throw new Error(`${msg} expected true, got ${JSON.stringify(value)}`);
}

export function summary() {
    print('');
    print(`${results.pass} passed, ${results.fail} failed`);
    return results.fail === 0 ? 0 : 1;
}
