// Claim-badge state machine — the four-pill epistemic-status cluster.
// Loaded once via the core bundle so the behaviour is identical on every
// page that renders the cluster (wiki, articles, timeline, library, news,
// tradition hubs). No-op on pages without it. Previously this logic was
// duplicated inline in wiki-page.html and timeline-page.html and absent
// from the other four templates.
//
//   0. The cluster renders stacked as one element (inactive letters tucked
//      behind the active badge). Hover / keyboard focus fans it out (CSS);
//      on touch the first tap adds .claim-badges--open to fan it out and a
//      further tap on a badge toggles its tooltip (no width change, so the
//      row never reflows under the finger).
//   1. Inactive badges render collapsed (one character, muted).
//   2. Hover (desktop, pure CSS) or first click (any device) expands an
//      inactive badge; siblings collapse so only one inactive is open at a
//      time alongside the always-expanded active badge.
//   3. A subsequent click on an already-expanded badge opens its tooltip.
//   4. Click outside the cluster, or Escape, collapses inactive expansions
//      and closes any open tooltip.
(function () {
    function wire() {
        const cluster = document.querySelector(".claim-badges");
        if (!cluster || cluster.dataset.badgeWired) return;
        const badges = Array.from(
            document.querySelectorAll(".claim-badges .claim-badge")
        );
        if (!badges.length) return;
        cluster.dataset.badgeWired = "1";

        // Touch browsers report a sticky emulated :hover after a tap, so the
        // hover preview only counts for real pointers.
        const canHover = window.matchMedia("(hover: hover)").matches;
        const isExpanded = (b) =>
            b.classList.contains("claim-badge--active") ||
            b.classList.contains("claim-badge--expanded") ||
            (canHover && b.matches(":hover")); // desktop hover preview

        const collapseInactive = (except) => {
            badges.forEach((b) => {
                if (b === except) return;
                if (!b.classList.contains("claim-badge--active")) {
                    b.classList.remove("claim-badge--expanded");
                }
                b.classList.remove("claim-badge--tooltip-open");
            });
        };

        // Keep an opened tooltip inside the viewport. Tooltips anchor to their
        // badge's left edge, which runs off-screen for the right-hand badges
        // on a phone; shift it left (or right) just enough, 8px margin.
        const clampTooltip = (badge) => {
            const tip = badge.querySelector(".claim-badge__tooltip");
            if (!tip) return;
            tip.style.left = "";
            requestAnimationFrame(() => {
                const r = tip.getBoundingClientRect();
                const margin = 8;
                const overRight = r.right - (window.innerWidth - margin);
                const overLeft = margin - r.left;
                if (overRight > 0) tip.style.left = -overRight + "px";
                else if (overLeft > 0) tip.style.left = overLeft + "px";
            });
        };

        badges.forEach((badge) => {
            badge.addEventListener("click", (e) => {
                e.stopPropagation();

                // The cluster renders stacked (one element). On touch, the
                // first tap only fans it out; mouse users fan it out by
                // hovering, keyboard users by focusing, so they go straight
                // to the per-badge behaviour below.
                if (
                    (e.pointerType === "touch" || !canHover) &&
                    !cluster.classList.contains("claim-badges--open")
                ) {
                    cluster.classList.add("claim-badges--open");
                    return;
                }

                // Touch, cluster already open: a tap shows that type's
                // explainer tooltip (its title names the full type) without
                // widening the pill — widening on a phone reflowed the row.
                if (e.pointerType === "touch" || !canHover) {
                    const willOpen = !badge.classList.contains(
                        "claim-badge--tooltip-open"
                    );
                    collapseInactive(badge);
                    badge.classList.toggle("claim-badge--tooltip-open", willOpen);
                    if (willOpen) clampTooltip(badge);
                    return;
                }

                const expanded = isExpanded(badge);

                if (expanded) {
                    // Already expanded → toggle tooltip on this one,
                    // collapse and close tooltips on the others.
                    const willOpen = !badge.classList.contains(
                        "claim-badge--tooltip-open"
                    );
                    collapseInactive(badge);
                    badge.classList.toggle("claim-badge--tooltip-open", willOpen);
                    if (willOpen) clampTooltip(badge);
                } else {
                    // Collapsed → expand it, collapse siblings.
                    collapseInactive(badge);
                    badge.classList.add("claim-badge--expanded");
                }
            });

            // Keyboard activation parity (Enter / Space)
            badge.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    badge.click();
                }
            });
        });

        const closeAll = () => {
            collapseInactive(null);
            cluster.classList.remove("claim-badges--open");
        };

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".claim-badges")) closeAll();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeAll();
        });
    }

    if (document.readyState !== "loading") {
        wire();
    } else {
        document.addEventListener("DOMContentLoaded", wire);
    }
})();
