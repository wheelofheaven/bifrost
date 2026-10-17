const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(join(__dirname, '../static/js/pwa.js'), 'utf8');
const key = 'woh-install-session-start';

// Exercise the actual event handlers without a browser's install heuristic.
function visit(storage, now) {
    const listeners = {};
    const shown = [];
    const classList = { add() {}, remove() {}, toggle() {} };
    const clock = { now: () => now };
    runInNewContext(source, {
        window: {
            addEventListener(name, handler) { listeners[name] = handler; },
            WOHNotificationStack: { show(id) { shown.push(id); } },
        },
        document: {
            readyState: 'complete',
            createElement() { return { classList, setAttribute() {} }; },
            body: { classList, appendChild() {} },
            addEventListener() {},
            querySelectorAll() { return []; },
        },
        navigator: { onLine: true },
        sessionStorage: storage,
        Date: clock,
    });
    return {
        shown,
        promptAt(time = now) {
            clock.now = () => time;
            let prevented = false;
            listeners.beforeinstallprompt({ preventDefault() { prevented = true; } });
            assert.equal(prevented, true);
        },
    };
}

function memoryStorage() {
    const values = new Map();
    return {
        getItem: name => values.get(name) ?? null,
        setItem: (name, value) => values.set(name, value),
    };
}

test('first page stays quiet, including a browser event arriving much later', () => {
    const storage = memoryStorage();
    const page = visit(storage, 100000);
    page.promptAt(300000);
    assert.deepEqual(page.shown, []);
    assert.equal(storage.getItem(key), '100000');
});

test('quick navigation stays quiet; a later page after a minute can offer install', () => {
    const storage = memoryStorage();
    visit(storage, 100000);
    const quick = visit(storage, 159999);
    quick.promptAt();
    assert.deepEqual(quick.shown, []);
    const later = visit(storage, 160000);
    later.promptAt();
    assert.deepEqual(later.shown, ['install']);
});

test('blocked session storage leaves automatic offers hidden', () => {
    const page = visit({ getItem() { throw new Error('blocked'); } }, 100000);
    page.promptAt();
    assert.deepEqual(page.shown, []);
});

test('invalid or future timestamps start a fresh quiet session', () => {
    for (const value of ['invalid', '-1', '200000']) {
        const storage = memoryStorage();
        storage.setItem(key, value);
        const page = visit(storage, 100000);
        page.promptAt();
        assert.deepEqual(page.shown, []);
        assert.equal(storage.getItem(key), '100000');
    }
});
