/**
 * Compact contents on phones.
 *
 * Articles, wiki entries and timeline ages print their full table of
 * contents inline, right under the lede. On a phone that is a screen of
 * links between the summary and the first sentence — and the reader FAB
 * already offers the same list one tap away. Below the tablet breakpoint
 * each inline TOC collapses to a single "Contents · N" row that expands in
 * place; the three page types share one look instead of three.
 *
 * Desktop is untouched: there the TOC is a sticky side rail.
 */
(function () {
    'use strict';

    const SELECTORS = [
        { root: '.article__toc', title: '.article__toc-title', nav: '.article__toc-nav' },
        { root: '.wiki__toc', title: '.wiki__toc-title', nav: '.wiki__toc-nav' },
        { root: '.timeline-page__toc', title: '.timeline-page__toc-title', nav: '.timeline-page__toc-nav' },
    ];
    const mq = window.matchMedia('(max-width: 999px)');

    function setup() {
        SELECTORS.forEach(({ root, title, nav }) => {
            const el = document.querySelector(root);
            if (!el || el.dataset.tocCompact) return;
            const navEl = el.querySelector(nav);
            const titleEl = el.querySelector(title);
            if (!navEl || !titleEl) return;
            el.dataset.tocCompact = '1';

            // <details> (articles): drive it through its own open state.
            if (el.tagName === 'DETAILS') {
                const apply = () => { el.open = !mq.matches; el.classList.toggle('toc-compact', mq.matches); };
                apply();
                mq.addEventListener('change', apply);
                countInto(titleEl, navEl);
                return;
            }

            // <div> TOCs (wiki, timeline): the heading becomes the toggle.
            if (!navEl.id) navEl.id = root.slice(1) + '-nav';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toc-compact__toggle';
            btn.setAttribute('aria-controls', navEl.id);
            btn.setAttribute('aria-expanded', 'false');
            btn.innerHTML = '<span class="toc-compact__label"></span><span class="toc-compact__count"></span><span class="toc-compact__chevron" aria-hidden="true"></span>';
            btn.querySelector('.toc-compact__label').textContent = titleEl.textContent.trim();
            btn.querySelector('.toc-compact__count').textContent = String(navEl.querySelectorAll(':scope > ul > li').length);
            titleEl.after(btn);
            btn.addEventListener('click', () => {
                const open = el.classList.toggle('toc-compact--open');
                btn.setAttribute('aria-expanded', String(open));
            });
            // Jumping to a chapter closes the list again.
            navEl.addEventListener('click', (e) => {
                if (mq.matches && e.target.closest('a')) {
                    el.classList.remove('toc-compact--open');
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
            const apply = () => el.classList.toggle('toc-compact', mq.matches);
            apply();
            mq.addEventListener('change', apply);
        });
    }

    function countInto(titleEl, navEl) {
        if (titleEl.querySelector('.toc-compact__count')) return;
        const n = navEl.querySelectorAll(':scope > ul > li').length;
        const c = document.createElement('span');
        c.className = 'toc-compact__count';
        c.textContent = String(n);
        titleEl.appendChild(c);
    }

    // The floating "Contents" pill (reader FAB) duplicates the inline row
    // while that row is still on screen or ahead of the reader; show it
    // only once the inline contents have scrolled away above.
    function watchInline() {
        const el = document.querySelector('.article__toc, .wiki__toc, .timeline-page__toc');
        if (!el || !('IntersectionObserver' in window)) return;
        const root = document.documentElement;
        new IntersectionObserver((entries) => {
            const e = entries[0];
            root.classList.toggle('toc-inline-ahead', e.isIntersecting || e.boundingClientRect.top > 0);
        }).observe(el);
    }

    function init() { setup(); watchInline(); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
