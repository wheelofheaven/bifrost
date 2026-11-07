/**
 * Knowledge graph — /graph/ (templates/graph.html).
 *
 * Draws static/graph/graph.json (scripts/build_graph.py) on a canvas, no
 * libraries: pages, topics, core claims and cited sources, laid out in the
 * browser by a small force simulation (repulsion through a uniform grid, so a
 * thousand nodes settle in about a second), then panned, zoomed and filtered.
 *
 *   drag            move the view            wheel / pinch   zoom
 *   tap a node      select: card + its neighbourhood lit
 *   legend chip     show or hide a kind      search          find and select
 *   #node=<id>      deep link to a node (kept in the URL while selected)
 *
 * Colours come from CSS custom properties on the figure (--kg-<kind>), so the
 * light and dark themes and the poster-like print stay in the stylesheet.
 */
(function () {
    'use strict';

    const fig = document.querySelector('[data-knowledge-graph]');
    if (!fig) return;
    const canvas = fig.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const card = fig.querySelector('.kg__card');
    const status = fig.querySelector('.kg__status');
    const search = fig.querySelector('.kg__search-input');
    const results = fig.querySelector('.kg__results');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Per kind: base radius, growth with degree, spring length to it, label priority.
    const KIND = {
        topic: { r: 7, grow: 1.2, rest: 70, prio: 5 },
        wiki: { r: 4, grow: 0.55, rest: 46, prio: 3 },
        article: { r: 5, grow: 0.55, rest: 52, prio: 4 },
        timeline: { r: 5.5, grow: 0.5, rest: 52, prio: 4 },
        news: { r: 4, grow: 0.5, rest: 46, prio: 2 },
        book: { r: 3.6, grow: 0.45, rest: 40, prio: 2 },
        dataset: { r: 4.4, grow: 0.5, rest: 46, prio: 2 },
        claim: { r: 3.6, grow: 0.45, rest: 40, prio: 1 },
        source: { r: 1.9, grow: 0.25, rest: 26, prio: 0 },
    };
    const TYPE_REST = { broader: 140, defines: 24, about: 60, precedes: 60, depends_on: 40, quotes: 80, cites: 22, links: 50, see_also: 50, binds: 50 };

    let nodes = [], links = [], byId = new Map();
    const hidden = new Set();
    let selected = null, hovered = null;
    let view = { x: 0, y: 0, k: 1 };
    let W = 0, H = 0, dpr = 1;
    let colors = {};
    let alpha = 1, running = false, rafId = 0, needsDraw = true;

    // ---- data --------------------------------------------------------------------
    fetch(fig.dataset.src)
        .then((r) => {
            if (!r.ok) throw new Error(r.status);
            const len = +r.headers.get('content-length');
            const size = document.querySelector('[data-kg-size]');
            if (size && len) size.textContent = `· ${Math.round(len / 1024)} KB`;
            return r.json();
        })
        .then(init)
        .catch(() => { status.textContent = status.dataset.error || 'The graph could not be loaded.'; });

    function init(data) {
        data.nodes.forEach((n) => {
            const k = KIND[n.kind] || KIND.wiki;
            Object.assign(n, { deg: 0, nb: [], vx: 0, vy: 0, x: 0, y: 0, k });
            byId.set(n.id, n);
        });
        nodes = data.nodes;
        data.links.forEach(([a, b, type]) => {
            const s = byId.get(a), t = byId.get(b);
            if (!s || !t) return;
            s.deg++; t.deg++;
            s.nb.push(t); t.nb.push(s);
            links.push({ s, t, type, rest: TYPE_REST[type] || 50 });
        });
        nodes.forEach((n) => { n.r = n.k.r + Math.sqrt(n.deg) * n.k.grow; });
        // Deterministic start: a sunflower spiral ordered by importance, so the
        // layout comes out the same on every visit and hubs start central.
        const order = nodes.slice().sort((a, b) => (b.k.prio - a.k.prio) || (b.deg - a.deg) || (a.id < b.id ? -1 : 1));
        const golden = Math.PI * (3 - Math.sqrt(5));
        order.forEach((n, i) => {
            const rad = 14 * Math.sqrt(i + 1);
            n.x = Math.cos(i * golden) * rad;
            n.y = Math.sin(i * golden) * rad;
        });
        fillCounts();
        status.hidden = true;
        readColors();
        resize();
        if (reduce) { for (let i = 0; i < 330; i++) tick(); alpha = 0; fit(false); draw(); }
        else { fit(false); start(); }
        const fromHash = decodeURIComponent((location.hash.match(/node=([^&]+)/) || [])[1] || '');
        if (fromHash && byId.has(fromHash)) {
            const go = () => select(byId.get(fromHash), true);
            if (reduce) go(); else setTimeout(go, 900);
        }
    }

    function fillCounts() {
        const c = {};
        nodes.forEach((n) => { c[n.kind] = (c[n.kind] || 0) + 1; });
        fig.querySelectorAll('[data-kind-count]').forEach((el) => {
            el.textContent = c[el.dataset.kindCount] || 0;
            if (!c[el.dataset.kindCount]) el.closest('[data-kind]').hidden = true;
        });
        const total = document.querySelector('[data-kg-total]');
        if (total) total.textContent = `${nodes.length.toLocaleString('en')} nodes · ${links.length.toLocaleString('en')} links`;
    }

    // ---- simulation -------------------------------------------------------------
    // The d3-force model, hand-rolled: many-body repulsion through a Barnes–Hut
    // quadtree (theta 0.9), springs whose strength falls with the busier end's
    // degree, a weak pull to the centre, velocity decay 0.4, alpha cooling from
    // 1 to 0.002 over ~300 ticks. Hubs (topics) carry the most charge, so they
    // spread across the plane and pages settle around the topics they are about.
    const CHARGE = { topic: -520, wiki: -70, article: -90, timeline: -110, news: -60, book: -55, dataset: -70, claim: -45, source: -12 };
    let linkStrength = null;

    function quadtree() {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const n of nodes) {
            if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x;
            if (n.y < y0) y0 = n.y; if (n.y > y1) y1 = n.y;
        }
        const size = Math.max(x1 - x0, y1 - y0) + 1;
        const root = { x0, y0, s: size, q: null, n: null, c: 0, cx: 0, cy: 0 };
        const insert = (cell, n, depth) => {
            if (!cell.q && !cell.n) { cell.n = n; return; }
            if (!cell.q) {
                if (depth > 40) { cell.extra = (cell.extra || []).concat(n); return; }
                const old = cell.n; cell.n = null;
                cell.q = [null, null, null, null];
                place(cell, old, depth);
            }
            place(cell, n, depth);
        };
        const place = (cell, n, depth) => {
            const h = cell.s / 2;
            const i = (n.x >= cell.x0 + h ? 1 : 0) + (n.y >= cell.y0 + h ? 2 : 0);
            if (!cell.q[i]) cell.q[i] = { x0: cell.x0 + (i & 1 ? h : 0), y0: cell.y0 + (i & 2 ? h : 0), s: h, q: null, n: null, c: 0, cx: 0, cy: 0 };
            insert(cell.q[i], n, depth + 1);
        };
        for (const n of nodes) insert(root, n, 0);
        const accumulate = (cell) => {
            let c = 0, cx = 0, cy = 0;
            if (cell.q) {
                for (const sub of cell.q) if (sub) { accumulate(sub); c += sub.c; cx += sub.cx * sub.c; cy += sub.cy * sub.c; }
            }
            for (const n of cell.n ? [cell.n].concat(cell.extra || []) : (cell.extra || [])) { c += n.charge; cx += n.x * n.charge; cy += n.y * n.charge; }
            cell.c = c;
            cell.cx = c ? cx / c : cell.x0 + cell.s / 2;
            cell.cy = c ? cy / c : cell.y0 + cell.s / 2;
        };
        accumulate(root);
        return root;
    }

    function repel(cell, n, a) {
        if (!cell || !cell.c) return;
        const dx = cell.cx - n.x, dy = cell.cy - n.y;
        let d2 = dx * dx + dy * dy;
        if (cell.q && (cell.s * cell.s) / 0.81 > d2) {
            for (const sub of cell.q) repel(sub, n, a);
            for (const m of cell.n ? [cell.n].concat(cell.extra || []) : (cell.extra || [])) pointRepel(m, n, a);
            return;
        }
        if (!cell.q) { for (const m of cell.n ? [cell.n].concat(cell.extra || []) : (cell.extra || [])) pointRepel(m, n, a); return; }
        if (d2 < 1) d2 = 1;
        const w = cell.c * a / d2;
        n.vx += dx * w; n.vy += dy * w;
    }

    function pointRepel(m, n, a) {
        if (m === n) return;
        let dx = m.x - n.x, dy = m.y - n.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = (n.index % 7) - 3 || 1; dy = (n.index % 5) - 2 || 1; d2 = dx * dx + dy * dy; }
        const w = m.charge * a / d2;
        n.vx += dx * w; n.vy += dy * w;
    }

    function tick() {
        if (!linkStrength) {
            nodes.forEach((n, i) => { n.index = i; n.charge = CHARGE[n.kind] || -40; });
            linkStrength = links.map((l) => 1 / Math.min(l.s.deg, l.t.deg));
        }
        const root = quadtree();
        for (const n of nodes) repel(root, n, alpha);
        links.forEach((l, i) => {
            let dx = l.t.x + l.t.vx - l.s.x - l.s.vx, dy = l.t.y + l.t.vy - l.s.y - l.s.vy;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            const f = (d - l.rest) / d * alpha * linkStrength[i];
            dx *= f; dy *= f;
            const b = l.s.deg / (l.s.deg + l.t.deg);
            l.t.vx -= dx * b; l.t.vy -= dy * b;
            l.s.vx += dx * (1 - b); l.s.vy += dy * (1 - b);
        });
        for (const n of nodes) {
            n.vx -= n.x * 0.012 * alpha;
            n.vy -= n.y * 0.012 * alpha;
            n.x += (n.vx *= 0.6);
            n.y += (n.vy *= 0.6);
        }
        alpha += (0 - alpha) * 0.0205;
        if (alpha < 0.002) alpha = 0;
    }

    function start() {
        if (running) return;
        running = true;
        let frames = 0;
        const step = () => {
            for (let i = 0; i < 3; i++) tick();
            if (frames++ % 20 === 0 && !userMoved) fit(false);
            draw();
            if (alpha > 0) rafId = requestAnimationFrame(step);
            else { running = false; if (!userMoved) fit(true); }
        };
        rafId = requestAnimationFrame(step);
    }

    // ---- view -------------------------------------------------------------------
    let userMoved = false;
    function resize() {
        const r = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width; H = r.height;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        needsDraw = true;
        draw();
    }

    function visible(n) { return !hidden.has(n.kind); }

    function bounds(list) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const n of list) {
            if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x;
            if (n.y < y0) y0 = n.y; if (n.y > y1) y1 = n.y;
        }
        return { x0, y0, x1, y1 };
    }

    function fit(animate) {
        const vis = nodes.filter(visible);
        if (!vis.length) return;
        const b = bounds(vis);
        const pad = 40;
        const k = Math.min((W - pad * 2) / Math.max(b.x1 - b.x0, 1), (H - pad * 2) / Math.max(b.y1 - b.y0, 1));
        to({ k: Math.min(Math.max(k, 0.05), 3), x: -(b.x0 + b.x1) / 2, y: -(b.y0 + b.y1) / 2 }, animate);
    }

    function to(target, animate) {
        if (!animate || reduce) { view = target; draw(); return; }
        const from = Object.assign({}, view), t0 = performance.now(), dur = 420;
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const anim = (now) => {
            const t = Math.min(1, (now - t0) / dur), e = ease(t);
            view = { k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
            draw();
            if (t < 1) requestAnimationFrame(anim);
        };
        requestAnimationFrame(anim);
    }

    const sx = (x) => (x + view.x) * view.k + W / 2;
    const sy = (y) => (y + view.y) * view.k + H / 2;
    const wx = (px) => (px - W / 2) / view.k - view.x;
    const wy = (py) => (py - H / 2) / view.k - view.y;

    // ---- drawing ----------------------------------------------------------------
    function readColors() {
        const cs = getComputedStyle(fig);
        colors = {};
        Object.keys(KIND).forEach((k) => { colors[k] = cs.getPropertyValue('--kg-' + k).trim() || '#888'; });
        ['link', 'link-strong', 'label', 'label-halo', 'ring'].forEach((k) => { colors[k] = cs.getPropertyValue('--kg-' + k).trim(); });
        colors.font = cs.getPropertyValue('--kg-font').trim() || 'sans-serif';
        colors.claim = {};
        ['direct', 'framework', 'inferred', 'speculative'].forEach((k) => { colors.claim[k] = cs.getPropertyValue('--kg-claim-' + k).trim(); });
    }

    function draw() {
        if (!W) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const focus = selected || hovered;
        const lit = focus ? new Set([focus, ...focus.nb]) : null;

        // links: one faint batch, then the focused neighbourhood on top
        ctx.lineWidth = Math.max(0.35, Math.min(1, view.k * 0.9));
        ctx.strokeStyle = colors.link;
        ctx.globalAlpha = focus ? 0.25 : 1;
        ctx.beginPath();
        for (const l of links) {
            if (!visible(l.s) || !visible(l.t)) continue;
            ctx.moveTo(sx(l.s.x), sy(l.s.y));
            ctx.lineTo(sx(l.t.x), sy(l.t.y));
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (focus) {
            ctx.strokeStyle = colors['link-strong'];
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (const m of focus.nb) {
                if (!visible(m)) continue;
                ctx.moveTo(sx(focus.x), sy(focus.y));
                ctx.lineTo(sx(m.x), sy(m.y));
            }
            ctx.stroke();
        }

        // nodes
        const rScale = Math.max(0.55, Math.min(1.6, Math.sqrt(view.k)));
        for (const n of nodes) {
            if (!visible(n)) continue;
            const x = sx(n.x), y = sy(n.y);
            const r = n.r * rScale;
            if (x < -r || y < -r || x > W + r || y > H + r) continue;
            ctx.globalAlpha = lit && !lit.has(n) ? 0.18 : 1;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = colors[n.kind];
            ctx.fill();
            if (n.kind === 'topic') {
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = colors.ring;
                ctx.stroke();
            }
            if (n.claim && colors.claim[n.claim] && n.kind === 'claim') {
                ctx.lineWidth = 1.4;
                ctx.strokeStyle = colors.claim[n.claim];
                ctx.stroke();
            }
            if (n === selected) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = colors.label;
                ctx.beginPath();
                ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        drawLabels(lit);
    }

    // Labels by priority: the focus and its neighbours, then topics, then pages by
    // degree, as long as there is room — a screen-space grid stops overlaps.
    function drawLabels(lit) {
        const occupied = new Set();
        const cell = 14;
        const fits = (x, y, w, h) => {
            const x0 = Math.floor(x / cell), x1 = Math.floor((x + w) / cell);
            const y0 = Math.floor(y / cell), y1 = Math.floor((y + h) / cell);
            for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) if (occupied.has(i + ',' + j)) return false;
            for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) occupied.add(i + ',' + j);
            return true;
        };
        let cands;
        if (lit) cands = [...lit].filter(visible).sort((a, b) => (b === (selected || hovered)) - (a === (selected || hovered)) || b.deg - a.deg);
        else {
            const minPrio = view.k > 2.2 ? 0 : view.k > 1.2 ? 1 : view.k > 0.7 ? 2 : view.k > 0.4 ? 4 : 5;
            cands = nodes.filter((n) => visible(n) && n.k.prio >= minPrio).sort((a, b) => b.k.prio - a.k.prio || b.deg - a.deg);
        }
        const rScale = Math.max(0.55, Math.min(1.6, Math.sqrt(view.k)));
        let shown = 0;
        for (const n of cands) {
            if (shown > 160) break;
            const x = sx(n.x), y = sy(n.y);
            if (x < 0 || y < 0 || x > W || y > H) continue;
            const size = n.kind === 'topic' ? 13 : 11.5;
            const weight = n.kind === 'topic' || n === selected ? 600 : 500;
            ctx.font = `${weight} ${size}px ${colors.font}`;
            const text = n.label.length > 42 ? n.label.slice(0, 40) + '…' : n.label;
            const w = ctx.measureText(text).width;
            const lx = x + n.r * rScale + 4, ly = y + size * 0.35;
            if (!fits(lx, ly - size, w, size + 2)) continue;
            ctx.lineWidth = 3;
            ctx.strokeStyle = colors['label-halo'];
            ctx.lineJoin = 'round';
            ctx.strokeText(text, lx, ly);
            ctx.fillStyle = colors.label;
            ctx.fillText(text, lx, ly);
            shown++;
        }
    }

    // ---- picking & selection -----------------------------------------------------
    function nodeAt(px, py) {
        const x = wx(px), y = wy(py);
        let best = null, bd = Infinity;
        const rScale = Math.max(0.55, Math.min(1.6, Math.sqrt(view.k)));
        for (const n of nodes) {
            if (!visible(n)) continue;
            const d = Math.hypot(n.x - x, n.y - y) * view.k;
            const hit = Math.max(n.r * rScale + 4, 10);
            if (d < hit && d < bd) { bd = d; best = n; }
        }
        return best;
    }

    const KIND_LABEL = {};
    fig.querySelectorAll('[data-kind]').forEach((b) => { KIND_LABEL[b.dataset.kind] = b.dataset.kindName || b.dataset.kind; });

    function select(n, center) {
        selected = n;
        if (!n) {
            card.hidden = true;
            history.replaceState(null, '', location.pathname + location.search);
            draw();
            return;
        }
        if (hidden.has(n.kind)) toggleKind(n.kind, true);
        card.hidden = false;
        card.querySelector('.kg__card-kind').textContent = n.kind === 'topic' ? `${KIND_LABEL.topic || 'Topic'} · ${n.meta}` : (KIND_LABEL[n.kind] || n.kind) + (n.meta ? ' · ' + n.meta : '');
        card.querySelector('.kg__card-kind').style.setProperty('--dot', colors[n.kind]);
        card.querySelector('.kg__card-title').textContent = n.label;
        card.querySelector('.kg__card-desc').textContent = n.desc || '';
        card.querySelector('.kg__card-desc').hidden = !n.desc;
        const open = card.querySelector('.kg__card-open');
        open.href = n.url;
        open.hidden = !n.url || n.url.startsWith('/graph/');
        const list = card.querySelector('.kg__card-links');
        list.innerHTML = '';
        const nb = n.nb.slice().sort((a, b) => b.k.prio - a.k.prio || b.deg - a.deg);
        card.querySelector('.kg__card-count').textContent = nb.length;
        nb.slice(0, 12).forEach((m) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.setProperty('--dot', colors[m.kind]);
            btn.textContent = m.label;
            btn.addEventListener('click', () => select(m, true));
            li.appendChild(btn);
            list.appendChild(li);
        });
        if (nb.length > 12) {
            const li = document.createElement('li');
            li.className = 'kg__card-more';
            li.textContent = `+ ${nb.length - 12}`;
            list.appendChild(li);
        }
        history.replaceState(null, '', '#node=' + encodeURIComponent(n.id));
        if (center) {
            userMoved = true;
            // On phones the card covers the lower half: centre the node above it.
            const k = Math.max(view.k, 1.1);
            const lift = W < 700 ? (H * 0.22) / k : 0;
            to({ k, x: -n.x, y: -n.y - lift }, true);
        }
        else draw();
    }

    // ---- input ------------------------------------------------------------------
    const pointers = new Map();
    let dragStart = null, pinch = null, moved = false;
    canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
        moved = false;
        if (pointers.size === 1) dragStart = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y };
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
        }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
        if (pinch && pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.k * d / pinch.d) / view.k);
            moved = true;
            return;
        }
        if (dragStart && pointers.size === 1) {
            const dx = e.offsetX - dragStart.x, dy = e.offsetY - dragStart.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
            if (moved) {
                userMoved = true;
                view.x = dragStart.vx + dx / view.k;
                view.y = dragStart.vy + dy / view.k;
                draw();
            }
            return;
        }
        if (e.pointerType === 'mouse') {
            const n = nodeAt(e.offsetX, e.offsetY);
            if (n !== hovered) { hovered = n; canvas.style.cursor = n ? 'pointer' : 'grab'; draw(); }
        }
    });
    const end = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (pointers.size === 0) {
            if (!moved) select(nodeAt(e.offsetX, e.offsetY), false);
            dragStart = null;
        }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinch = null; dragStart = null; });
    canvas.addEventListener('pointerleave', () => { if (hovered) { hovered = null; draw(); } });
    canvas.addEventListener('dblclick', (e) => {
        const n = nodeAt(e.offsetX, e.offsetY);
        if (n && n.url && !n.url.startsWith('/graph/')) location.href = n.url;
    });

    function zoomAt(px, py, factor) {
        const k = Math.min(Math.max(view.k * factor, 0.05), 6);
        const x0 = wx(px), y0 = wy(py);
        view.k = k;
        view.x = (px - W / 2) / k - x0;
        view.y = (py - H / 2) / k - y0;
        userMoved = true;
        draw();
    }
    // The page scrolls under a plain wheel; zoom takes ⌘/Ctrl + wheel (and a
    // trackpad pinch, which arrives as ctrlKey) — or any wheel in full screen.
    canvas.addEventListener('wheel', (e) => {
        if (!(e.ctrlKey || e.metaKey || fig.classList.contains('kg--full'))) {
            fig.classList.add('kg--hint');
            clearTimeout(canvas._hint);
            canvas._hint = setTimeout(() => fig.classList.remove('kg--hint'), 1400);
            return;
        }
        e.preventDefault();
        zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0022));
    }, { passive: false });

    fig.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
        const z = b.dataset.zoom;
        if (z === 'fit') { userMoved = false; fit(true); return; }
        const f = z === 'in' ? 1.5 : 1 / 1.5;
        to({ k: Math.min(Math.max(view.k * f, 0.05), 6), x: view.x, y: view.y }, true);
        userMoved = true;
    }));
    const fullBtn = fig.querySelector('[data-fullscreen]');
    if (fullBtn) fullBtn.addEventListener('click', () => {
        const on = fig.classList.toggle('kg--full');
        fullBtn.setAttribute('aria-pressed', String(on));
        document.documentElement.classList.toggle('kg-full-open', on);
        requestAnimationFrame(() => { resize(); fit(false); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (fig.classList.contains('kg--full')) fullBtn.click();
            else if (selected) select(null);
        }
    });

    // legend: show / hide a kind
    function toggleKind(kind, show) {
        const btn = fig.querySelector(`[data-kind="${kind}"]`);
        const on = show === undefined ? hidden.has(kind) : show;
        if (on) hidden.delete(kind); else hidden.add(kind);
        if (btn) btn.setAttribute('aria-pressed', String(on));
        if (selected && hidden.has(selected.kind)) select(null);
        draw();
    }
    fig.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => toggleKind(b.dataset.kind)));

    // search
    let matches = [];
    function renderResults() {
        const q = search.value.trim().toLowerCase();
        results.innerHTML = '';
        if (q.length < 2) { results.hidden = true; return; }
        matches = nodes
            .filter((n) => n.label.toLowerCase().includes(q))
            .sort((a, b) => (a.label.toLowerCase().startsWith(q) ? 0 : 1) - (b.label.toLowerCase().startsWith(q) ? 0 : 1) || b.k.prio - a.k.prio || b.deg - a.deg)
            .slice(0, 8);
        matches.forEach((n, i) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style.setProperty('--dot', colors[n.kind]);
            btn.innerHTML = '<span></span><small></small>';
            btn.firstChild.textContent = n.label;
            btn.lastChild.textContent = KIND_LABEL[n.kind] || n.kind;
            btn.addEventListener('click', () => { pick(i); });
            li.appendChild(btn);
            results.appendChild(li);
        });
        results.hidden = !matches.length;
    }
    function pick(i) {
        const n = matches[i];
        if (!n) return;
        results.hidden = true;
        search.value = n.label;
        select(n, true);
    }
    search.addEventListener('input', renderResults);
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pick(0); } if (e.key === 'Escape') { results.hidden = true; } });
    document.addEventListener('click', (e) => { if (!e.target.closest('.kg__search')) results.hidden = true; });

    card.querySelector('.kg__card-close').addEventListener('click', () => select(null));

    // theme switches recolour
    new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); if (!userMoved) fit(false); }, 120); });
})();
