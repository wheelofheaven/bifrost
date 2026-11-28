/**
 * Genesis four-lens reader — templates/genesis-chapter.html.
 *
 * The page works without this file: the slider is four radios and the CSS
 * (sass/pages/_genesis-reader.scss) reads the checked one through :has().
 * This adds, on top:
 *
 *   - keys 1–4 for the page lens (not while typing or with a modifier);
 *   - per-card stepping: the arrow on a card cycles that card through the
 *     lenses a card can show (1–4, or 1–2 without a lens file); "Page lens"
 *     puts it back; moving the page slider resets every card;
 *   - notes: the library's note icon (.genesis-note-link) opens and closes
 *     its inline fold (aria-expanded, aria-controls); without this file the
 *     folds are open and the icons hidden; Escape in an open note closes it;
 *   - ?lens=N in the URL (replaceState, the #vN hash kept) and the choice
 *     remembered in localStorage;
 *   - data-page-lens on the root, so browsers without :has() still switch;
 *   - motion only for cards on screen, none under prefers-reduced-motion,
 *     and the scroll position held on the card at the top of the viewport;
 *   - #vN deep links land on the verse's card in every lens;
 *   - one polite live region announcing every change;
 *   - .genesis-lens--stuck on the slider while it is stuck, which shows
 *     the opaque band behind it;
 *   - the chapter switcher closes on Escape and on a click outside.
 */
