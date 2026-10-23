const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

// Exercise the production engine in isolation from the surrounding player UI.
const source = readFileSync(join(__dirname, '../static/js/listen-button.js'), 'utf8');
const engineSource = source.slice(source.indexOf('    function createPrerecordedEngine()'),
    source.indexOf('    // --- Engine resolver'));

function setup(fetchTiming, withAmbient = false) {
    const media = [];
    class Audio {
        constructor(src) {
            this.src = src;
            this.currentTime = 0;
            this.readyState = 0;
            this.paused = true;
            this.starts = [];
            this.listeners = {};
            media.push(this);
        }
        addEventListener(event, callback) {
            (this.listeners[event] ||= []).push(callback);
        }
        async play() {
            if (!this.readyState) {
                this.readyState = 1;
                for (const callback of this.listeners.loadedmetadata || []) callback();
            }
            this.paused = false;
            this.starts.push(this.currentTime);
            this.onplay?.();
            this.onplaying?.();
        }
        pause() { this.paused = true; }
    }
    const timing = n => ({ duration_seconds: 100, paragraphs: [{ n: 1, start: n * 10, end: n * 10 + 5 }] });
    const engine = runInNewContext(engineSource + '\ncreatePrerecordedEngine()', {
        Audio, console, ASSETS_BASE: 'https://assets.example',
        isImmersiveEnabled: () => withAmbient,
        setInterval: () => 1, clearInterval() {},
        fetch: async url => ({ ok: true, json: async () => fetchTiming ? fetchTiming(Number(url.match(/c(\d)/)[1])) : timing(Number(url.match(/c(\d)/)[1])) }),
    });
    const manifest = { chapters: [1, 2, 3].map(n => ({ n, audio_url: `c${n}.opus`, timing_url: `c${n}.json`,
        ambient_url: withAmbient ? `c${n}.ambient.opus` : null })) };
    const start = (chapter = 1, paragraph = null) => engine.speak(
        [1, 2, 3].map(n => ({ id: `c${n}p1`, text: 'Passage' })), {},
        { manifest, slug: 'book', lang: 'en', chapter }, paragraph);
    return { engine, media, start, timing };
}

test('cold paragraph start plays only the requested chapter at its target time', async () => {
    const s = setup();
    await s.start(3, 1);
    assert.equal(s.media.length, 1);
    assert.equal(s.media[0].src, 'https://assets.example/c3.opus');
    assert.deepEqual(s.media[0].starts, [30]);
});

test('ordinary playback still starts at the chapter opening', async () => {
    const s = setup();
    await s.start();
    assert.deepEqual(s.media[0].starts, [0]);
});

test('ambient playback begins at the same requested position as narration', async () => {
    const s = setup(null, true);
    await s.start(3, 1);
    assert.deepEqual(s.media[0].starts, [30]);
    assert.deepEqual(s.media[1].starts, [30]);
});

test('cross-chapter paragraph seek positions before playing; same-chapter resume also seeks', async () => {
    const s = setup();
    await s.start();
    await s.engine.seekToParagraph('c2p1');
    assert.equal(s.media[0].paused, true);
    assert.deepEqual(s.media[1].starts, [20]);
    s.engine.pause();
    s.media[1].currentTime = 24;
    await s.engine.seekToParagraph('c2p1');
    assert.deepEqual(s.media[1].starts, [20, 20]);
});

test('a delayed earlier chapter request cannot replace the latest tapped chapter', async () => {
    let releaseSecond;
    const s = setup(n => n === 2 ? new Promise(resolve => { releaseSecond = resolve; }) : s.timing(n));
    await s.start();
    const older = s.engine.seekToParagraph('c2p1');
    await s.engine.seekToParagraph('c3p1');
    releaseSecond(s.timing(2));
    assert.equal(await older, false);
    assert.equal(s.engine.getCurrentChapter(), 3);
    assert.equal(s.media.length, 2);
});

test('tapping the current chapter cancels a pending switch away from it', async () => {
    let releaseSecond;
    const s = setup(n => n === 2 ? new Promise(resolve => { releaseSecond = resolve; }) : s.timing(n));
    await s.start();
    const older = s.engine.seekToParagraph('c2p1');
    await s.engine.seekToParagraph('c1p1');
    // Let the pending metadata request enter its delayed response.
    await Promise.resolve();
    releaseSecond(s.timing(2));
    assert.equal(await older, false);
    assert.equal(s.engine.getCurrentChapter(), 1);
    assert.deepEqual(s.media[0].starts, [0]);
    assert.equal(s.media[0].currentTime, 10);
});

test('stopping prevents a pending chapter fetch from starting playback', async () => {
    let releaseSecond;
    const s = setup(n => n === 2 ? new Promise(resolve => { releaseSecond = resolve; }) : s.timing(n));
    await s.start();
    const pending = s.engine.seekToParagraph('c2p1');
    await new Promise(setImmediate);
    s.engine.stop();
    releaseSecond(s.timing(2));
    assert.equal(await pending, false);
    assert.equal(s.media.length, 1);
    assert.equal(s.media[0].paused, true);
});
