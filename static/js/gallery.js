/*
 * Gallery page — category filter + lightbox.
 * Reads everything from the tile data attributes rendered by gallery.html,
 * so there's no second data source to keep in sync.
 */
(function () {
  "use strict";
  var root = document.querySelector("[data-gallery]");
  if (!root) return;

  // ---- Category filter ----------------------------------------------------
  var chips = Array.prototype.slice.call(root.querySelectorAll(".gallery__chip"));
  var items = Array.prototype.slice.call(root.querySelectorAll(".gallery__item"));

  function applyFilter(cat) {
    items.forEach(function (li) {
      var show = cat === "all" || li.getAttribute("data-category") === cat;
      li.hidden = !show;
    });
    chips.forEach(function (c) {
      var active = c.getAttribute("data-filter") === cat;
      c.classList.toggle("is-active", active);
      c.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      applyFilter(chip.getAttribute("data-filter"));
    });
  });

  // ---- Lightbox -----------------------------------------------------------
  var lb = document.getElementById("galleryLightbox");
  var lbAvif = document.getElementById("galleryLbAvif");
  var lbWebp = document.getElementById("galleryLbWebp");
  var lbImg = document.getElementById("galleryLbImg");
  var lbCaption = document.getElementById("galleryLbTitle");
  var lbUsed = document.getElementById("galleryLbUsed");
  var lastFocus = null;

  function openLightbox(tile) {
    if (!lb) return;
    lastFocus = tile;
    // Cinematic renders are jpg-only (no avif/webp full), so drop the empty
    // <source>s and let the <img> fallback (data-full-src) carry them.
    var fullAvif = tile.getAttribute("data-full") || "";
    var fullWebp = tile.getAttribute("data-full-webp") || "";
    var fullSrc = tile.getAttribute("data-full-src") || fullWebp;
    if (fullAvif) { lbAvif.setAttribute("srcset", fullAvif); } else { lbAvif.removeAttribute("srcset"); }
    if (fullWebp) { lbWebp.setAttribute("srcset", fullWebp); } else { lbWebp.removeAttribute("srcset"); }
    lbImg.setAttribute("src", fullSrc);
    lbImg.setAttribute("alt", tile.getAttribute("data-alt") || "");

    var caption = tile.getAttribute("data-caption") || "";
    lbCaption.textContent = caption;
    lbCaption.hidden = !caption;

    // "Appears on" links.
    var used = [];
    try { used = JSON.parse(tile.getAttribute("data-used") || "[]"); } catch (_) {}
    lbUsed.innerHTML = "";
    if (used.length) {
      var label = document.createElement("span");
      label.className = "gallery__lightbox-used-label";
      label.textContent = used.length === 1 ? "Appears on" : "Appears on " + used.length + " pages";
      lbUsed.appendChild(label);
      var wrap = document.createElement("span");
      wrap.className = "gallery__lightbox-used-links";
      used.forEach(function (u) {
        var a = document.createElement("a");
        a.href = u.url;
        a.textContent = u.title;
        wrap.appendChild(a);
      });
      lbUsed.appendChild(wrap);
    } else {
      var none = document.createElement("span");
      none.className = "gallery__lightbox-used-label gallery__lightbox-used-label--none";
      none.textContent = "Not yet used on any page";
      lbUsed.appendChild(none);
    }

    lb.hidden = false;
    document.body.classList.add("gallery-lightbox-open");
    requestAnimationFrame(function () { lb.classList.add("is-open"); });
  }

  function closeLightbox() {
    if (!lb || lb.hidden) return;
    lb.classList.remove("is-open");
    document.body.classList.remove("gallery-lightbox-open");
    window.setTimeout(function () { lb.hidden = true; }, 200);
    if (lastFocus) lastFocus.focus();
  }

  root.querySelectorAll(".gallery__tile").forEach(function (tile) {
    tile.addEventListener("click", function () { openLightbox(tile); });
  });

  if (lb) {
    lb.querySelectorAll("[data-lb-close]").forEach(function (el) {
      el.addEventListener("click", closeLightbox);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !lb.hidden) closeLightbox();
    });
  }
})();
