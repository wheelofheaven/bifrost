// Reading List / Bookmarks
// Save articles for later reading with localStorage and service worker caching
(function() {
    'use strict';

    const STORAGE_KEY = 'woh-reading-list';
    const MAX_ITEMS = 100;

    // State
    let readingList = [];
    let panel = null;

    // Initialize
    function init() {
        loadReadingList();
        setupBookmarkButtons();
        createPanel();
        setupKeyboardShortcut();
        updateAllBookmarkButtons();
    }

    // Load reading list from localStorage
    function loadReadingList() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                readingList = JSON.parse(stored);
                // Clean up any invalid entries
                readingList = readingList.filter(item => item.url && item.title);
            }
        } catch (e) {
            console.error('[ReadingList] Error loading:', e);
            readingList = [];
        }
    }

    // Save reading list to localStorage
    function saveReadingList() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(readingList));
        } catch (e) {
            console.error('[ReadingList] Error saving:', e);
        }
        // The saved count feeds the shared "open items" badge owned by
        // continue-reading.js.
        document.dispatchEvent(new CustomEvent('woh:reading-list-changed'));
    }

    // Add item to reading list
    function addItem(item) {
        // Check if already exists
        const existingIndex = readingList.findIndex(i => i.url === item.url);
        if (existingIndex !== -1) {
            return false; // Already exists
        }

        // Add to beginning
        readingList.unshift({
            url: item.url,
            title: item.title,
            description: item.description || '',
            section: item.section || '',
            addedAt: Date.now()
        });

        // Limit list size
        if (readingList.length > MAX_ITEMS) {
            readingList = readingList.slice(0, MAX_ITEMS);
        }

        saveReadingList();
        cacheUrl(item.url);
        updatePanel();
        updateAllBookmarkButtons();
        return true;
    }

    // Remove item from reading list
    function removeItem(url) {
        const index = readingList.findIndex(i => i.url === url);
        if (index !== -1) {
            readingList.splice(index, 1);
            saveReadingList();
            updatePanel();
            updateAllBookmarkButtons();
            return true;
        }
        return false;
    }

    // Check if item is in reading list
    function isInList(url) {
        return readingList.some(i => i.url === url);
    }

    // Cache URL with service worker
    function cacheUrl(url) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'CACHE_URLS',
                urls: [url]
            });
        }
    }

    // Setup bookmark buttons on the page
    function setupBookmarkButtons() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-bookmark]');
            if (!btn) return;

            e.preventDefault();
            const url = btn.dataset.url || window.location.pathname;
            const title = btn.dataset.title || document.title;
            const description = btn.dataset.description || '';
            const section = btn.dataset.section || '';

            if (isInList(url)) {
                removeItem(url);
                showSnackbar(getTranslation('removedFromList', 'Removed from reading list'));
            } else {
                addItem({ url, title, description, section });
                showSnackbar(getTranslation('addedToList', 'Added to reading list'));
            }
        });
    }

    // Update all bookmark buttons on page
    function updateAllBookmarkButtons() {
        const buttons = document.querySelectorAll('[data-bookmark]');
        buttons.forEach(btn => {
            const url = btn.dataset.url || window.location.pathname;
            const isBookmarked = isInList(url);
            btn.classList.toggle('is-bookmarked', isBookmarked);
            btn.setAttribute('aria-pressed', isBookmarked);

            // Update icon if it has one
            const iconFilled = btn.querySelector('.bookmark-icon-filled');
            const iconOutline = btn.querySelector('.bookmark-icon-outline');
            if (iconFilled && iconOutline) {
                iconFilled.style.display = isBookmarked ? 'block' : 'none';
                iconOutline.style.display = isBookmarked ? 'none' : 'block';
            }
        });
    }

    // Every count in the chrome is now the shared open-items badge, owned by
    // continue-reading.js and driven by the `woh:reading-list-changed` event
    // saveReadingList() dispatches. Nothing here to update.

    // Sections that can carry a bookmark button, i.e. the only first path
    // segments a saved row can have. Same five as continue-reading.js
    // labels, and the keys section-icons.js is generated for.
    const SECTIONS = ['articles', 'library', 'news', 'timeline', 'wiki'];
    const LOCALES = ['de', 'es', 'fr', 'he', 'ja', 'ko', 'ru', 'zh', 'zh-Hant'];

    /**
     * The section slug for a saved row, read off its URL.
     *
     * A saved row stores `section` as the section's *title* — that's what
     * the bookmark button's data-section carries, and it is translated, so
     * it differs per locale and can't key an icon map. The path can: it is
     * stable, and rows saved before this existed have one too.
     */
    function sectionSlugFromUrl(url) {
        const parts = String(url || '').split(/[?#]/)[0]
            .replace(/^https?:\/\/[^/]+/, '')
            .replace(/^\/+/, '')
            .split('/');
        if (LOCALES.indexOf(parts[0]) !== -1) parts.shift();
        return SECTIONS.indexOf(parts[0]) !== -1 ? parts[0] : '';
    }

    // Section identity glyph, from the map section-icons.js puts on the
    // window. Empty string for an unknown section, so the chip falls back
    // to the bare label it has always rendered.
    function sectionIcon(slug) {
        return (window.WohSectionIcons && window.WohSectionIcons.markup(slug)) || '';
    }

    // ── Tabs ────────────────────────────────────────────────────────────
    //
    // Behind one bookmark icon sit three different piles: what you are
    // part-way through, what you saved to read later, and the notes you
    // left in books. Stacked as groups down a single scroll, the pile you
    // came for was rarely the one on screen — and the panel's height was
    // whatever the sum of them happened to be. As tabs, each pile is one
    // tap away and the card keeps the search overlay's fixed geometry.
    //
    // Ownership is unchanged: this module owns the strip and the saved
    // tab, and the reading and notes tabs are mount points
    // continue-reading.js fills. That module just gets one mount per tab
    // now instead of one slot holding both.
    const TABS = ['reading', 'saved', 'notes'];
    let activeTab = 'reading';

    // Tab identity glyphs. Also used at 48px for each tab's empty state,
    // so the "nothing here" block always names the pile it belongs to.
    const TAB_ICONS = {
        reading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
        saved: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
        notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>'
    };

    // The two continue-owned counts come from that module when it is
    // present. This one has to keep working when it is not — see the note
    // on ReadingList.refreshPanel for why it can't assume the order.
    function tabCounts() {
        const cr = window.ContinueReading;
        return {
            reading: (cr && cr.getReadingCount && cr.getReadingCount()) || 0,
            saved: readingList.length,
            notes: (cr && cr.getNotesCount && cr.getNotesCount()) || 0
        };
    }

    function tabMarkup(tab, label) {
        const selected = tab === activeTab;
        return `
            <button
                type="button"
                role="tab"
                id="reading-list-tab-${tab}"
                class="reading-list-panel__tab${selected ? ' reading-list-panel__tab--active' : ''}"
                aria-controls="reading-list-tabpanel-${tab}"
                aria-selected="${selected ? 'true' : 'false'}"
                tabindex="${selected ? '0' : '-1'}"
                data-reading-list-tab="${tab}"
            >
                <span class="reading-list-panel__tab-icon" aria-hidden="true">${TAB_ICONS[tab]}</span>
                <span class="reading-list-panel__tab-label">${label}</span>
                <span class="reading-list-panel__tab-count" data-tab-count="${tab}">0</span>
            </button>
        `;
    }

    // Per-tab "nothing here" block, in `.search-modal__empty-state`'s
    // shape: glyph, one-line title, one quieter line telling you what
    // would put something here.
    function emptyStateMarkup(tab, title, hint) {
        return `
            <div class="reading-list-panel__empty" data-empty-for="${tab}" hidden>
                <span class="reading-list-panel__empty-icon" aria-hidden="true">${TAB_ICONS[tab]}</span>
                <p class="reading-list-panel__empty-title">${title}</p>
                <p class="reading-list-panel__empty-hint">${hint}</p>
            </div>
        `;
    }

    function tabPanelMarkup(tab, inner) {
        return `
            <div
                class="reading-list-panel__tabpanel"
                role="tabpanel"
                id="reading-list-tabpanel-${tab}"
                aria-labelledby="reading-list-tab-${tab}"
                data-reading-list-tabpanel="${tab}"
                ${tab === activeTab ? '' : 'hidden'}
            >${inner}</div>
        `;
    }

    /**
     * Show one tab and hide the other two.
     *
     * `focus` moves the caret with the selection, which is what the arrow
     * keys want and what a click must not do (a click has already put
     * focus where it belongs).
     */
    function selectTab(tab, options) {
        if (!panel || TABS.indexOf(tab) === -1) return;
        const focus = !!(options && options.focus);
        activeTab = tab;

        TABS.forEach(name => {
            const on = name === tab;
            const btn = panel.querySelector(`[data-reading-list-tab="${name}"]`);
            const pane = panel.querySelector(`[data-reading-list-tabpanel="${name}"]`);
            if (btn) {
                btn.classList.toggle('reading-list-panel__tab--active', on);
                btn.setAttribute('aria-selected', on ? 'true' : 'false');
                // Roving tabindex: only the selected tab is in the page's
                // tab order, so Tab moves past the strip rather than
                // through it.
                btn.tabIndex = on ? 0 : -1;
                if (on && focus) btn.focus();
            }
            if (pane) pane.hidden = !on;
        });

        // Export / Import / Clear act on the saved list alone, so the
        // footer belongs to that tab rather than to the panel.
        const footer = panel.querySelector('.reading-list-panel__footer');
        if (footer) footer.hidden = tab !== 'saved';

        // The scroller keeps its offset when the content under it is
        // swapped, which would drop you mid-list on a tab you have not
        // looked at yet.
        const body = panel.querySelector('.reading-list-panel__body');
        if (body) body.scrollTop = 0;
    }

    /**
     * On open, land on a tab that has something in it — what you are
     * reading first, then what you saved, then your notes — rather than
     * on whichever one was open last, which may since have emptied.
     */
    function pickBestTab() {
        const counts = tabCounts();
        if (counts[activeTab] > 0) return;
        selectTab(TABS.filter(tab => counts[tab] > 0)[0] || 'reading');
    }

    // Create the reading list panel
    function createPanel() {
        panel = document.createElement('div');
        panel.className = 'reading-list-panel';
        panel.id = 'readingListPanel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-labelledby', 'readingListTitle');
        panel.setAttribute('aria-hidden', 'true');

        panel.innerHTML = `
            <div class="reading-list-panel__backdrop"></div>
            <div class="reading-list-panel__container">
                <header class="reading-list-panel__header">
                    <h2 class="reading-list-panel__title" id="readingListTitle">
                        ${getTranslation('continuePanelTitle', 'Your reading')}
                    </h2>
                    <div class="reading-list-panel__shortcut">${getTranslation('closeHint', 'Press <kbd>Esc</kbd> to close')}</div>
                    <button class="reading-list-panel__close" aria-label="${getTranslation('close', 'Close')}" data-close-reading-list>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </header>
                <div class="reading-list-panel__tabs" role="tablist" aria-label="${getTranslation('continuePanelTitle', 'Your reading')}">
                    ${tabMarkup('reading', getTranslation('continueTabReading', 'Reading'))}
                    ${tabMarkup('saved', getTranslation('continueTabSaved', 'Saved'))}
                    ${tabMarkup('notes', getTranslation('continueTabNotes', 'Notes'))}
                </div>
                <div class="reading-list-panel__body">
                    ${tabPanelMarkup('reading', `
                        <!-- continue-reading.js renders the in-progress and
                             listening groups here. -->
                        <div data-continue-mount="reading"></div>
                        ${emptyStateMarkup(
                            'reading',
                            getTranslation('continueEmptyTitle', 'Nothing open yet'),
                            getTranslation('continueEmptyHint', 'Pages you read or bookmark show up here, ready to pick up again.')
                        )}
                    `)}
                    ${tabPanelMarkup('saved', `
                        <ul class="reading-list-panel__list" data-saved-list></ul>
                        ${emptyStateMarkup(
                            'saved',
                            getTranslation('emptyReadingList', 'Your reading list is empty'),
                            getTranslation('emptyReadingListHint', 'Bookmark articles to save them for later')
                        )}
                    `)}
                    ${tabPanelMarkup('notes', `
                        <!-- continue-reading.js renders the notes list here. -->
                        <div data-continue-mount="notes"></div>
                        ${emptyStateMarkup(
                            'notes',
                            getTranslation('continueNotesEmptyTitle', 'No notes yet'),
                            getTranslation('continueNotesEmptyHint', 'Notes you take while reading in the library show up here.')
                        )}
                    `)}
                </div>
                <footer class="reading-list-panel__footer">
                    <button class="reading-list-panel__export" data-export-reading-list>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        ${getTranslation('exportReadingList', 'Export')}
                    </button>
                    <button class="reading-list-panel__import" data-import-reading-list>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        ${getTranslation('importReadingList', 'Import')}
                    </button>
                    <button class="reading-list-panel__clear" data-clear-reading-list>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        ${getTranslation('clearAll', 'Clear all')}
                    </button>
                </footer>
            </div>
        `;

        document.body.appendChild(panel);

        // Setup event listeners
        const backdrop = panel.querySelector('.reading-list-panel__backdrop');
        const closeBtn = panel.querySelector('[data-close-reading-list]');
        const clearBtn = panel.querySelector('[data-clear-reading-list]');
        const exportBtn = panel.querySelector('[data-export-reading-list]');
        const importBtn = panel.querySelector('[data-import-reading-list]');
        const tablist = panel.querySelector('.reading-list-panel__tabs');

        backdrop?.addEventListener('click', closePanel);
        closeBtn?.addEventListener('click', closePanel);
        clearBtn?.addEventListener('click', clearAll);
        exportBtn?.addEventListener('click', exportList);
        importBtn?.addEventListener('click', importList);

        tablist?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-reading-list-tab]');
            if (btn) selectTab(btn.dataset.readingListTab);
        });

        // Arrows move between tabs and Home/End jump to the ends — the
        // WAI-ARIA tabs pattern, so the strip behaves the way a keyboard
        // or screen-reader user expects once they are inside it.
        tablist?.addEventListener('keydown', (e) => {
            const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (step) {
                e.preventDefault();
                // Mirror the arrows under RTL, where "next" is leftward.
                const dir = document.documentElement.dir === 'rtl' ? -step : step;
                const i = TABS.indexOf(activeTab);
                selectTab(TABS[(i + dir + TABS.length) % TABS.length], { focus: true });
            } else if (e.key === 'Home') {
                e.preventDefault();
                selectTab(TABS[0], { focus: true });
            } else if (e.key === 'End') {
                e.preventDefault();
                selectTab(TABS[TABS.length - 1], { focus: true });
            }
        });

        // Setup toggle button
        document.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('[data-toggle-reading-list]');
            if (toggleBtn) {
                e.preventDefault();
                // An entry point can name the tab it wants:
                // `data-toggle-reading-list="notes"`. The bare attribute
                // every current call site uses means "pick for me".
                togglePanel(toggleBtn.dataset.toggleReadingList);
            }
        });

        selectTab(activeTab);
        updatePanel();
    }

    // Update panel content
    function updatePanel() {
        if (!panel) return;

        const counts = tabCounts();

        TABS.forEach(tab => {
            const countEl = panel.querySelector(`[data-tab-count="${tab}"]`);
            if (countEl) countEl.textContent = counts[tab] > 99 ? '99+' : String(counts[tab]);

            const btn = panel.querySelector(`[data-reading-list-tab="${tab}"]`);
            // Dimmed rather than removed: a tab that disappears when its
            // pile empties makes the strip jump under the pointer, and
            // hides the one affordance that tells you the pile exists.
            if (btn) btn.classList.toggle('reading-list-panel__tab--empty', counts[tab] === 0);

            const emptyEl = panel.querySelector(`[data-empty-for="${tab}"]`);
            if (emptyEl) emptyEl.hidden = counts[tab] > 0;
        });

        const footerEl = panel.querySelector('.reading-list-panel__footer');
        const clearBtn = panel.querySelector('[data-clear-reading-list]');
        const exportBtn = panel.querySelector('[data-export-reading-list]');

        // Clear and Export need something to act on. Import does not — an
        // empty list is exactly when a user wants to restore a backup — so
        // the footer stays mounted on the saved tab either way.
        const hasSaved = readingList.length > 0;
        if (clearBtn) clearBtn.style.display = hasSaved ? '' : 'none';
        if (exportBtn) exportBtn.style.display = hasSaved ? '' : 'none';
        if (footerEl) footerEl.hidden = activeTab !== 'saved';

        renderSavedList();
    }

    // Saved-for-later rows.
    //
    // Same three-part row as the Continue and Notes groups render, so the
    // whole panel reads as one list whichever tab you are on: accent
    // section chip, title, then the quieter supporting line. `savedAgo` is
    // that line here, matching the "42% · 2 hours ago" the others show.
    function renderSavedList() {
        const listEl = panel.querySelector('[data-saved-list]');
        if (!listEl) return;

        listEl.innerHTML = readingList.map(item => {
            const when = savedAgo(item.addedAt);
            const removeLabel = `${getTranslation('remove', 'Remove')}: ${item.title}`;
            return `
            <li class="reading-list-panel__item">
                <a href="${escapeHtml(item.url)}" class="reading-list-panel__link">
                    ${item.section ? `<span class="reading-list-panel__section">${sectionIcon(sectionSlugFromUrl(item.url))}${escapeHtml(item.section)}</span>` : ''}
                    <span class="reading-list-panel__item-title">${escapeHtml(item.title)}</span>
                    ${item.description ? `<span class="reading-list-panel__item-desc">${escapeHtml(truncate(item.description, 100))}</span>` : ''}
                    ${when ? `<span class="reading-list-panel__meta">${escapeHtml(when)}</span>` : ''}
                </a>
                <button class="reading-list-panel__remove" data-remove-url="${escapeHtml(item.url)}" aria-label="${escapeHtml(removeLabel)}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </li>`;
        }).join('');

        // Setup remove buttons
        listEl.querySelectorAll('[data-remove-url]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = btn.dataset.removeUrl;
                removeItem(url);
                showSnackbar(getTranslation('removedFromList', 'Removed from reading list'));
            });
        });
    }


    /**
     * Open the panel, optionally on a named tab.
     *
     * The tab argument lets an entry point deep-open the panel — a
     * `data-toggle-reading-list="notes"` button lands on the notes tab.
     * Anything that isn't a tab name (including an Event, if this is ever
     * wired straight to a listener) falls through to pickBestTab().
     */
    function openPanel(tab) {
        if (!panel) return;
        panel.classList.add('reading-list-panel--open');
        panel.setAttribute('aria-hidden', 'false');
        // Lock the root element, not <body>. The document scrolls on
        // <html>, so `body { overflow: hidden }` — what this used to set
        // inline — locks nothing on iOS Safari, and the page carried on
        // scrolling behind the open panel. The burger menu hit the same
        // wall and solved it the same way: see
        // `html:has(body.mobile-nav-open)` in layout/_navbar.scss.
        document.body.classList.add('reading-list-open');

        // The search overlay's page-blur layer, reused verbatim: it is a
        // dedicated sibling overlay rather than a `filter` on <main>,
        // because `filter` makes an element the containing block for its
        // fixed descendants and re-anchors the landing hero's media. The
        // element is shared and idempotent; which body class reveals it is
        // decided in CSS.
        ensureBlurOverlay();

        // Land on a tab that has something in it before focus goes to the
        // strip, so the first thing a keyboard user hears is the tab they
        // will actually be reading.
        if (typeof tab === 'string' && TABS.indexOf(tab) !== -1) {
            selectTab(tab);
        } else {
            pickBestTab();
        }

        // Focus the selected tab. It is the panel's first focusable
        // element, so this is also the plain "focus into the dialog" move.
        //
        // Move focus into the dialog, onto the tab it opened on.
        //
        // The reflow read is load-bearing: nothing inside a
        // `visibility: hidden` subtree can take focus, and the panel only
        // stops being hidden once style has been recomputed with `--open`
        // applied. (The other half of that fix lives in the stylesheet —
        // `visibility` is stepped rather than eased there, or the panel
        // would stay hidden for the whole 300ms fade and this would
        // silently do nothing.)
        void panel.offsetHeight;
        const firstFocusable = panel.querySelector('[role="tab"][aria-selected="true"]')
            || panel.querySelector('button, a');
        firstFocusable?.focus();
    }

    // Lazily inject the shared page-blur overlay. search.js creates the
    // same element under the same class; whichever overlay opens first
    // wins and the other reuses it.
    function ensureBlurOverlay() {
        if (document.querySelector('.search-modal-blur')) return;
        const overlay = document.createElement('div');
        overlay.className = 'search-modal-blur';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.appendChild(overlay);
    }

    // Close panel
    function closePanel() {
        if (!panel) return;
        panel.classList.remove('reading-list-panel--open');
        panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('reading-list-open');
    }

    // Toggle panel
    function togglePanel(tab) {
        if (panel?.classList.contains('reading-list-panel--open')) {
            closePanel();
        } else {
            openPanel(tab);
        }
    }

    // Export the reading list as a portable JSON file. The schema is
    // intentionally tiny and stable so users can re-import or pipe it
    // into other tools without surprises.
    function exportList() {
        if (readingList.length === 0) {
            showSnackbar(getTranslation('emptyReadingList', 'Your reading list is empty'));
            return;
        }
        const payload = {
            kind: 'woh-bookmarks-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            bookmarks: readingList.map(item => ({
                url: item.url,
                title: item.title,
                description: item.description || '',
                section: item.section || '',
                addedAt: item.addedAt || Date.now()
            }))
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `woh-bookmarks-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showSnackbar(getTranslation('readingListExported', 'Reading list exported'));
    }

    // Import a previously exported reading list. Merges by url:
    // existing entries are kept (preserving their original addedAt),
    // new ones are inserted at the top in incoming order.
    function importList() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                let data;
                try {
                    data = JSON.parse(ev.target.result);
                } catch (err) {
                    showSnackbar(getTranslation('importInvalidJson', 'Import failed — not valid JSON'));
                    return;
                }
                if (!data || data.kind !== 'woh-bookmarks-export' || !Array.isArray(data.bookmarks)) {
                    showSnackbar(getTranslation('importWrongKind', 'Import failed — not a reading-list export'));
                    return;
                }
                if (typeof data.version === 'number' && data.version > 1) {
                    showSnackbar(getTranslation('importTooNew', 'Import failed — file is newer than this app supports'));
                    return;
                }

                let added = 0;
                // Iterate in reverse so the first entry of the incoming
                // list ends up on top after the unshift().
                for (let i = data.bookmarks.length - 1; i >= 0; i--) {
                    const b = data.bookmarks[i];
                    if (!b || !b.url || !b.title) continue;
                    if (readingList.some(x => x.url === b.url)) continue;
                    readingList.unshift({
                        url: b.url,
                        title: b.title,
                        description: b.description || '',
                        section: b.section || '',
                        addedAt: typeof b.addedAt === 'number' ? b.addedAt : Date.now()
                    });
                    added += 1;
                }
                if (readingList.length > MAX_ITEMS) {
                    readingList = readingList.slice(0, MAX_ITEMS);
                }
                saveReadingList();
                updatePanel();
                updateAllBookmarkButtons();
                if (added === 0) {
                    showSnackbar(getTranslation('importNothingNew', 'Nothing new to import'));
                } else {
                    showSnackbar(`${getTranslation('imported', 'Imported')} ${added}`);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    // Clear all items
    function clearAll() {
        if (readingList.length === 0) return;

        if (confirm(getTranslation('confirmClear', 'Clear all items from your reading list?'))) {
            readingList = [];
            saveReadingList();
            updatePanel();
            updateAllBookmarkButtons();
            showSnackbar(getTranslation('listCleared', 'Reading list cleared'));
        }
    }

    // Setup keyboard shortcut (b for bookmark, B for open list)
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger when typing in inputs
            const active = document.activeElement;
            const tagName = active?.tagName?.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || active?.isContentEditable) {
                return;
            }

            // Don't trigger with modifier keys
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            // Check if any modal is open
            const anyModalOpen = document.querySelector('.search-modal--active, .keyboard-shortcuts-modal--open');

            if (e.key === 'b' && !e.shiftKey && !anyModalOpen) {
                // Toggle bookmark for current page
                const bookmarkBtn = document.querySelector('[data-bookmark]');
                if (bookmarkBtn) {
                    e.preventDefault();
                    bookmarkBtn.click();
                }
            } else if (e.key === 'B' && e.shiftKey && !anyModalOpen) {
                // Open reading list panel
                e.preventDefault();
                openPanel();
            } else if (e.key === 'Escape' && panel?.classList.contains('reading-list-panel--open')) {
                e.preventDefault();
                closePanel();
            }
        });
    }

    // Get translation
    function getTranslation(key, fallback) {
        return window.readingListTranslations?.[key] || fallback;
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Truncate text
    function truncate(text, length) {
        if (text.length <= length) return text;
        return text.substring(0, length).trim() + '…';
    }

    // "3 days ago", in the reader's language, from the epoch ms stored on a
    // saved item. Intl does the wording, so this needs no translation keys.
    //
    // Deliberately a local copy of continue-reading.js's `relativeTime`
    // rather than a shared import: this module has to keep working when
    // that one is absent, which is the same reason it owns the panel and
    // only lends it a mount point.
    function savedAgo(addedAt) {
        const then = Number(addedAt);
        if (!then || Number.isNaN(then)) return '';

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

    // Show snackbar
    function showSnackbar(message) {
        if (typeof window.showSnackbar === 'function') { window.showSnackbar(message); return; }
        const snackbar = document.querySelector('.snackbar');
        if (snackbar) {
            snackbar.textContent = message;
            snackbar.classList.add('snackbar--visible');
            setTimeout(() => {
                snackbar.classList.remove('snackbar--visible');
            }, 3000);
        } else {
            const tempSnackbar = document.createElement('div');
            tempSnackbar.className = 'snackbar snackbar--visible';
            tempSnackbar.textContent = message;
            document.body.appendChild(tempSnackbar);
            setTimeout(() => {
                tempSnackbar.remove();
            }, 3000);
        }
    }

    // Expose public API
    window.ReadingList = {
        add: addItem,
        remove: removeItem,
        isInList: isInList,
        getAll: () => [...readingList],
        open: openPanel,
        close: closePanel,
        toggle: togglePanel,
        exportList: exportList,
        importList: importList,
        // The panel's "nothing here" state depends on what continue-reading.js
        // has, but core.bundle.js is deferred: by the time it executes,
        // readyState is already past "loading", so every module in it inits
        // synchronously in bundle order and this one runs first — before
        // window.ContinueReading exists. continue-reading.js calls this once
        // it has initialized so the empty state can be re-decided with the
        // real counts.
        refreshPanel: updatePanel
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
