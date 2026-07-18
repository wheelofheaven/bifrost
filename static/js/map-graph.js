(function () {
    "use strict";

    // Graph mode for the interactive map page. Fetches the static CC0
    // content-graph dataset (regenerated on api deploys, never at www
    // build time), lays it out with a deterministic force simulation,
    // and renders it as an SVG constellation. Mode switching itself
    // lives in map-native.js, which dispatches "map:modechange" and
    // "map:zoom" on the map root.

    const root = document.querySelector("[data-map-root]");
    const container = document.getElementById("map-graph");
    if (!root || !container) return;

    const svg = container.querySelector(".map-graph__canvas");
    const seeAlsoPath = container.querySelector(".map-graph__edge-batch--see-also");
    const inBodyPath = container.querySelector(".map-graph__edge-batch--in-body");
    const activeEdgesGroup = container.querySelector(".map-graph__edges-active");
    const nodesGroup = container.querySelector(".map-graph__nodes");
    const labelsGroup = container.querySelector(".map-graph__labels");
    const loadingEl = container.querySelector(".map-graph__status-loading");
    const errorEl = container.querySelector(".map-graph__status-error");
    const retryBtn = container.querySelector(".map-graph__retry");
    const legend = document.querySelector(".map-graph-legend");
    const card = document.getElementById("map-graph-card");
    const cardTitle = card ? card.querySelector(".map-graph-card__title") : null;
    const cardMeta = card ? card.querySelector(".map-graph-card__meta") : null;
    const announceEl = document.getElementById("map-graph-announce");

    const SVGNS = "http://www.w3.org/2000/svg";
    const VIEW = 2000;
    const PAD = 100;
    const MAJOR_LABELS = 14;
    const LABELS_ALL_ZOOM = 1.5;

    let state = null;
    let loading = false;
    const hiddenSections = new Set();
    let activeId = null;

    // --- deterministic seeding -----------------------------------------

    function fnv1a(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // --- data loading ---------------------------------------------------

    function setStatus(mode) {
        if (loadingEl) loadingEl.hidden = mode !== "loading";
        if (errorEl) errorEl.hidden = mode !== "error";
        if (retryBtn) retryBtn.hidden = mode !== "error";
    }

    function loadGraph() {
        if (loading || state) return;
        loading = true;
        setStatus("loading");

        fetch(container.dataset.graphSrc)
            .then((response) => {
                if (!response.ok) throw new Error("HTTP " + response.status);
                return response.json();
            })
            .then((data) => {
                loading = false;
                setStatus("none");
                build(data);
            })
            .catch(() => {
                loading = false;
                setStatus("error");
            });
    }

    // --- graph model ----------------------------------------------------

    function sectionOf(id) {
        return id.slice(0, id.indexOf("/"));
    }

    function build(data) {
        const nodes = (data.nodes || []).slice();
        const index = new Map();
        nodes.forEach((node) => index.set(node.id, node));

        // Collapse directed edges into unique undirected pairs. A pair
        // carrying both types keeps see_also as its display tier.
        const pairs = new Map();
        const adjacency = new Map();
        nodes.forEach((node) => adjacency.set(node.id, new Set()));

        (data.edges || []).forEach((edge) => {
            if (!index.has(edge.source) || !index.has(edge.target)) return;
            const key = edge.source < edge.target
                ? edge.source + "|" + edge.target
                : edge.target + "|" + edge.source;
            const existing = pairs.get(key);
            if (!existing) {
                pairs.set(key, { a: edge.source, b: edge.target, type: edge.type });
            } else if (edge.type === "see_also") {
                existing.type = "see_also";
            }
            adjacency.get(edge.source).add(edge.target);
            adjacency.get(edge.target).add(edge.source);
        });

        const pairList = Array.from(pairs.values());
        const positions = computeLayout(nodes, pairList);

        state = { nodes, index, adjacency, pairs: pairList, positions };
        render();
    }

    // --- deterministic force layout --------------------------------------

    function computeLayout(nodes, pairs) {
        const count = nodes.length;
        const xs = new Float64Array(count);
        const ys = new Float64Array(count);
        const dxs = new Float64Array(count);
        const dys = new Float64Array(count);
        const slot = new Map();

        nodes.forEach((node, i) => {
            slot.set(node.id, i);
            const rand = mulberry32(fnv1a(node.id));
            const angle = rand() * Math.PI * 2;
            const radius = 120 + rand() * 680;
            xs[i] = Math.cos(angle) * radius;
            ys[i] = Math.sin(angle) * radius;
        });

        const REPULSION = 30000;
        const SPRING = 0.02;
        const CENTERING = 0.0045;
        const ITERATIONS = 300;

        for (let iter = 0; iter < ITERATIONS; iter++) {
            const temp = 1 - iter / ITERATIONS;
            const maxStep = 6 + 54 * temp;
            dxs.fill(0);
            dys.fill(0);

            for (let i = 0; i < count; i++) {
                for (let j = i + 1; j < count; j++) {
                    let dx = xs[i] - xs[j];
                    let dy = ys[i] - ys[j];
                    let d2 = dx * dx + dy * dy;
                    if (d2 < 0.01) {
                        // Deterministic tie-break for coincident points.
                        dx = ((i * 31 + j * 17) % 13) - 6;
                        dy = ((i * 17 + j * 31) % 13) - 6;
                        d2 = dx * dx + dy * dy + 1;
                    }
                    const force = REPULSION / d2;
                    const dist = Math.sqrt(d2);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    dxs[i] += fx;
                    dys[i] += fy;
                    dxs[j] -= fx;
                    dys[j] -= fy;
                }
            }

            pairs.forEach((pair) => {
                const i = slot.get(pair.a);
                const j = slot.get(pair.b);
                const dx = xs[j] - xs[i];
                const dy = ys[j] - ys[i];
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const rest = pair.type === "see_also" ? 140 : 190;
                const force = (dist - rest) * SPRING;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                dxs[i] += fx;
                dys[i] += fy;
                dxs[j] -= fx;
                dys[j] -= fy;
            });

            for (let i = 0; i < count; i++) {
                dxs[i] -= xs[i] * CENTERING;
                dys[i] -= ys[i] * CENTERING;

                const step = Math.sqrt(dxs[i] * dxs[i] + dys[i] * dys[i]);
                if (step > maxStep) {
                    dxs[i] *= maxStep / step;
                    dys[i] *= maxStep / step;
                }
                xs[i] += dxs[i];
                ys[i] += dys[i];
            }
        }

        // Rescale into the viewBox, preserving aspect. Use a trimmed
        // bounding box (4th–96th percentile) so a handful of orphan
        // outliers can't compress the main cluster, then clamp the
        // outliers themselves to the padded frame.
        const sortedX = Array.from(xs).sort((a, b) => a - b);
        const sortedY = Array.from(ys).sort((a, b) => a - b);
        const lo = Math.floor((count - 1) * 0.04);
        const hi = Math.ceil((count - 1) * 0.96);
        const minX = sortedX[lo];
        const maxX = sortedX[hi];
        const minY = sortedY[lo];
        const maxY = sortedY[hi];
        const span = Math.max(maxX - minX, maxY - minY) || 1;
        const scale = (VIEW - 2 * PAD) / span;
        const offsetX = PAD + ((VIEW - 2 * PAD) - (maxX - minX) * scale) / 2;
        const offsetY = PAD + ((VIEW - 2 * PAD) - (maxY - minY) * scale) / 2;

        const positions = new Map();
        nodes.forEach((node, i) => {
            const x = Math.max(PAD, Math.min(VIEW - PAD, offsetX + (xs[i] - minX) * scale));
            const y = Math.max(PAD, Math.min(VIEW - PAD, offsetY + (ys[i] - minY) * scale));
            positions.set(node.id, {
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
            });
        });
        return positions;
    }

    // --- rendering --------------------------------------------------------

    function radiusOf(node) {
        const total = node.degree && node.degree.total ? node.degree.total : 0;
        return Math.max(4, Math.min(14, 3 + 1.4 * Math.sqrt(total)));
    }

    function pagePath(node) {
        return "/" + node.section + "/" + node.slug + "/";
    }

    function legendText(selector) {
        const el = legend ? legend.querySelector(selector) : null;
        return el ? el.textContent.trim() : "";
    }

    function sectionName(section) {
        return legendText('[data-graph-section-name="' + section + '"]') || section;
    }

    function claimName(claim) {
        return legendText('[data-graph-claim-name="' + (claim || "unset") + '"]') || claim;
    }

    function truncate(text, max) {
        return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
    }

    const nodeEls = new Map();
    const labelEls = new Map();

    function render() {
        const sorted = state.nodes.slice().sort((a, b) => {
            const diff = (b.degree.total || 0) - (a.degree.total || 0);
            if (diff) return diff;
            return a.id < b.id ? -1 : 1;
        });

        const nodeFrag = document.createDocumentFragment();
        const labelFrag = document.createDocumentFragment();

        // Greedy label placement: walk hubs in degree order and only
        // grant an at-rest label when it doesn't collide with one
        // already placed. Estimated glyph width ≈ 9.5 viewBox units at
        // font-size 20.
        const placedLabels = [];
        function grantLabel(text, x, y, rank) {
            if (placedLabels.length >= MAJOR_LABELS || rank >= 40) return false;
            const w = Math.min(text.length, 30) * 9.5;
            const collides = placedLabels.some((p) => {
                return Math.abs(p.x - x) < (p.w + w) / 2 + 14 && Math.abs(p.y - y) < 42;
            });
            if (collides) return false;
            placedLabels.push({ x, y, w });
            return true;
        }

        sorted.forEach((node, rank) => {
            const pos = state.positions.get(node.id);
            const r = radiusOf(node);

            const link = document.createElementNS(SVGNS, "a");
            const claimClass = node.claim_type ? "is-claim-" + node.claim_type : "is-claim-unset";
            link.setAttribute("class", "map-graph-node map-graph-node--" + node.section + " " + claimClass);
            link.setAttribute("href", pagePath(node));
            link.setAttribute("transform", "translate(" + pos.x + " " + pos.y + ")");
            link.setAttribute("aria-label", node.title + " — " + sectionName(node.section));
            link.dataset.graphId = node.id;

            const titleEl = document.createElementNS(SVGNS, "title");
            titleEl.textContent = node.title;
            link.appendChild(titleEl);

            const circle = document.createElementNS(SVGNS, "circle");
            circle.setAttribute("r", r);
            link.appendChild(circle);

            nodeFrag.appendChild(link);
            nodeEls.set(node.id, link);

            const labelText = truncate(node.title, 30);
            const labelY = pos.y + r + 20;
            const major = grantLabel(labelText, pos.x, labelY, rank);
            const label = document.createElementNS(SVGNS, "text");
            label.setAttribute("class", "map-graph__label" + (major ? " map-graph__label--major" : ""));
            label.setAttribute("x", pos.x);
            label.setAttribute("y", labelY);
            label.textContent = labelText;
            label.dataset.graphId = node.id;
            labelFrag.appendChild(label);
            labelEls.set(node.id, label);
        });

        nodesGroup.replaceChildren(nodeFrag);
        labelsGroup.replaceChildren(labelFrag);
        rebuildEdgePaths();
        renderLegendCounts();
    }

    function rebuildEdgePaths() {
        const seeAlso = [];
        const inBody = [];
        state.pairs.forEach((pair) => {
            if (hiddenSections.has(sectionOf(pair.a)) || hiddenSections.has(sectionOf(pair.b))) return;
            const pa = state.positions.get(pair.a);
            const pb = state.positions.get(pair.b);
            const segment = "M" + pa.x + " " + pa.y + "L" + pb.x + " " + pb.y;
            if (pair.type === "see_also") seeAlso.push(segment);
            else inBody.push(segment);
        });
        seeAlsoPath.setAttribute("d", seeAlso.join(""));
        inBodyPath.setAttribute("d", inBody.join(""));
    }

    function renderLegendCounts() {
        if (!legend) return;
        const counts = {};
        state.nodes.forEach((node) => {
            counts[node.section] = (counts[node.section] || 0) + 1;
        });
        legend.querySelectorAll("[data-graph-count]").forEach((el) => {
            el.textContent = counts[el.dataset.graphCount] || 0;
        });
    }

    // --- ego highlighting ---------------------------------------------------

    function setActive(id) {
        if (activeId === id) return;
        clearActive();
        const node = state.index.get(id);
        if (!node || hiddenSections.has(node.section)) return;

        activeId = id;
        svg.classList.add("is-dimmed");

        const el = nodeEls.get(id);
        const label = labelEls.get(id);
        if (el) el.classList.add("is-active");
        if (label) label.classList.add("is-active");

        const edgeFrag = document.createDocumentFragment();
        const origin = state.positions.get(id);
        state.adjacency.get(id).forEach((neighborId) => {
            const neighbor = state.index.get(neighborId);
            if (!neighbor || hiddenSections.has(neighbor.section)) return;
            const neighborEl = nodeEls.get(neighborId);
            const neighborLabel = labelEls.get(neighborId);
            if (neighborEl) neighborEl.classList.add("is-related");
            if (neighborLabel) neighborLabel.classList.add("is-related");

            const pos = state.positions.get(neighborId);
            const line = document.createElementNS(SVGNS, "line");
            line.setAttribute("class", "map-graph__edge-active");
            line.setAttribute("x1", origin.x);
            line.setAttribute("y1", origin.y);
            line.setAttribute("x2", pos.x);
            line.setAttribute("y2", pos.y);
            edgeFrag.appendChild(line);
        });
        activeEdgesGroup.replaceChildren(edgeFrag);

        if (card && cardTitle && cardMeta) {
            cardTitle.textContent = node.title;
            const meta = [sectionName(node.section), claimName(node.claim_type)];
            if (node.category) meta.push(node.category);
            const linksLabel = legend ? legend.dataset.labelLinks : "";
            meta.push(node.degree.total + (linksLabel ? " " + linksLabel : ""));
            cardMeta.textContent = meta.join(" · ");
            card.hidden = false;
        }
    }

    function clearActive() {
        if (activeId === null) return;
        activeId = null;
        svg.classList.remove("is-dimmed");
        activeEdgesGroup.replaceChildren();
        nodesGroup.querySelectorAll(".is-active, .is-related").forEach((el) => {
            el.classList.remove("is-active", "is-related");
        });
        labelsGroup.querySelectorAll(".is-active, .is-related").forEach((el) => {
            el.classList.remove("is-active", "is-related");
        });
        if (card) card.hidden = true;
    }

    nodesGroup.addEventListener("pointerover", (event) => {
        const link = event.target.closest("a[data-graph-id]");
        if (link) setActive(link.dataset.graphId);
    });

    nodesGroup.addEventListener("pointerout", (event) => {
        const link = event.target.closest("a[data-graph-id]");
        if (!link) return;
        const next = event.relatedTarget ? event.relatedTarget.closest && event.relatedTarget.closest("a[data-graph-id]") : null;
        if (!next && !link.matches(":focus-within")) clearActive();
    });

    nodesGroup.addEventListener("focusin", (event) => {
        const link = event.target.closest("a[data-graph-id]");
        if (link) setActive(link.dataset.graphId);
    });

    nodesGroup.addEventListener("focusout", (event) => {
        const next = event.relatedTarget ? event.relatedTarget.closest && event.relatedTarget.closest("a[data-graph-id]") : null;
        if (!next) clearActive();
    });

    container.addEventListener("keydown", (event) => {
        if (event.key === "Escape") clearActive();
    });

    // --- legend filters -------------------------------------------------------

    function toggleSection(section, button) {
        const nowHidden = !hiddenSections.has(section);
        if (nowHidden) hiddenSections.add(section);
        else hiddenSections.delete(section);

        button.setAttribute("aria-pressed", nowHidden ? "false" : "true");

        nodeEls.forEach((el, id) => {
            if (sectionOf(id) === section) el.classList.toggle("is-filtered", nowHidden);
        });
        labelEls.forEach((el, id) => {
            if (sectionOf(id) === section) el.classList.toggle("is-filtered", nowHidden);
        });
        rebuildEdgePaths();

        if (activeId && hiddenSections.has(sectionOf(activeId))) clearActive();

        if (announceEl && legend) {
            const stateLabel = nowHidden ? legend.dataset.labelHidden : legend.dataset.labelShown;
            announceEl.textContent = sectionName(section) + " — " + stateLabel;
        }
    }

    if (legend) {
        legend.querySelectorAll("[data-graph-filter]").forEach((button) => {
            button.addEventListener("click", () => {
                if (!state) return;
                toggleSection(button.dataset.graphFilter, button);
            });
        });
    }

    if (retryBtn) retryBtn.addEventListener("click", loadGraph);

    // --- drag-to-pan ------------------------------------------------------------
    // Grab the background and drag to move the canvas. Reuses the stage's
    // native scroll (same surface the zoom buttons pan), so it composes
    // with zoom for free. A small movement threshold separates a pan from
    // a click, so tapping a node still navigates. Touch is left to native
    // momentum scrolling.

    const stage = document.getElementById("map-stage");
    const PAN_THRESHOLD = 4;
    let panning = false;
    let panMoved = false;
    let suppressClick = false;
    let panPointerId = null;
    let panStartX = 0;
    let panStartY = 0;
    let panScrollLeft = 0;
    let panScrollTop = 0;

    container.addEventListener("dragstart", (event) => event.preventDefault());

    container.addEventListener("pointerdown", (event) => {
        if (!stage || event.button !== 0 || event.pointerType === "touch") return;
        panning = true;
        panMoved = false;
        panPointerId = event.pointerId;
        panStartX = event.clientX;
        panStartY = event.clientY;
        panScrollLeft = stage.scrollLeft;
        panScrollTop = stage.scrollTop;
    });

    container.addEventListener("pointermove", (event) => {
        if (!panning || event.pointerId !== panPointerId) return;
        const dx = event.clientX - panStartX;
        const dy = event.clientY - panStartY;
        if (!panMoved) {
            if (Math.abs(dx) < PAN_THRESHOLD && Math.abs(dy) < PAN_THRESHOLD) return;
            panMoved = true;
            container.classList.add("is-grabbing");
            clearActive();
            try {
                container.setPointerCapture(panPointerId);
            } catch (e) {
                /* capture unavailable */
            }
        }
        stage.scrollLeft = panScrollLeft - dx;
        stage.scrollTop = panScrollTop - dy;
        event.preventDefault();
    });

    function endPan(event) {
        if (!panning || (event && event.pointerId !== panPointerId)) return;
        panning = false;
        container.classList.remove("is-grabbing");
        try {
            container.releasePointerCapture(panPointerId);
        } catch (e) {
            /* capture unavailable */
        }
        if (panMoved) {
            // Swallow the click the browser fires after a drag so a pan
            // that ends on a node doesn't also open it. Cleared on the
            // next tick, after that synthetic click, so keyboard
            // activation later is unaffected.
            suppressClick = true;
            window.setTimeout(() => {
                suppressClick = false;
            }, 0);
        }
        panMoved = false;
        panPointerId = null;
    }

    container.addEventListener("pointerup", endPan);
    container.addEventListener("pointercancel", endPan);

    container.addEventListener("click", (event) => {
        if (suppressClick) {
            event.preventDefault();
            event.stopPropagation();
            suppressClick = false;
        }
    }, true);

    // --- mode + zoom wiring -----------------------------------------------------

    root.addEventListener("map:modechange", (event) => {
        if (event.detail && event.detail.graph) loadGraph();
        else clearActive();
    });

    root.addEventListener("map:zoom", (event) => {
        const level = event.detail && event.detail.level ? event.detail.level : 1;
        container.classList.toggle("is-labels-all", level >= LABELS_ALL_ZOOM);
    });

    // map-native.js runs first (earlier script tag) and may have already
    // restored graph mode from ?view=graph or localStorage before this
    // module attached its listener.
    if (root.classList.contains("is-graph")) loadGraph();
})();
