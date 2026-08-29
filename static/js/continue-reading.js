// Continue Reading — cross-site "jump back in" surface
//
// Aggregates the reading state the site already persists, so it can be
// surfaced anywhere rather than only inside the library reader:
//
//   woh_library_progress  in-progress books (chapter/paragraph/lastRead)
//   woh_library_history   book titles (progress records predating the
//                         bookTitle field fall back to this)
//   woh_page_progress     wiki/article/timeline/news scroll position,
//                         written by page-progress.js
//   woh_listen_progress   audio position, written by listen-button.js
//   woh_library_notes     verse-anchored user notes
//   woh-reading-list      pages saved for later
//
// Deliberately reads localStorage directly instead of going through
// LibraryStorage: that module ships in library.bundle.js and is absent
// on every page outside /library/<book>/, which is exactly where this
// surface needs to work.
//
// Renders three surfaces: the reading-list panel's [data-continue-mount]
// slots, the landing hero's [data-continue-chip], and the /read/ hub's
// [data-continue-module] — plus the badges in the navbar. Loads after
// reading-list.js so the panel exists by the time this initializes.
//
// The panel is tabbed, so it offers two mounts rather than one:
// [data-continue-mount="reading"] takes the in-progress and listening
// groups, [data-continue-mount="notes"] takes the notes list.
(function() {
    'use strict';

    const KEYS = {
        PROGRESS: 'woh_library_progress',
        HISTORY: 'woh_library_history',
        NOTES: 'woh_library_notes',
        READING_LIST: 'woh-reading-list',
        PAGES: 'woh_page_progress',
        LISTEN: 'woh_listen_progress'
    };

    // An in-progress book stops being an "open item" once it has been
    // untouched this long. Without it the badge only ever grows.
    const MAX_AGE_DAYS = 90;
    const MAX_NOTES_SHOWN = 5;
    // The notes tab is a surface of its own rather than a trailing group
    // under two other lists, so it can afford a deeper slice than the
    // five that used to have to share the panel with everything else.
    const MAX_NOTES_IN_PANEL = 30;
    const MAX_MODULE_ITEMS = 6;
    const BADGE_CAP = 9;

    // Locales that carry a URL prefix. Book slugs are shared across all
    // of them, so progress recorded in one language deep-links into
    // whichever language the reader is currently browsing.
    const LOCALES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh', 'zh-Hant', 'he'];

    let readingMount = null;
    let notesMount = null;
    let chip = null;
    let module_ = null;

    function read(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }

    function t(key, fallback) {
        return window.readingListTranslations?.[key] || fallback;
    }

    // ── Model ───────────────────────────────────────────────────────────

    function localePrefix() {
        const seg = window.location.pathname.split('/')[1];
        return LOCALES.includes(seg) ? `/${seg}` : '';
    }

    /**
     * This page's path with any locale prefix stripped — the same identity
     * page-progress.js and listen-button.js store under. Derived locally
     * rather than borrowed from window.PageProgress so this module carries
     * no bundle-order dependency on it.
     */
    function canonicalPath() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts.length && LOCALES.includes(parts[0])) parts.shift();
        return parts.length ? `/${parts.join('/')}/` : '/';
    }

    function titleFromSlug(slug) {
        return String(slug)
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    function daysSince(iso) {
        const then = Date.parse(iso);
        if (Number.isNaN(then)) return Infinity;
        return (Date.now() - then) / 86400000;
    }

    /**
     * "2 days ago" in the reader's own language. Intl does the work, so
     * this needs no translation keys of its own — which matters when the
     * alternative is four more strings across ten locale tables.
     */
    function relativeTime(iso) {
        const then = Date.parse(iso);
        if (Number.isNaN(then)) return '';

        let rtf;
        try {
            rtf = new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', { numeric: 'auto' });
        } catch (e) {
            return '';
        }

        const minutes = Math.round((Date.now() - then) / 60000);
        if (minutes < 60) return rtf.format(-minutes, 'minute');
        const hours = Math.round(minutes / 60);
        if (hours < 24) return rtf.format(-hours, 'hour');
        const days = Math.round(hours / 24);
        if (days < 30) return rtf.format(-days, 'day');
        return rtf.format(-Math.round(days / 30), 'month');
    }

    // Section identity glyph, from the map section-icons.js puts on the
    // window. Empty string for an unknown section, so the chip falls back
    // to the bare label it has always rendered.
    function sectionIcon(slug) {
        return (window.WohSectionIcons && window.WohSectionIcons.markup(slug)) || '';
    }

    function sectionLabel(section) {
        const map = {
            wiki: t('sectionWiki', 'Wiki'),
            articles: t('sectionArticles', 'Articles'),
            timeline: t('sectionTimeline', 'Timeline'),
            news: t('sectionNews', 'Newsroom'),
            library: t('sectionLibrary', 'Library')
        };
        return map[section] || '';
    }

    function historyTitles() {
        const history = read(KEYS.HISTORY);
        const map = {};
        if (Array.isArray(history)) {
            history.forEach(entry => {
                if (entry && entry.bookSlug && entry.bookTitle) {
                    map[entry.bookSlug] = entry.bookTitle;
                }
            });
        }
        return map;
    }

    /**
     * Books the reader is part-way through, most recent first.
     */
    function getInProgress() {
        const progress = read(KEYS.PROGRESS);
        if (!progress || typeof progress !== 'object') return [];

        const titles = historyTitles();
        const prefix = localePrefix();

        return Object.keys(progress)
            .map(slug => {
                const record = progress[slug] || {};
                if (!record.chapter || !record.paragraph) return null;
                if (daysSince(record.lastRead) > MAX_AGE_DAYS) return null;
                return {
                    kind: 'book',
                    id: slug,
                    slug,
                    title: record.bookTitle || titles[slug] || titleFromSlug(slug),
                    chapter: record.chapter,
                    paragraph: record.paragraph,
                    section: 'library',
                    // Chapter counts aren't in the progress record, so a
                    // book reports its place rather than a percentage.
                    percent: null,
                    meta: [sectionLabel('library'), chapterLabel(record.chapter)]
                        .filter(Boolean).join(' · '),
                    lastRead: record.lastRead || '',
                    updatedAt: record.lastRead || '',
                    url: `${prefix}/library/${slug}/#c${record.chapter}p${record.paragraph}`
                };
            })
            .filter(Boolean)
            .sort((a, b) => (b.lastRead || '').localeCompare(a.lastRead || ''));
    }

    /**
     * Wiki entries, articles, timeline chapters and dispatches the reader
     * is part-way down, most recent first.
     */
    function getPagesInProgress() {
        const store = read(KEYS.PAGES);
        if (!store || typeof store !== 'object') return [];

        const prefix = localePrefix();

        return Object.keys(store)
            .map(path => {
                const record = store[path] || {};
                if (!record.path || !record.title) return null;
                if (daysSince(record.updatedAt) > MAX_AGE_DAYS) return null;
                return {
                    kind: 'page',
                    id: record.path,
                    title: record.title,
                    section: record.section || '',
                    percent: typeof record.percent === 'number' ? record.percent : null,
                    meta: sectionLabel(record.section),
                    updatedAt: record.updatedAt || '',
                    url: `${prefix}${record.path}${record.anchor ? `#${record.anchor}` : ''}`
                };
            })
            .filter(Boolean)
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }

    /**
     * Pages with an unfinished audio session.
     */
    function getListening() {
        const store = read(KEYS.LISTEN);
        if (!store || typeof store !== 'object') return [];

        const prefix = localePrefix();

        return Object.keys(store)
            .map(path => {
                const record = store[path] || {};
                if (!record.path || !record.title) return null;
                if (daysSince(record.updatedAt) > MAX_AGE_DAYS) return null;
                const parts = [sectionLabel(record.section)];
                if (record.chapter != null) parts.push(chapterLabel(record.chapter));
                return {
                    kind: 'audio',
                    id: record.path,
                    title: record.title,
                    section: record.section || '',
                    percent: typeof record.percent === 'number' ? record.percent : null,
                    meta: parts.filter(Boolean).join(' · '),
                    updatedAt: record.updatedAt || '',
                    url: `${prefix}${record.path}`
                };
            })
            .filter(Boolean)
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }

    /**
     * Everything the reader is mid-way through — books and pages together,
     * newest first — minus the page they are looking at right now, which is
     * not somewhere to "jump back" to.
     */
    function getContinueItems() {
        const here = canonicalPath();
        const hereBook = here.startsWith('/library/') ? here.split('/')[2] : null;

        return getInProgress()
            .filter(item => item.slug !== hereBook)
            .concat(getPagesInProgress().filter(item => item.id !== here))
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }

    function getListeningItems() {
        const here = canonicalPath();
        return getListening().filter(item => item.id !== here);
    }

    /**
     * Most recently touched notes across every book.
     */
    function getRecentNotes(limit = MAX_NOTES_SHOWN) {
        const all = read(KEYS.NOTES);
        if (!all || typeof all !== 'object') return [];

        const titles = historyTitles();
        const prefix = localePrefix();
        const out = [];

        Object.keys(all).forEach(slug => {
            (all[slug] || []).forEach(note => {
                if (!note || !note.content) return;
                const chapter = note.chapter != null ? note.chapter : parseChapter(note.refId);
                const paragraph = note.paragraph != null ? note.paragraph : parseParagraph(note.refId);
                out.push({
                    slug,
                    refId: note.refId,
                    content: note.content,
                    quote: note.quote || '',
                    chapter,
                    paragraph,
                    bookTitle: note.bookTitle || titles[slug] || titleFromSlug(slug),
                    updatedAt: note.updatedAt || note.createdAt || '',
                    url: chapter != null && paragraph != null
                        ? `${prefix}/library/${slug}/#c${chapter}p${paragraph}`
                        : `${prefix}/library/${slug}/`
                });
            });
        });

        return out
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
            .slice(0, limit);
    }

    // Book codes contain hyphens (GEN-WOH-1:1), so match the code greedily.
    function parseChapter(refId) {
        const m = typeof refId === 'string' ? refId.match(/^.+-(\d+):(\d+)$/) : null;
        return m ? Number(m[1]) : null;
    }

    function parseParagraph(refId) {
        const m = typeof refId === 'string' ? refId.match(/^.+-(\d+):(\d+)$/) : null;
        return m ? Number(m[2]) : null;
    }

    function savedCount() {
        const list = read(KEYS.READING_LIST);
        return Array.isArray(list) ? list.length : 0;
    }

    function notesCount() {
        const all = read(KEYS.NOTES);
        if (!all || typeof all !== 'object') return 0;
        return Object.keys(all).reduce((sum, slug) => sum + (all[slug] || []).length, 0);
    }

    /**
     * Everything the reader is part-way through, read or listened. This is
     * the panel's reading tab, and the first two thirds of the badge.
     */
    function readingCount() {
        return getContinueItems().length + getListeningItems().length;
    }

    /**
     * Items a reader can act on right now: things in progress — read or
     * listened — plus things saved for later. Notes are annotations on
     * those, not a separate pile of unfinished business, so they stay out
     * of the badge count.
     */
    function openItemCount() {
        return readingCount() + savedCount();
    }

    /**
     * Drop an item from whichever store it came from.
     */
    function dismiss(kind, id) {
        const key = kind === 'book' ? KEYS.PROGRESS
            : kind === 'page' ? KEYS.PAGES
            : kind === 'audio' ? KEYS.LISTEN
            : null;
        if (!key) return false;

        const store = read(key);
        if (!store || !store[id]) return false;
        delete store[id];
        write(key, store);
        refresh();
        return true;
    }

    // ── Badges ──────────────────────────────────────────────────────────

    function updateBadges() {
        const count = openItemCount();
        const label = t('continueBadgeLabel', 'items to continue reading');
        document.querySelectorAll('[data-continue-badge]').forEach(badge => {
            badge.textContent = count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
            // "items to continue reading: 1" rather than "1 items to
            // continue reading" — the label is a plural noun phrase in
            // every locale table, and prefixing the count made it
            // ungrammatical at one. Reading it as a label/value pair works
            // for any count without a plural rule per language.
            badge.setAttribute('aria-label', `${label}: ${count}`);
            badge.classList.toggle('nav-badge--visible', count > 0);
        });
    }

    // ── Markup helpers ──────────────────────────────────────────────────

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function truncate(text, length) {
        const s = String(text || '');
        return s.length <= length ? s : `${s.substring(0, length).trim()}…`;
    }

    function chapterLabel(n) {
        return t('continueChapterFormat', 'Ch. {n}').replace('{n}', n);
    }

    /**
     * "42% · 2 days ago" — how far in, and how long ago.
     */
    function detailLine(item) {
        return [
            item.percent != null ? `${Math.round(item.percent)}%` : '',
            relativeTime(item.updatedAt)
        ].filter(Boolean).join(' · ');
    }

    /**
     * "Wiki · 42% · 2 days ago" — detailLine with the section in front, for
     * the surfaces that show one line per item. The /read/ module puts the
     * section in its own eyebrow instead and uses detailLine directly, so
     * the two don't repeat each other.
     */
    function metaLine(item) {
        return [item.meta, detailLine(item)].filter(Boolean).join(' · ');
    }

    function progressBarMarkup(item) {
        if (item.percent == null) return '';
        return `<span class="continue-bar" style="--continue-progress: ${Math.round(item.percent)}%" aria-hidden="true"></span>`;
    }

    // ── Panel groups ────────────────────────────────────────────────────

    function groupMarkup(titleKey, titleFallback, itemsHtml) {
        return `
            <section class="reading-list-panel__group">
                <h3 class="reading-list-panel__group-title">${escapeHtml(t(titleKey, titleFallback))}</h3>
                ${listMarkup(itemsHtml)}
            </section>
        `;
    }

    // A group's list without its heading, for the tabs where the pill
    // above already names what is in it.
    function listMarkup(itemsHtml) {
        return `<ul class="reading-list-panel__list">${itemsHtml}</ul>`;
    }

    /**
     * One open item. The section, the title and the quantitative line are
     * three separate elements rather than one run-together string: the
     * section is an accent chip, the title carries the weight, and
     * "42% · 2 hours ago" sits under both in the quieter tech face — the
     * same three-part shape `.search-result` and the /read/ cards use.
     */
    function progressItemMarkup(item) {
        const detail = detailLine(item);
        // Name the item in the label. With several rows open, a column of
        // buttons all announcing "Remove from continue list" tells a screen
        // reader user nothing about which one they are on.
        const removeLabel = `${t('continueRemove', 'Remove from continue list')}: ${item.title}`;
        return `
            <li class="reading-list-panel__item">
                <a href="${escapeHtml(item.url)}" class="reading-list-panel__link">
                    ${item.meta ? `<span class="reading-list-panel__section">${sectionIcon(item.section)}${escapeHtml(item.meta)}</span>` : ''}
                    <span class="reading-list-panel__item-title">${escapeHtml(item.title)}</span>
                    ${detail ? `<span class="reading-list-panel__meta">${escapeHtml(detail)}</span>` : ''}
                    ${progressBarMarkup(item)}
                </a>
                <button
                    class="reading-list-panel__remove"
                    data-continue-dismiss="${escapeHtml(item.id)}"
                    data-continue-kind="${escapeHtml(item.kind)}"
                    aria-label="${escapeHtml(removeLabel)}"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </li>
        `;
    }

    function noteItemMarkup(note) {
        const ref = note.chapter != null
            ? `${note.bookTitle} · ${chapterLabel(note.chapter)}`
            : note.bookTitle;
        const when = relativeTime(note.updatedAt);
        return `
            <li class="reading-list-panel__item">
                <a href="${escapeHtml(note.url)}" class="reading-list-panel__link">
                    <span class="reading-list-panel__section">${sectionIcon('library')}${escapeHtml(ref)}</span>
                    <span class="reading-list-panel__item-title">${escapeHtml(truncate(note.content, 90))}</span>
                    ${note.quote ? `<q class="reading-list-panel__item-desc">${escapeHtml(truncate(note.quote, 80))}</q>` : ''}
                    ${when ? `<span class="reading-list-panel__meta">${escapeHtml(when)}</span>` : ''}
                </a>
            </li>
        `;
    }

    function renderPanel() {
        renderReadingTab();
        renderNotesTab();
    }

    function renderReadingTab() {
        if (!readingMount) return;

        const reading = getContinueItems();
        const listening = getListeningItems();
        // The tab already says "Reading", so a lone group needs no heading
        // of its own — it would only repeat the pill above it. Two groups
        // in one tab do need telling apart.
        const titled = reading.length > 0 && listening.length > 0;
        let html = '';

        if (reading.length) {
            const items = reading.map(progressItemMarkup).join('');
            html += titled
                ? groupMarkup('continueInProgress', 'Continue reading', items)
                : listMarkup(items);
        }

        if (listening.length) {
            const items = listening.map(progressItemMarkup).join('');
            html += titled
                ? groupMarkup('continueListening', 'Continue listening', items)
                : listMarkup(items);
        }

        readingMount.innerHTML = html;
        bindDismissButtons(readingMount);
    }

    function renderNotesTab() {
        if (!notesMount) return;

        const notes = getRecentNotes(MAX_NOTES_IN_PANEL);
        notesMount.innerHTML = notes.length
            ? listMarkup(notes.map(noteItemMarkup).join(''))
            : '';
    }

    function bindDismissButtons(root) {
        root.querySelectorAll('[data-continue-dismiss]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss(btn.dataset.continueKind, btn.dataset.continueDismiss);
            });
        });
    }

    // ── Landing chip ────────────────────────────────────────────────────

    /**
     * A single "pick up where you left off" link in the landing hero. The
     * slot is reserved in the markup and stays empty — and therefore
     * zero-height — for first-time readers, so it can't shift the hero.
     */
    function renderChip() {
        if (!chip) return;

        const item = getContinueItems()[0] || getListeningItems()[0];
        if (!item) {
            chip.innerHTML = '';
            chip.classList.remove('continue-chip--visible');
            return;
        }

        chip.innerHTML = `
            <a class="continue-chip__link" href="${escapeHtml(item.url)}">
                <span class="continue-chip__label">${escapeHtml(t('continueLanding', 'Pick up where you left off'))}</span>
                <span class="continue-chip__title">${escapeHtml(truncate(item.title, 60))}</span>
                <span class="continue-chip__meta">${escapeHtml(metaLine(item))}</span>
                <span class="continue-chip__arrow" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </span>
            </a>
        `;
        chip.classList.add('continue-chip--visible');
    }

    // ── /read/ hub module ───────────────────────────────────────────────

    function moduleItemMarkup(item) {
        return `
            <li class="continue-module__item">
                <a class="continue-module__link" href="${escapeHtml(item.url)}">
                    <span class="continue-module__section">${escapeHtml(item.meta)}</span>
                    <span class="continue-module__item-title">${escapeHtml(truncate(item.title, 70))}</span>
                    <span class="continue-module__meta">${escapeHtml(detailLine(item))}</span>
                    ${progressBarMarkup(item)}
                </a>
            </li>
        `;
    }

    function renderModule() {
        if (!module_) return;

        const items = getContinueItems()
            .concat(getListeningItems())
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
            .slice(0, MAX_MODULE_ITEMS);

        if (!items.length) {
            module_.innerHTML = '';
            module_.classList.remove('continue-module--visible');
            return;
        }

        module_.innerHTML = `
            <h2 class="continue-module__title">${escapeHtml(t('continueLanding', 'Pick up where you left off'))}</h2>
            <ul class="continue-module__list">${items.map(moduleItemMarkup).join('')}</ul>
        `;
        module_.classList.add('continue-module--visible');
    }

    // ── Init ────────────────────────────────────────────────────────────

    function refresh() {
        renderPanel();
        renderChip();
        renderModule();
        updateBadges();
        // reading-list.js owns the panel's empty state but decides it before
        // this module exists (see ReadingList.refreshPanel). Re-run it now
        // that the open-item counts can actually be read, or the "nothing
        // here" block sits on top of a populated panel.
        window.ReadingList?.refreshPanel?.();
    }

    function init() {
        readingMount = document.querySelector('[data-continue-mount="reading"]');
        notesMount = document.querySelector('[data-continue-mount="notes"]');
        chip = document.querySelector('[data-continue-chip]');
        module_ = document.querySelector('[data-continue-module]');

        renderPanel();
        renderModule();
        updateBadges();
        window.ReadingList?.refreshPanel?.();

        // The landing hero is the page's LCP. Populating the chip is not
        // worth competing with it, so it waits for the first idle slot.
        if (chip) {
            const paint = () => renderChip();
            if ('requestIdleCallback' in window) {
                requestIdleCallback(paint, { timeout: 2000 });
            } else {
                setTimeout(paint, 600);
            }
        }

        // reading-list.js fires this whenever the saved list changes, so
        // the shared badge total stays in step with it. page-progress.js
        // and listen-button.js fire woh:continue-changed when an item
        // appears or is finished.
        document.addEventListener('woh:reading-list-changed', refresh);
        document.addEventListener('woh:continue-changed', refresh);

        // Another tab edited the same storage.
        window.addEventListener('storage', (e) => {
            if (e.key && Object.values(KEYS).includes(e.key)) refresh();
        });
    }

    window.ContinueReading = {
        getInProgress,
        getPagesInProgress,
        getListening,
        getContinueItems,
        getRecentNotes,
        getOpenItemCount: openItemCount,
        getReadingCount: readingCount,
        getNotesCount: notesCount,
        dismiss,
        refresh
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
