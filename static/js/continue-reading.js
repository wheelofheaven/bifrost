// Continue Reading — cross-site "jump back in" surface
//
// Aggregates the reading state the site already persists, so it can be
// surfaced anywhere rather than only inside the library reader:
//
//   woh_library_progress  in-progress books (chapter/paragraph/lastRead)
//   woh_library_history   book titles (progress records predating the
//                         bookTitle field fall back to this)
//   woh_library_notes     verse-anchored user notes
//   woh-reading-list      pages saved for later
//
// Deliberately reads localStorage directly instead of going through
// LibraryStorage: that module ships in library.bundle.js and is absent
// on every page outside /library/<book>/, which is exactly where this
// surface needs to work.
//
// Renders into the reading-list panel's [data-continue-mount] slot and
// owns the burger-menu badge. Loads after reading-list.js so the panel
// exists by the time this initializes.
(function() {
    'use strict';

    const KEYS = {
        PROGRESS: 'woh_library_progress',
        HISTORY: 'woh_library_history',
        NOTES: 'woh_library_notes',
        READING_LIST: 'woh-reading-list'
    };

    // An in-progress book stops being an "open item" once it has been
    // untouched this long. Without it the badge only ever grows.
    const MAX_AGE_DAYS = 90;
    const MAX_NOTES_SHOWN = 5;
    const BADGE_CAP = 9;

    // Locales that carry a URL prefix. Book slugs are shared across all
    // of them, so progress recorded in one language deep-links into
    // whichever language the reader is currently browsing.
    const LOCALES = ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh', 'zh-Hant', 'he'];

    let mount = null;

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
                    slug,
                    title: record.bookTitle || titles[slug] || titleFromSlug(slug),
                    chapter: record.chapter,
                    paragraph: record.paragraph,
                    lastRead: record.lastRead || '',
                    url: `${prefix}/library/${slug}/#c${record.chapter}p${record.paragraph}`
                };
            })
            .filter(Boolean)
            .sort((a, b) => (b.lastRead || '').localeCompare(a.lastRead || ''));
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
     * Items a reader can act on right now: things in progress plus things
     * saved for later. Notes are annotations on those, not a separate
     * pile of unfinished business, so they stay out of the badge count.
     */
    function openItemCount() {
        return getInProgress().length + savedCount();
    }

    function dismiss(slug) {
        const progress = read(KEYS.PROGRESS);
        if (!progress || !progress[slug]) return false;
        delete progress[slug];
        write(KEYS.PROGRESS, progress);
        render();
        updateBadges();
        return true;
    }

    // ── Badges ──────────────────────────────────────────────────────────

    function updateBadges() {
        const count = openItemCount();
        const label = t('continueBadgeLabel', 'items to continue reading');
        document.querySelectorAll('[data-continue-badge]').forEach(badge => {
            badge.textContent = count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
            badge.setAttribute('aria-label', `${count} ${label}`);
            badge.classList.toggle('nav-badge--visible', count > 0);
        });
    }

    // ── Panel groups ────────────────────────────────────────────────────

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

    function groupMarkup(titleKey, titleFallback, itemsHtml) {
        return `
            <section class="reading-list-panel__group">
                <h3 class="reading-list-panel__group-title">${escapeHtml(t(titleKey, titleFallback))}</h3>
                <ul class="reading-list-panel__list">${itemsHtml}</ul>
            </section>
        `;
    }

    function progressItemMarkup(item) {
        return `
            <li class="reading-list-panel__item">
                <a href="${escapeHtml(item.url)}" class="reading-list-panel__link">
                    <span class="reading-list-panel__section">${escapeHtml(chapterLabel(item.chapter))}</span>
                    <span class="reading-list-panel__item-title">${escapeHtml(item.title)}</span>
                </a>
                <button
                    class="reading-list-panel__remove"
                    data-continue-dismiss="${escapeHtml(item.slug)}"
                    aria-label="${escapeHtml(t('continueRemove', 'Remove from continue list'))}"
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
        return `
            <li class="reading-list-panel__item">
                <a href="${escapeHtml(note.url)}" class="reading-list-panel__link">
                    <span class="reading-list-panel__section">${escapeHtml(ref)}</span>
                    <span class="reading-list-panel__item-title">${escapeHtml(truncate(note.content, 90))}</span>
                    ${note.quote ? `<span class="reading-list-panel__item-desc">“${escapeHtml(truncate(note.quote, 80))}”</span>` : ''}
                </a>
            </li>
        `;
    }

    function render() {
        if (!mount) return;

        const inProgress = getInProgress();
        const notes = getRecentNotes();
        let html = '';

        if (inProgress.length) {
            html += groupMarkup(
                'continueInProgress',
                'Continue reading',
                inProgress.map(progressItemMarkup).join('')
            );
        }

        if (notes.length) {
            html += groupMarkup(
                'continueNotes',
                'Recent notes',
                notes.map(noteItemMarkup).join('')
            );
        }

        mount.innerHTML = html;

        mount.querySelectorAll('[data-continue-dismiss]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss(btn.dataset.continueDismiss);
            });
        });
    }

    // ── Init ────────────────────────────────────────────────────────────

    function init() {
        mount = document.querySelector('[data-continue-mount]');
        render();
        updateBadges();

        // reading-list.js fires this whenever the saved list changes, so
        // the shared badge total stays in step with it.
        document.addEventListener('woh:reading-list-changed', () => {
            render();
            updateBadges();
        });

        // Another tab edited the same storage.
        window.addEventListener('storage', (e) => {
            if (e.key && Object.values(KEYS).includes(e.key)) {
                render();
                updateBadges();
            }
        });
    }

    window.ContinueReading = {
        getInProgress,
        getRecentNotes,
        getOpenItemCount: openItemCount,
        getNotesCount: notesCount,
        dismiss,
        refresh: () => { render(); updateBadges(); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