(function () {
    'use strict';

    const root = document.querySelector('.genesis--chapter');
    if (!root) return;

    const STORE = 'woh-genesis-lens';
    const NAMES = { 1: 'Hebrew', 2: 'Literal', 3: 'Reading', 4: 'Meaning' };
    const inputs = Array.from(root.querySelectorAll('.genesis-lens__input'));
    const cards = Array.from(root.querySelectorAll('.genesis-card'));
    const live = document.getElementById('genesis-live');
    const lensBar = root.querySelector('.genesis-lens');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const enabled = inputs.filter((i) => !i.disabled).map((i) => Number(i.value));

    // Folds (.genesis-fold) close from here on; print still opens them.
    root.classList.add('genesis--js');

    function store(key, value) {
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, value);
        } catch (e) { /* private mode, blocked storage: the page still works */ }
    }

    function stored(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function valid(n) {
        n = Number(n);
        return enabled.includes(n) ? n : 0;
    }

    function announce(text) {
        if (!live) return;
        // Clear first so the same message twice is still read out.
        live.textContent = '';
        window.setTimeout(() => { live.textContent = text; }, 30);
    }

    function pageLens() {
        const on = inputs.find((i) => i.checked);
        return on ? Number(on.value) : 2;
    }

    // ---- Motion -----------------------------------------------------------
    // Only elements near the viewport animate; everything else switches at
    // once, so a lens change never costs a page-length reflow animation and
    // the scroll anchor below stays exact.
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                e.target.classList.toggle('is-near', e.isIntersecting);
            });
        }, { rootMargin: '0px' });
        root.querySelectorAll('.genesis-card, .genesis-passage-note').forEach((el) => io.observe(el));
    }

    function setMotion() {
        root.classList.toggle('genesis--motion', !reduced.matches);
    }

    // The element whose top we hold still: the first card or Meaning pane
    // that reaches below the sticky slider.
    function anchorEl() {
        const top = lensBar ? lensBar.getBoundingClientRect().bottom : 0;
        const els = root.querySelectorAll('.genesis-card, .genesis-passage-note');
        for (const el of els) {
            const r = el.getBoundingClientRect();
            if (r.height > 0 && r.bottom > top) return el;
        }
        return null;
    }

    // Hold the reading position only once the slider is stuck, i.e. the
    // reader is inside the text. At the top of the page, content growing
    // below the header should simply grow.
    function stuck() {
        if (!lensBar) return false;
        const top = parseFloat(getComputedStyle(lensBar).top) || 0;
        return lensBar.getBoundingClientRect().top <= top + 1;
    }

    function holdScroll(change) {
        if (!stuck()) { change(); return; }
        const el = anchorEl();
        const before = el ? el.getBoundingClientRect().top : 0;
        change();
        if (!el) return;
        const delta = el.getBoundingClientRect().top - before;
        if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    }

    // ---- Cards ------------------------------------------------------------
    function cardLenses(card) {
        return (card.dataset.lenses || '12').split('').map(Number).filter((n) => enabled.includes(n));
    }

    function cardLens(card) {
        return card.dataset.lens ? Number(card.dataset.lens) : pageLens();
    }

    function paintCard(card) {
        const own = card.dataset.lens ? Number(card.dataset.lens) : 0;
        const reset = card.querySelector('.genesis-card__reset');
        const step = card.querySelector('.genesis-card__step');
        const label = card.dataset.label || '';
        if (reset) reset.hidden = !own;
        if (step) {
            const list = cardLenses(card);
            const cur = cardLens(card);
            const next = list[(list.indexOf(cur) + 1) % list.length] || list[0];
            step.setAttribute('aria-label', 'Show ' + label + ' in the ' + NAMES[next] + ' lens');
            step.title = 'Show this verse in ' + NAMES[next];
            const name = step.querySelector('.genesis-card__step-name');
            if (name) name.textContent = NAMES[next];
        }
    }

    function setCardLens(card, n) {
        holdScroll(() => {
            if (!n || n === pageLens()) delete card.dataset.lens;
            else card.dataset.lens = String(n);
            paintCard(card);
        });
        announce((card.dataset.label || '') + ': ' + NAMES[cardLens(card)]);
    }

    cards.forEach((card) => {
        const step = card.querySelector('.genesis-card__step');
        const reset = card.querySelector('.genesis-card__reset');
        if (step) {
            step.hidden = false;
            step.addEventListener('click', () => {
                const list = cardLenses(card);
                const cur = cardLens(card);
                const i = list.indexOf(cur);
                setCardLens(card, list[(i + 1) % list.length]);
            });
        }
        if (reset) {
            reset.addEventListener('click', () => {
                setCardLens(card, 0);
                if (step) step.focus();
            });
        }
        paintCard(card);
    });

    // ---- Notes ------------------------------------------------------------
    // The icon is the library reader's marker; here it opens an inline fold.
    // The fold sits right under its line, so opening it moves nothing above.
    function setNote(btn, panel, open) {
        panel.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', (open ? 'Close ' : 'Open ') + (btn.dataset.label || 'note'));
    }

    root.querySelectorAll('.genesis-note-link').forEach((btn) => {
        const panel = document.getElementById(btn.getAttribute('aria-controls') || '');
        if (!panel) return;
        btn.hidden = false;
        setNote(btn, panel, false);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setNote(btn, panel, btn.getAttribute('aria-expanded') !== 'true');
        });
        panel.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !panel.classList.contains('is-open')) return;
            e.stopPropagation();
            setNote(btn, panel, false);
            btn.focus();
        });
        // The passage note's bar: its words open it too (pointer only; the
        // icon is the keyboard and screen-reader control).
        const bar = btn.closest('.genesis-passage-note__bar');
        if (bar) {
            bar.addEventListener('click', (e) => {
                if (e.target.closest('a, button')) return;
                setNote(btn, panel, btn.getAttribute('aria-expanded') !== 'true');
            });
        }
    });

    // ---- Page lens --------------------------------------------------------
    function writeUrl(n) {
        try {
            const url = new URL(window.location.href);
            if (n === 2) url.searchParams.delete('lens');
            else url.searchParams.set('lens', String(n));
            history.replaceState(history.state, '', url.pathname + url.search + url.hash);
        } catch (e) { /* file:// or an old browser: the lens still applies */ }
    }

    function setPageLens(n, opts) {
        opts = opts || {};
        n = valid(n) || 2;
        const apply = () => {
            inputs.forEach((i) => { i.checked = Number(i.value) === n; });
            root.dataset.pageLens = String(n);
            cards.forEach((card) => { delete card.dataset.lens; paintCard(card); });
        };
        if (opts.hold === false) apply(); else holdScroll(apply);
        if (opts.remember !== false) store(STORE, String(n));
        writeUrl(n);
        if (opts.announce !== false) announce('Lens ' + n + ': ' + NAMES[n]);
    }

    inputs.forEach((input) => {
        input.addEventListener('change', () => { if (input.checked) setPageLens(Number(input.value)); });
    });

    function typing(el) {
        if (!el) return false;
        if (el.isContentEditable) return true;
        const tag = el.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
        return tag === 'INPUT' && !el.classList.contains('genesis-lens__input');
    }

    document.addEventListener('keydown', (e) => {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (!/^[1-4]$/.test(e.key) || typing(e.target)) return;
        if (document.body.classList.contains('search-modal-open')) return;
        const n = valid(e.key);
        if (!n) return;
        e.preventDefault();
        setPageLens(n);
        const input = inputs.find((i) => Number(i.value) === n);
        if (input && document.activeElement && document.activeElement.classList.contains('genesis-lens__input')) input.focus();
    });

    // ---- Deep links -------------------------------------------------------
    function revealHash() {
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (!/^v\d+$/.test(id)) return;
        const el = document.getElementById(id);
        if (!el) return;
        const card = el.closest('.genesis-card');
        const target = card || el;
        target.classList.remove('is-target');
        void target.offsetWidth;
        target.classList.add('is-target');
        userMoved = false;
        settle(target, 0);
        // Web fonts arriving late reflow the text above the target.
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => { if (!userMoved) settle(target, 0); });
        }
    }

    // Stop re-aiming as soon as the reader scrolls on their own.
    let userMoved = false;
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((type) => {
        window.addEventListener(type, () => { userMoved = true; }, { passive: true });
    });

    // Passages off screen keep a placeholder size (content-visibility), so
    // the first jump lands near, not on, the target. Re-aim for a few frames
    // until it sits just under the slider.
    function settle(target, frame) {
        if (userMoved) return;
        // Just below the stuck slider and its band's fade edge.
        const want = lensBar
            ? (parseFloat(getComputedStyle(lensBar).top) || 0) + lensBar.offsetHeight + 40
            : 96;
        const off = target.getBoundingClientRect().top - want;
        if (Math.abs(off) > 2) window.scrollBy(0, off);
        if (frame < 20 && (Math.abs(off) > 2 || frame < 4)) {
            window.requestAnimationFrame(() => settle(target, frame + 1));
        }
    }

    // ---- Sticky band ------------------------------------------------------
    let bandQueued = false;
    function paintBand() {
        bandQueued = false;
        if (lensBar) lensBar.classList.toggle('genesis-lens--stuck', stuck() && window.scrollY > 0);
    }
    function queueBand() {
        if (bandQueued) return;
        bandQueued = true;
        window.requestAnimationFrame(paintBand);
    }
    if (lensBar) {
        window.addEventListener('scroll', queueBand, { passive: true });
        window.addEventListener('resize', queueBand, { passive: true });
        // The slider's `top` follows the navbar on phones (a transition).
        lensBar.addEventListener('transitionend', queueBand);
    }

    // ---- Chapter switcher -------------------------------------------------
    const jump = root.querySelector('.genesis-jump__menu');
    if (jump) {
        document.addEventListener('click', (e) => {
            if (jump.open && !jump.contains(e.target)) jump.open = false;
        });
        jump.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !jump.open) return;
            jump.open = false;
            const summary = jump.querySelector('summary');
            if (summary) summary.focus();
        });
    }

    // ---- Start ------------------------------------------------------------
    const params = new URLSearchParams(window.location.search);
    const fromUrl = valid(params.get('lens'));
    const start = fromUrl || valid(stored(STORE)) || 2;
    // The starting lens is not a choice: don't store it (a chapter without
    // a lens file clamps to 2 and must not overwrite a remembered 3).
    setPageLens(start, { announce: false, remember: false, hold: false });
    if (fromUrl || window.location.hash) {
        // After layout has settled on the starting lens.
        window.requestAnimationFrame(revealHash);
    }
    window.addEventListener('hashchange', revealHash);

    // Motion only after the starting lens is painted, so the page does not
    // animate into place on load.
    window.requestAnimationFrame(() => window.requestAnimationFrame(setMotion));
    queueBand();
    if (reduced.addEventListener) reduced.addEventListener('change', setMotion);

    // Print shows all four lenses; nothing to do here — the CSS opens every
    // pane under @media print.
})();
