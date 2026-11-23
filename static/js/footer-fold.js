/**
 * Footer link groups fold on phones.
 *
 * The footer stacks eight link lists under their headings; on a phone that
 * is more than four screens. Up to 768px each heading becomes a toggle and
 * its list starts closed (styled in sass/layout/_footer.scss under
 * .footer--folds). The project description above them is clamped to three
 * lines and opens the same way. Without this script everything stays open.
 */
(() => {
    const footer = document.querySelector(".footer");
    if (!footer) return;
    const titles = [...footer.querySelectorAll(".footer__col-title")].filter(
        (title) => title.nextElementSibling && title.nextElementSibling.tagName === "UL",
    );
    if (!titles.length) return;
    const intro = footer.querySelector(".footer__col--brand .footer__muted");

    const phone = window.matchMedia("(max-width: 768px)");

    function toggle(title) {
        title.setAttribute("aria-expanded", title.getAttribute("aria-expanded") === "true" ? "false" : "true");
    }

    function onKey(event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle(event.currentTarget);
        }
    }

    function onClick(event) {
        toggle(event.currentTarget);
    }

    function openIntro() {
        intro.classList.toggle("footer__muted--open");
    }

    function apply() {
        footer.classList.toggle("footer--folds", phone.matches);
        // The description gets no role: as a button its spoken name would
        // be the whole paragraph. The clamp is visual only, so assistive
        // technology reads the full text either way.
        if (intro) {
            if (phone.matches) intro.addEventListener("click", openIntro);
            else intro.removeEventListener("click", openIntro);
        }
        titles.forEach((title, index) => {
            if (phone.matches) {
                const list = title.nextElementSibling;
                if (!list.id) list.id = "footer-group-" + index;
                title.setAttribute("role", "button");
                title.setAttribute("tabindex", "0");
                title.setAttribute("aria-controls", list.id);
                if (!title.hasAttribute("aria-expanded")) title.setAttribute("aria-expanded", "false");
                title.addEventListener("click", onClick);
                title.addEventListener("keydown", onKey);
            } else {
                ["role", "tabindex", "aria-controls", "aria-expanded"].forEach((name) => title.removeAttribute(name));
                title.removeEventListener("click", onClick);
                title.removeEventListener("keydown", onKey);
            }
        });
    }

    apply();
    phone.addEventListener("change", apply);
})();
