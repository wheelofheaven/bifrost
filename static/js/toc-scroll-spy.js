// Table of Contents Scroll Spy
// Highlights the current section in the TOC as user scrolls

(function () {
  "use strict";

  // One entry per page type that carries a contents list. Each names the
  // page root, the nav holding the links, the region whose headings are
  // watched (the whole article, so Read Next and references highlight
  // too) and the class that marks the current entry.
  const PAGES = [
    {
      ROOT_SELECTOR: ".wiki",
      TOC_SELECTOR: ".wiki__toc-nav",
      CONTENT_SELECTOR: ".wiki__article",
      ACTIVE_CLASS: "wiki__toc-link--active",
    },
    {
      ROOT_SELECTOR: ".article",
      TOC_SELECTOR: ".article__toc-nav",
      CONTENT_SELECTOR: ".article__article",
      ACTIVE_CLASS: "article__toc-link--active",
    },
    {
      ROOT_SELECTOR: ".timeline-page",
      TOC_SELECTOR: ".timeline-page__toc-nav",
      CONTENT_SELECTOR: ".timeline-page__article",
      ACTIVE_CLASS: "timeline-page__toc-link--active",
    },
  ];

  const CONFIG = {
    // Pixels below the viewport top; a heading at or above it is "read".
    // Sits under the navbar and the 6rem scroll-margin of the headings.
    READING_LINE: 120,
    HEADING_SELECTOR: "h1[id], h2[id], h3[id], h4[id]",
  };

  class TocScrollSpy {
    constructor(page) {
      this.page = page;
      this.tocNav = document.querySelector(page.TOC_SELECTOR);
      this.contentArea = document.querySelector(page.CONTENT_SELECTOR);

      if (!this.tocNav || !this.contentArea) {
        return;
      }

      this.tocLinks = this.tocNav.querySelectorAll("a[href^='#']");
      this.headings = this.contentArea.querySelectorAll(
        CONFIG.HEADING_SELECTOR,
      );

      if (this.tocLinks.length === 0 || this.headings.length === 0) {
        return;
      }

      this.init();
    }

    init() {
      // Only headings that have an entry in the list can be current.
      this.linked = Array.from(this.headings).filter((h) =>
        this.tocNav.querySelector(`a[href="#${CSS.escape(h.id)}"]`),
      );
      this.ticking = false;
      this.onScroll = () => {
        if (this.ticking) return;
        this.ticking = true;
        requestAnimationFrame(() => {
          this.ticking = false;
          this.updateActive();
        });
      };
      window.addEventListener("scroll", this.onScroll, { passive: true });
      window.addEventListener("resize", this.onScroll);
      this.bindTocClicks();
      this.updateActive();
    }

    // The current chapter is the last linked heading above the reading
    // line, a fixed distance below the top of the viewport; before the
    // first heading reaches it, the first chapter is current. Reading
    // positions, not intersections, so short chapters and clicked
    // entries resolve the same way as long ones.
    updateActive() {
      if (this.linked.length === 0) return;
      let current = this.linked[0].id;
      for (const heading of this.linked) {
        if (heading.getBoundingClientRect().top <= CONFIG.READING_LINE) {
          current = heading.id;
        } else {
          break;
        }
      }
      // At the end of the document the last chapters can never reach the
      // reading line; once the page is scrolled out, the last one is current.
      const scrolledOut =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (scrolledOut) {
        current = this.linked[this.linked.length - 1].id;
      }
      if (current !== this.currentId) {
        this.setActiveLink(current);
      }
    }

    setActiveLink(headingId) {
      this.currentId = headingId;
      this.tocLinks.forEach((link) => {
        link.classList.remove(this.page.ACTIVE_CLASS);
      });
      const activeLink = this.tocNav.querySelector(`a[href="#${headingId}"]`);
      if (activeLink) {
        activeLink.classList.add(this.page.ACTIVE_CLASS);
        this.scrollTocToView(activeLink);
      }
    }

    scrollTocToView(activeLink) {
      const tocContainer = this.tocNav;
      const linkRect = activeLink.getBoundingClientRect();
      const containerRect = tocContainer.getBoundingClientRect();

      // Only scroll within the TOC container itself. `scrollIntoView` would
      // bubble up to the document and yank the page during normal reading
      // — especially on mobile where the TOC is in document flow rather
      // than a sticky sidebar.
      if (linkRect.top < containerRect.top || linkRect.bottom > containerRect.bottom) {
        const delta =
          (linkRect.top + linkRect.height / 2) -
          (containerRect.top + containerRect.height / 2);
        tocContainer.scrollBy({ top: delta, behavior: "smooth" });
      }
    }

    bindTocClicks() {
      // Smooth scroll when clicking TOC links
      this.tocLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const targetId = link.getAttribute("href").slice(1);
          const targetElement = document.getElementById(targetId);

          if (targetElement) {
            // Calculate offset for fixed navbar
            // Land the heading inside the observer band (which starts
            // 80px down) and on the headings' scroll-margin-top of 6rem.
            const navbarHeight = 96;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition =
              elementPosition + window.pageYOffset - navbarHeight;

            window.scrollTo({
              top: offsetPosition,
              behavior: "smooth",
            });

            // Update active state immediately
            this.setActiveLink(targetId);

            // Update URL hash without jumping
            history.pushState(null, null, `#${targetId}`);
          }
        });
      });
    }

    destroy() {
      window.removeEventListener("scroll", this.onScroll);
      window.removeEventListener("resize", this.onScroll);
    }
  }

  // Initialize when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    const page = PAGES.find((p) => document.querySelector(p.ROOT_SELECTOR));
    if (page) {
      window.tocScrollSpy = new TocScrollSpy(page);
    }
  });
})();
