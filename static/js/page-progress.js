// Page Progress — site-wide long-form reading position
//
// The library reader has always persisted where you are in a book
// (woh_library_progress, written by library-storage.js). Nothing recorded
// the rest of the corpus, so the Continue surface could only ever offer
// books and manual bookmarks — a reader who worked through five wiki
// entries and three articles left no trace at all.
//
// This module records the equivalent for the four long-form reading
// sections, into its own key so the library's shape stays untouched:
//
//   woh_page_progress  { "<path>": { path, title, section, percent,
//                                    anchor, lang, updatedAt } }
//
// Keyed by the locale-stripped path, so an entry read in German and then
// in English is one open item rather than two.
//
// It does not run a scroll loop of its own: partials/reading-progress.html
// already computes the position on a rAF-throttled passive listener and
// emits `woh:reading-progress`. This just persists what that reports.
(function() {
    'use strict';

    const KEY = 'woh_page_progress';

    // Locales that carry a URL prefix (mirrors continue-reading.js).
    const LOCALES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh', 'zh-Hant', 'he'];

    // Sections whose pages are read start-to-finish. Deliberately narrower
    // than the hairline's content-selector list: /sources/, /datasets/ and
    // the info pages are reference surfaces you consult, not things you are
    // "part-way through", and listing them would make the count noise.
    const TRACKED_SECTIONS = ['wiki', 'articles', 'timeline', 'news'];

    // Below this the visit is a bounce, not reading. Above DONE it is
    // finished and stops being an open item.
    const MIN_PERCENT = 5;
    const DONE_PERCENT = 90;

    const MAX_ITEMS = 24;
    const MAX_AGE_DAYS = 90;
    const SAVE_DEBOUNCE_MS = 1500;

    let target = null;      // { path, title, section, lang } or null
    let percent = 0;
    let anchor = '';
    let saveTimer = null;
    let tracked = false;    // whether this page is currently in the store

    function read() {
        try {
            const raw = localStorage.getItem(KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function write(store) {
        try {
            localStorage.setItem(KEY, JSON.stringify(store));
            return true;
        } catch (e) {
            return false;
        }
    }

    function announce() {
        document.dispatchEvent(new CustomEvent('woh:continue-changed'));
    }

    // ── Identity ────────────────────────────────────────────────────────

    /**
     * Path with any locale prefix removed, normalized to a trailing slash.
     */
    function canonicalPath() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length && LOCALES.includes(parts[0])) parts.shift();
        return parts.length ? `/${parts.join('/')}/` : '/';
    }

    /**
     * The page's own heading, which is a better label than document.title
     * (that one carries the " | Wheel of Heaven" suffix).
     */
    function pageTitle() {
        const h1 = document.querySelector('main h1');
        const text = (h1?.textContent || '').trim();
        if (text) return text;
        return (document.title || '').split('|')[0].trim();
    }

    /**
     * Resolve this page to a tracked item, or null if it is not one of the
     * long-form reading pages. Section index pages (/wiki/) are excluded:
     * only leaf entries are things you are part-way through.
     */
    function resolveTarget() {
        const path = canonicalPath();
        const parts = path.split('/').filter(Boolean);
        if (parts.length < 2) return null;
        if (!TRACKED_SECTIONS.includes(parts[0])) return null;

        const title = pageTitle();
        if (!title) return null;

        return {
            path,
            title,
            section: parts[0],
            lang: document.documentElement.lang || 'en'
        };
    }

    /**
     * Nearest heading id above the fold, so resuming lands on the section
     * the reader had reached rather than the top of the page.
     */
    function currentAnchor(content) {
        if (!content) return '';
        const headings = content.querySelectorAll('h2[id], h3[id]');
        let found = '';
        for (const h of headings) {
            if (h.getBoundingClientRect().top > 120) break;
            found = h.id;
        }
        return found;
    }

    // ── Store ───────────────────────────────────────────────────────────

    function prune(store) {
        const now = Date.now();
        const entries = Object.keys(store)
            .map(path => store[path])
            .filter(record => {
                if (!record || !record.path) return false;
                const then = Date.parse(record.updatedAt);
                if (Number.isNaN(then)) return false;
                return (now - then) / 86400000 <= MAX_AGE_DAYS;
            })
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
            .slice(0, MAX_ITEMS);

        const pruned = {};
        entries.forEach(record => { pruned[record.path] = record; });
        return pruned;
    }

    function persist() {
        if (!target) return;

        const store = read();
        const existed = Object.prototype.hasOwnProperty.call(store, target.path);

        if (percent >= DONE_PERCENT) {
            // Finished. Drop it rather than parking a 100% item in the panel.
            if (!existed) return;
            delete store[target.path];
            write(prune(store));
            tracked = false;
            announce();
            return;
        }

        if (percent < MIN_PERCENT) return;

        store[target.path] = {
            path: target.path,
            title: target.title,
            section: target.section,
            percent: Math.round(percent),
            anchor,
            lang: target.lang,
            updatedAt: new Date().toISOString()
        };
        write(prune(store));

        // Only the appearance of a new item changes any badge count; a
        // percent bump on an item already in the store does not, and the
        // panel excludes the page you are currently on either way.
        if (!existed) {
            tracked = true;
            announce();
        }
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persist, SAVE_DEBOUNCE_MS);
    }

    // ── Public read side ────────────────────────────────────────────────

    function getAll() {
        const store = read();
        return Object.keys(store)
            .map(path => store[path])
            .filter(Boolean)
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }

    function remove(path) {
        const store = read();
        if (!store[path]) return false;
        delete store[path];
        write(store);
        if (target && target.path === path) tracked = false;
        announce();
        return true;
    }

    function clear() {
        write({});
        tracked = false;
        announce();
    }

    // ── Init ────────────────────────────────────────────────────────────

    function init() {
        target = resolveTarget();
        if (!target) return;

        tracked = Object.prototype.hasOwnProperty.call(read(), target.path);

        document.addEventListener('woh:reading-progress', (e) => {
            const detail = e.detail || {};
            const next = typeof detail.contentPercent === 'number'
                ? detail.contentPercent
                : detail.percent;
            if (typeof next !== 'number' || Number.isNaN(next)) return;

            percent = next;
            anchor = currentAnchor(detail.content);
            scheduleSave();
        });

        // A reader who scrolls and immediately leaves would otherwise lose
        // the position to the debounce.
        const flush = () => {
            clearTimeout(saveTimer);
            persist();
        };
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flush();
        });
    }

    window.PageProgress = {
        getAll,
        remove,
        clear,
        currentPath: () => (target ? target.path : canonicalPath()),
        isTracked: () => tracked
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
