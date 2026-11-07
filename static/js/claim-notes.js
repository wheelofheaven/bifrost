/**
 * Claim notes — one shared note for every inline claim marker.
 *
 * `{% claim(type=…) %}` (templates/shortcodes/claim.html) renders an
 * assertion plus a small dot button carrying its label and description in
 * data attributes. Tapping a dot opens ONE note element, created lazily and
 * reused, so a page with fifty labelled assertions still owns a single
 * glass surface (WebKit drops every backdrop-filter on the page once too
 * many exist — see `&__para-actions` in sass/pages/_library.scss).
 *
 * Phones: the note docks above the bottom edge, clear of the FAB column.
 * Wider screens: it floats under the marker, clamped to the viewport.
 */
(function () {
    'use strict';

    const CORE_RECORD = 'https://github.com/wheelofheaven/core/blob/main/model/claims/';
    let note = null;
    let current = null;

    function build() {
        note = document.createElement('div');
        note.className = 'claim-note';
        note.setAttribute('role', 'dialog');
        note.setAttribute('aria-modal', 'false');
        note.hidden = true;
        note.innerHTML =
            '<p class="claim-note__label"><span class="claim-note__dot" aria-hidden="true"></span><span class="claim-note__name"></span></p>' +
            '<p class="claim-note__desc"></p>' +
            '<p class="claim-note__links"><a class="claim-note__method"></a><a class="claim-note__record" target="_blank" rel="noopener"></a></p>';
        document.body.appendChild(note);
    }

    function place(marker) {
        if (window.matchMedia('(max-width: 600px)').matches) {
            note.style.left = '';
            note.style.top = '';
            note.classList.add('claim-note--docked');
            return;
        }
        note.classList.remove('claim-note--docked');
        const r = marker.getBoundingClientRect();
        const w = note.offsetWidth;
        const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 16));
        let top = r.bottom + 10;
        if (top + note.offsetHeight > window.innerHeight - 16) top = r.top - note.offsetHeight - 10;
        note.style.left = left + 'px';
        note.style.top = top + 'px';
    }

    function open(marker) {
        if (!note) build();
        const d = marker.dataset;
        note.className = 'claim-note claim-note--' + d.claimType;
        note.querySelector('.claim-note__name').textContent = d.claimLabel || '';
        note.querySelector('.claim-note__desc').textContent = d.claimDesc || '';
        const method = note.querySelector('.claim-note__method');
        method.href = d.claimMethod || '/method/';
        method.textContent = (d.claimMethodLabel || 'Method') + ' →';
        const record = note.querySelector('.claim-note__record');
        if (d.claimId) {
            record.href = CORE_RECORD + encodeURIComponent(d.claimId) + '.json';
            record.textContent = d.claimId + ' ↗';
            record.hidden = false;
        } else {
            record.hidden = true;
        }
        note.setAttribute('aria-label', d.claimLabel || '');
        note.hidden = false;
        place(marker);
        requestAnimationFrame(() => note.classList.add('claim-note--open'));
        if (current) current.setAttribute('aria-expanded', 'false');
        current = marker;
        marker.setAttribute('aria-expanded', 'true');
        marker.closest('.claim')?.classList.add('claim--active');
    }

    function close() {
        if (!note || note.hidden) return;
        note.classList.remove('claim-note--open');
        note.hidden = true;
        if (current) {
            current.setAttribute('aria-expanded', 'false');
            current.closest('.claim')?.classList.remove('claim--active');
            current = null;
        }
    }

    document.addEventListener('click', (e) => {
        const marker = e.target.closest && e.target.closest('.claim__marker');
        if (marker) {
            e.preventDefault();
            if (current === marker) close(); else open(marker);
            return;
        }
        if (note && !note.hidden && !note.contains(e.target)) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && current) {
            const m = current;
            close();
            m.focus();
        }
    });
    window.addEventListener('scroll', () => {
        if (current && !note.classList.contains('claim-note--docked')) close();
    }, { passive: true });
})();
