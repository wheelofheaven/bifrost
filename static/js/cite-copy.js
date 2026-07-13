// Cite widget: copy-to-clipboard for the .cite__copy buttons (H1.3).
// Loaded once via the core bundle; no-op on pages without a cite widget.
(function () {
    function wire() {
        document.querySelectorAll(".cite__copy").forEach(function (btn) {
            if (btn.dataset.citeWired) return;
            btn.dataset.citeWired = "1";
            btn.addEventListener("click", function () {
                var pre = btn.closest(".cite__format").querySelector(".cite__text");
                if (!navigator.clipboard || !pre) return;
                navigator.clipboard.writeText(pre.textContent).then(function () {
                    var original = btn.textContent;
                    btn.textContent = "Copied";
                    btn.classList.add("cite__copy--done");
                    setTimeout(function () {
                        btn.textContent = original;
                        btn.classList.remove("cite__copy--done");
                    }, 1500);
                });
            });
        });
    }
    if (document.readyState !== "loading") {
        wire();
    } else {
        document.addEventListener("DOMContentLoaded", wire);
    }
})();
