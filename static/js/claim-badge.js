// Claim-badge state machine — the four-pill epistemic-status cluster.
// Loaded once via the core bundle so the behaviour is identical on every
// page that renders the cluster (wiki, articles, timeline, library, news,
// tradition hubs). No-op on pages without it. Previously this logic was
// duplicated inline in wiki-page.html and timeline-page.html and absent
// from the other four templates.
//
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

        const isExpanded = (b) =>
            b.classList.contains("claim-badge--active") ||
            b.classList.contains("claim-badge--expanded") ||
            b.matches(":hover"); // covers desktop hover preview

        const collapseInactive = (except) => {
            badges.forEach((b) => {
                if (b === except) return;
                if (!b.classList.contains("claim-badge--active")) {
                    b.classList.remove("claim-badge--expanded");
                }
                b.classList.remove("claim-badge--tooltip-open");
            });
        };

        badges.forEach((badge) => {
            badge.addEventListener("click", (e) => {
                e.stopPropagation();
                const expanded = isExpanded(badge);

                if (expanded) {
                    // Already expanded → toggle tooltip on this one,
                    // collapse and close tooltips on the others.
                    const willOpen = !badge.classList.contains(
                        "claim-badge--tooltip-open"
                    );
                    collapseInactive(badge);
                    badge.classList.toggle("claim-badge--tooltip-open", willOpen);
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

        document.addEventListener("click", (e) => {
            if (!e.target.closest(".claim-badges")) collapseInactive(null);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") collapseInactive(null);
        });
    }

    if (document.readyState !== "loading") {
        wire();
    } else {
        document.addEventListener("DOMContentLoaded", wire);
    }
})();
