/**
 * Floating buttons step aside while the reader scrolls down.
 *
 * The search, back-to-top and reader buttons sit over the text's right
 * edge and cover the ends of lines. While the page is moving down they are
 * hidden (body.fabs-tucked, styled in sass/components/_fab-tuck.scss); any
 * scroll back up brings them back, and they always show near the top and
 * the bottom of the page, where there is nothing to cover.
 */
(() => {
    if (!document.querySelector(".search-fab, .to-top, .reader-fab")) return;

    const THRESHOLD = 24;
    let last = window.scrollY;
    let down = 0;
    let up = 0;
    let queued = false;

    function set(tucked) {
        document.body.classList.toggle("fabs-tucked", tucked);
    }

    function update() {
        queued = false;
        const y = window.scrollY;
        const end = document.documentElement.scrollHeight - window.innerHeight;
        if (y > last) {
            down += y - last;
            up = 0;
        } else if (y < last) {
            up += last - y;
            down = 0;
        }
        last = y;
        if (y < 400 || y > end - 240) set(false);
        else if (down > THRESHOLD) set(true);
        else if (up > THRESHOLD) set(false);
    }

    window.addEventListener("scroll", () => {
        if (!queued) {
            queued = true;
            requestAnimationFrame(update);
        }
    }, { passive: true });

    // Keyboard focus landing on a hidden button brings them all back.
    document.addEventListener("focusin", (event) => {
        if (event.target.closest && event.target.closest(".search-fab, .to-top, .reader-fab")) set(false);
    });
})();
