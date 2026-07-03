/* /timeline/chronology — "The Equinox Observatory".
 *
 * A cinematic orbital scene: a canvas star sky (real star positions and
 * zodiac constellation figures in ecliptic coordinates, from
 * /data/zodiac-sky.json), the Sun pinned at the vernal-equinox point above
 * the Earth's limb, and a precession pan that slides the zodiac band behind
 * the Sun as the active age changes. The constellation standing behind the
 * rising Sun IS the age — that is the whole visual argument of the page.
 *
 * The DOM carries the ages (scrubber buttons with data-* state), the Earth
 * limb (cross-fading texture layers) and the HUD; this script drives the
 * canvas, the year counter and the state transitions.
 */
(function () {
    'use strict';

    var root = document.querySelector('[data-chronology]');
    if (!root) return;

    var stage = root.querySelector('[data-stage]');
    var canvas = root.querySelector('[data-sky]');
    var ctx = canvas.getContext('2d');
    var nodes = Array.prototype.slice.call(root.querySelectorAll('[data-node]'));
    if (!nodes.length || !ctx) return;

    var earths = Array.prototype.slice.call(root.querySelectorAll('[data-earth]'));
    var hudGlyph = root.querySelector('[data-hud-glyph]');
    var hudName = root.querySelector('[data-hud-name]');
    var hudSpan = root.querySelector('[data-hud-span]');
    var hudYear = root.querySelector('[data-year]');
    var elEvent = root.querySelector('[data-readout-event]');
    var elArt = root.querySelector('[data-readout-art]');
    var elArtImg = root.querySelector('[data-readout-art-img]');
    var elArtAvif = root.querySelector('[data-readout-art-avif]');
    var elCta = root.querySelector('[data-readout-cta]');
    var elToday = root.querySelector('[data-readout-today]');
    var elFill = root.querySelector('[data-deck-fill]');
    var playBtn = root.querySelector('[data-play]');
    var playLabel = root.querySelector('[data-play-label]');

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var todayIndex = Number(root.getAttribute('data-today-index')) || (nodes.length - 1);
    var todayYear = Number(root.getAttribute('data-today-year')) || 2026;
    var lang = document.documentElement.lang || 'en';
    var numFmt;
    try { numFmt = new Intl.NumberFormat(lang); } catch (e) { numFmt = new Intl.NumberFormat('en'); }

    var AGES = nodes.map(function (btn) {
        return {
            el: btn,
            color: btn.getAttribute('data-color'),
            name: btn.getAttribute('data-name'),
            event: btn.getAttribute('data-event'),
            startYear: Number(btn.getAttribute('data-start-year')),
            endYear: Number(btn.getAttribute('data-end-year')),
            constId: btn.getAttribute('data-const'),
            vignette: btn.getAttribute('data-vignette') || '',
            href: btn.getAttribute('data-href'),
            today: btn.getAttribute('data-today') === 'true',
            lon: 0
        };
    });
    var N = AGES.length;
    AGES.forEach(function (a) { a.midYear = (a.startYear + a.endYear) / 2; });

    var LABELS = {
        play: playBtn.getAttribute('data-label-play') || 'Play',
        pause: playBtn.getAttribute('data-label-pause') || 'Pause',
        replay: playBtn.getAttribute('data-label-replay') || 'Replay'
    };

    // ---- Sky data ------------------------------------------------
    var sky = null;          // { stars: [[lon,lat,mag,bv],...], zodiac: [...] }
    var constMap = {};       // id -> constellation record (+ labelLat)
    var lonKeys = null;      // [{year, lon}] keyframes for year -> longitude

    fetch(root.getAttribute('data-sky-url'))
        .then(function (r) { return r.json(); })
        .then(function (data) {
            sky = data;
            data.zodiac.forEach(function (c) {
                // Label sits above the figure: use the max ecliptic latitude.
                var maxLat = -90;
                c.lines.forEach(function (seg) {
                    seg.forEach(function (p) { if (p[1] > maxLat) maxLat = p[1]; });
                });
                c.labelLat = maxLat;
                constMap[c.id] = c;
            });
            // Unwrap the per-age constellation centres into a strictly
            // decreasing longitude sequence — the retrograde precession
            // drift. One Great Year = one full turn of real sky.
            var prev = null;
            AGES.forEach(function (a) {
                var c = constMap[a.constId] ? constMap[a.constId].center : 0;
                if (prev !== null) {
                    while (c > prev) c -= 360;
                    while (prev - c > 360) c += 360;
                }
                a.lon = c;
                prev = c;
            });
            lonKeys = AGES.map(function (a) { return { year: a.midYear, lon: a.lon }; });
            skyLon = targetLon = AGES[active].lon;
            requestDraw();
        })
        .catch(function () { /* the DOM scene still works without the sky */ });

    // Piecewise-linear year -> ecliptic longitude of the equinox backdrop,
    // extrapolated at both ends with the mean precession rate.
    var RATE = -360 / 25920; // degrees per year (retrograde)
    function lonForYear(y) {
        if (!lonKeys) return 0;
        var first = lonKeys[0], last = lonKeys[lonKeys.length - 1];
        if (y <= first.year) return first.lon + (y - first.year) * RATE;
        if (y >= last.year) return last.lon + (y - last.year) * RATE;
        for (var i = 0; i < lonKeys.length - 1; i++) {
            var a = lonKeys[i], b = lonKeys[i + 1];
            if (y >= a.year && y <= b.year) {
                var t = (y - a.year) / (b.year - a.year);
                return a.lon + (b.lon - a.lon) * t;
            }
        }
        return last.lon;
    }

    function indexForYear(y) {
        for (var i = 0; i < N; i++) {
            if (y >= AGES[i].startYear && y < AGES[i].endYear) return i;
        }
        return y < AGES[0].startYear ? 0 : N - 1;
    }

    // ---- State ---------------------------------------------------
    var active = todayIndex;
    var mode = 'idle';            // 'idle' | 'play'
    var skyLon = 0;               // current (unwrapped) longitude at the sun
    var targetLon = 0;
    var dispYear = AGES[todayIndex].startYear;
    var targetYear = AGES[todayIndex].startYear;
    var sunY = 0;                 // sun y in px, anchored to the orb limb
    var targetSunY = 0;
    var playStart = 0;
    var PLAY_MS = reduceMotion ? 13000 : 34000;
    var running = false;
    var visible = true;
    var lastT = 0;

    // The sun rides just above the Earth's limb; for "In the beginning"
    // (pre-arrival) it waits below the horizon and rises with Capricorn.
    var earthEl = root.querySelector('[data-earth-orb]');
    var horizonY = 0;
    function measureHorizon() {
        if (!earthEl) { horizonY = H * 0.72; return; }
        var er = earthEl.getBoundingClientRect();
        var sr = stage.getBoundingClientRect();
        horizonY = er.top - sr.top;
    }
    function sunYFor(index) {
        return index === 0
            ? horizonY + Math.max(24, H * 0.035)
            : horizonY - Math.max(42, H * 0.075);
    }

    function eraLabel(y) {
        var r = Math.round(y);
        var abs = Math.abs(r);
        // Group digits only for 5-digit years — "21,810 BC" but "2026 AD".
        var num = abs >= 10000 ? numFmt.format(abs) : String(abs);
        return num + ' ' + (r < 0 ? 'BC' : 'AD');
    }

    // ---- Rendering -----------------------------------------------
    var W = 0, H = 0, dpr = 1;
    function resize() {
        var rect = stage.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = Math.max(1, Math.round(rect.width));
        H = Math.max(1, Math.round(rect.height));
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        measureHorizon();
        targetSunY = sunYFor(active);
        if (!sunY) sunY = targetSunY;
        requestDraw();
    }

    function accentColor() {
        return getComputedStyle(root).getPropertyValue('--age-accent').trim() || '#5e91e5';
    }

    function wrap180(d) {
        d = d % 360;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        return d;
    }

    var bodyFont = '"Inter", system-ui, sans-serif';
    try {
        var f = getComputedStyle(document.body).fontFamily;
        if (f) bodyFont = f;
    } catch (e) { /* keep fallback */ }

    function starColor(bv) {
        if (bv < 0.1) return '198, 216, 255';
        if (bv < 0.5) return '228, 237, 255';
        if (bv < 1.0) return '255, 246, 230';
        return '255, 226, 195';
    }

    function draw(now) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (!sky) return;

        var accent = accentColor();
        var fov = Math.min(88, Math.max(52, W / 15));  // horizontal degrees
        var ppd = W / fov;                              // px per degree
        var cx = W / 2;
        var t = now / 1000;

        function sx(lon) { return cx - wrap180(lon - skyLon) * ppd; }
        function sy(lat) { return sunY - lat * ppd * 0.92; }

        // Ecliptic line — a faint dotted guide through the sun.
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 7]);
        ctx.beginPath();
        ctx.moveTo(0, sunY);
        ctx.lineTo(W, sunY);
        ctx.stroke();
        ctx.restore();

        // Stars.
        var margin = 30;
        for (var i = 0; i < sky.stars.length; i++) {
            var s = sky.stars[i];
            var x = sx(s[0]);
            if (x < -margin || x > W + margin) continue;
            var y = sy(s[1]);
            if (y < -margin || y > H + margin) continue;
            var mag = s[2];
            var r = Math.max(0.6, 2.5 - mag * 0.42);
            var a = Math.max(0.10, Math.min(0.95, 1.12 - mag * 0.185));
            if (!reduceMotion && mag > 1.8) {
                a *= 0.82 + 0.18 * Math.sin(t * 1.9 + i * 2.399);
            }
            ctx.beginPath();
            ctx.fillStyle = 'rgba(' + starColor(s[3]) + ',' + a.toFixed(3) + ')';
            ctx.arc(x, y, r, 0, 6.2832);
            ctx.fill();
            if (mag < 1.6) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(' + starColor(s[3]) + ',' + (a * 0.16).toFixed(3) + ')';
                ctx.arc(x, y, r * 3.2, 0, 6.2832);
                ctx.fill();
            }
        }

        // Constellation figures + labels.
        var activeId = AGES[active].constId;
        for (var z = 0; z < sky.zodiac.length; z++) {
            var c = sky.zodiac[z];
            var isActive = c.id === activeId;
            var lx = sx(c.center);
            if (lx < -W * 0.6 || lx > W * 1.6) continue;

            ctx.save();
            if (isActive) {
                ctx.strokeStyle = accent;
                ctx.globalAlpha = 0.85;
                ctx.lineWidth = 1.4;
                ctx.shadowColor = accent;
                ctx.shadowBlur = 9;
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.85)';
                ctx.globalAlpha = 0.14;
                ctx.lineWidth = 1;
            }
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            for (var l = 0; l < c.lines.length; l++) {
                var seg = c.lines[l];
                ctx.beginPath();
                for (var p = 0; p < seg.length; p++) {
                    var px = sx(seg[p][0]);
                    var py = sy(seg[p][1]);
                    if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            // Vertex dots on the active figure make the stick stars pop.
            if (isActive) {
                ctx.shadowBlur = 6;
                ctx.fillStyle = '#ffffff';
                for (var l2 = 0; l2 < c.lines.length; l2++) {
                    for (var p2 = 0; p2 < c.lines[l2].length; p2++) {
                        var vx = sx(c.lines[l2][p2][0]);
                        var vy = sy(c.lines[l2][p2][1]);
                        ctx.beginPath();
                        ctx.arc(vx, vy, 1.7, 0, 6.2832);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();

            // Latin name above the figure.
            var ly = sy(c.labelLat) - 16;
            ctx.save();
            ctx.font = '600 11px ' + bodyFont;
            try { ctx.letterSpacing = '3px'; } catch (e) { /* older engines */ }
            ctx.textAlign = 'center';
            ctx.fillStyle = isActive ? accent : 'rgba(255,255,255,0.30)';
            ctx.globalAlpha = isActive ? 0.95 : 0.5;
            ctx.fillText(c.name.toUpperCase(), lx, Math.max(20, ly));
            ctx.restore();
        }

        // ---- The Sun at the vernal-equinox point ----
        var breath = reduceMotion ? 1 : 0.94 + 0.06 * Math.sin(t * 0.9);
        var coreR = Math.max(8, Math.min(W, H) * 0.012);

        // Accent-tinted corona, breathing slowly.
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        var corona = ctx.createRadialGradient(cx, sunY, 0, cx, sunY, Math.min(W, H) * 0.34);
        corona.addColorStop(0, 'rgba(255,250,235,0.55)');
        corona.addColorStop(0.12, 'rgba(255,242,205,' + (0.30 * breath).toFixed(3) + ')');
        corona.addColorStop(0.4, 'rgba(255,232,185,' + (0.10 * breath).toFixed(3) + ')');
        corona.addColorStop(1, 'rgba(255,230,180,0)');
        ctx.fillStyle = corona;
        ctx.fillRect(0, 0, W, H);

        // Horizontal lens streak hugging the ecliptic.
        ctx.translate(cx, sunY);
        ctx.scale(1, 0.045);
        var streak = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.30);
        streak.addColorStop(0, 'rgba(255,248,225,0.55)');
        streak.addColorStop(0.35, 'rgba(255,240,200,0.16)');
        streak.addColorStop(1, 'rgba(255,235,190,0)');
        ctx.fillStyle = streak;
        ctx.beginPath();
        ctx.arc(0, 0, W * 0.30, 0, 6.2832);
        ctx.fill();
        ctx.restore();

        // Vertical diffraction spike, softer than the streak.
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.translate(cx, sunY);
        ctx.scale(0.018, 1);
        var spike = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 14);
        spike.addColorStop(0, 'rgba(255,248,225,0.5)');
        spike.addColorStop(0.5, 'rgba(255,240,200,0.12)');
        spike.addColorStop(1, 'rgba(255,235,190,0)');
        ctx.fillStyle = spike;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 14, 0, 6.2832);
        ctx.fill();
        ctx.restore();

        // Chromatic rim + crisp core.
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,236,190,0.85)';
        ctx.shadowColor = accent;
        ctx.shadowBlur = 34;
        ctx.arc(cx, sunY, coreR * 1.5, 0, 6.2832);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = '#fffdf6';
        ctx.shadowColor = 'rgba(255,244,210,0.95)';
        ctx.shadowBlur = 22;
        ctx.arc(cx, sunY, coreR, 0, 6.2832);
        ctx.fill();
        ctx.restore();

        // Equinox tick under the sun, pointing at the horizon.
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, sunY + coreR + 10);
        ctx.lineTo(cx, sunY + Math.max(30, H * 0.06));
        ctx.stroke();
        ctx.restore();
    }

    // ---- State application ---------------------------------------
    function applyAge(i, opts) {
        opts = opts || {};
        active = i;
        var age = AGES[i];

        nodes.forEach(function (n, k) { n.classList.toggle('is-active', k === i); });
        earths.forEach(function (e, k) { e.classList.toggle('is-active', k === i); });
        root.setAttribute('data-active-color', age.color);

        if (hudGlyph) {
            var g = age.el.querySelector('[data-glyph-src]');
            if (g) hudGlyph.innerHTML = g.innerHTML;
        }
        if (hudName) hudName.textContent = age.name;
        if (hudSpan) hudSpan.textContent = eraLabel(age.startYear) + ' — ' + eraLabel(age.endYear);
        if (elEvent) elEvent.textContent = age.event;
        if (elArt && elArtImg && age.vignette && elArtImg.getAttribute('src') !== age.vignette) {
            elArtImg.classList.add('is-swapping');
            var swapTo = age.vignette;
            var reveal = function () {
                if (elArtImg.getAttribute('src') === swapTo) elArtImg.classList.remove('is-swapping');
            };
            elArtImg.addEventListener('load', reveal, { once: true });
            if (elArtAvif) elArtAvif.srcset = swapTo.replace('.webp', '.avif');
            elArtImg.src = swapTo;
            elArtImg.alt = age.name;
            if (elArtImg.complete) reveal();
        }
        if (elCta) elCta.setAttribute('href', age.href);
        if (elToday) elToday.hidden = !age.today;

        targetLon = age.lon;
        targetSunY = sunYFor(i);
        if (!opts.keepYear) targetYear = age.startYear;
        if (elFill && mode !== 'play') {
            elFill.style.width = ((i / (N - 1)) * 100).toFixed(2) + '%';
        }
        requestDraw();
    }

    function setPlayState(state) {
        root.setAttribute('data-play-state', state);
        var key = state === 'pause' ? 'pause' : (state === 'replay' ? 'replay' : 'play');
        if (playLabel) playLabel.textContent = LABELS[key];
        playBtn.setAttribute('aria-label', LABELS[key]);
    }

    function stopPlay(finished) {
        if (mode !== 'play') { setPlayState(finished ? 'replay' : 'play'); return; }
        mode = 'idle';
        setPlayState(finished ? 'replay' : 'play');
        if (finished) {
            applyAge(todayIndex);
            targetYear = todayYear;
        }
    }

    function startPlay() {
        mode = 'play';
        setPlayState('pause');
        playStart = performance.now();
        applyAge(0, { keepYear: true });
        dispYear = AGES[0].startYear;
        requestDraw();
    }

    playBtn.addEventListener('click', function () {
        if (mode === 'play') { stopPlay(false); return; }
        startPlay();
    });

    nodes.forEach(function (node, i) {
        node.addEventListener('click', function () {
            stopPlay(false);
            applyAge(i);
        });
    });

    // Keyboard on the stage: arrows step through the ages.
    stage.setAttribute('tabindex', '0');
    stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); stopPlay(false); applyAge(Math.min(active + 1, N - 1)); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); stopPlay(false); applyAge(Math.max(active - 1, 0)); }
        else if (e.key === 'Home') { e.preventDefault(); stopPlay(false); applyAge(0); }
        else if (e.key === 'End') { e.preventDefault(); stopPlay(false); applyAge(todayIndex); }
    });

    // Horizontal drag on the stage scrubs through the ages.
    var dragging = false, dragStartX = 0, dragStartIdx = 0, dragMoved = false;
    stage.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button, a')) return;
        dragging = true;
        dragMoved = false;
        dragStartX = e.clientX;
        dragStartIdx = active;
        stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - dragStartX;
        if (Math.abs(dx) > 6) dragMoved = true;
        // A quarter of the stage width sweeps one age; drag right = back in time.
        var step = Math.round(-dx / (W / 4));
        var idx = Math.min(N - 1, Math.max(0, dragStartIdx + step));
        if (idx !== active) { stopPlay(false); applyAge(idx); }
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
        stage.addEventListener(ev, function () { dragging = false; });
    });

    // ---- Animation loop ------------------------------------------
    var rafId = null, drawQueued = false;
    function requestDraw() { drawQueued = true; ensureLoop(); }

    function tick(now) {
        rafId = null;
        var dt = Math.min(0.1, (now - (lastT || now)) / 1000);
        lastT = now;
        var needMore = false;

        if (mode === 'play') {
            var p = Math.min(1, (now - playStart) / PLAY_MS);
            // Ease only the ends; the long middle stays linear so the
            // precession reads as a steady drift.
            var e = p < 0.04 ? (p * p) / 0.04 : (p > 0.96 ? 1 - ((1 - p) * (1 - p)) / 0.04 : p);
            var year = AGES[0].startYear + (todayYear - AGES[0].startYear) * e;
            dispYear = year;
            targetYear = year;
            if (lonKeys) { skyLon = lonForYear(year); targetLon = skyLon; }
            var idx = indexForYear(year);
            if (idx !== active) applyAge(idx, { keepYear: true });
            targetSunY = sunYFor(idx);
            sunY += (targetSunY - sunY) * Math.min(1, dt * 3);
            if (elFill) {
                elFill.style.width = (p * 100).toFixed(2) + '%';
            }
            if (p >= 1) stopPlay(true); else needMore = true;
        } else {
            var k = reduceMotion ? 1 : Math.min(1, dt * 3.2);
            skyLon += (targetLon - skyLon) * k;
            dispYear += (targetYear - dispYear) * (reduceMotion ? 1 : Math.min(1, dt * 4));
            sunY += (targetSunY - sunY) * k;
            if (Math.abs(targetLon - skyLon) > 0.01 || Math.abs(targetYear - dispYear) > 0.6 ||
                Math.abs(targetSunY - sunY) > 0.4) {
                needMore = true;
            } else {
                skyLon = targetLon;
                dispYear = targetYear;
                sunY = targetSunY;
            }
        }

        if (hudYear) hudYear.textContent = eraLabel(dispYear);
        root.style.setProperty('--sun-y', sunY.toFixed(1) + 'px');
        draw(now);

        // Twinkle keeps the sky alive while visible (unless reduced motion).
        if (!reduceMotion && visible && sky) needMore = true;
        drawQueued = false;
        if (needMore && visible) ensureLoop();
    }

    function ensureLoop() {
        if (rafId === null && visible) rafId = requestAnimationFrame(tick);
    }

    // Pause the loop when the stage is offscreen or the tab is hidden.
    function setVisible(v) {
        visible = v;
        if (v) { lastT = 0; ensureLoop(); }
        else if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            setVisible(entries[0].isIntersecting && !document.hidden);
        }, { threshold: 0.02 }).observe(stage);
    }
    document.addEventListener('visibilitychange', function () {
        setVisible(!document.hidden);
    });

    if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(stage);
    } else {
        window.addEventListener('resize', resize);
    }

    // Deep-link: /timeline/chronology/?age=N opens on that node.
    var startIndex = todayIndex;
    try {
        var qAge = new URLSearchParams(window.location.search).get('age');
        if (qAge !== null && !isNaN(Number(qAge))) {
            startIndex = Math.min(N - 1, Math.max(0, Number(qAge)));
        }
    } catch (e) { /* keep today */ }

    resize();
    setPlayState('play');
    applyAge(startIndex);
    dispYear = targetYear = (startIndex === todayIndex) ? todayYear : AGES[startIndex].startYear;
    skyLon = targetLon;
    sunY = targetSunY;
    ensureLoop();
})();
