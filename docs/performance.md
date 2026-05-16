# Performance — dev-facing notes

This document is the source of truth for how the bifrost theme keeps
www.wheelofheaven.io fast. It's a running log of the traps the site has
actually hit, the architecture choices made in response, and the
checklist to run before believing a regression is real.

Performance work on this site is unusually load-bearing for two
reasons:

- The hero is a video-driven landing page. Naïve playback shifts the
  LCP element from the static poster (~2s on simulated mobile) to the
  first decoded video frame (~7s+).
- Content is multilingual and long-form. Without intervention Zola's
  search index dumps every rendered body into one JSON file. The
  English index alone reached **64 MB** before truncation.

Both of those are invisible if you only look at "page weight" in the
Network tab. Both have killed Lighthouse mobile scores from ≥70 to
<50 in a single deploy.

## Targets

Mobile Lighthouse (Lantern simulation, 4× CPU throttle, no input
simulation):

| Metric | Target |
|---|---|
| Performance | ≥ 70 |
| Accessibility | 100 |
| Best Practices | ≥ 95 |
| SEO | 100 |
| LCP | < 2.5 s |
| TBT | < 200 ms |
| CLS | < 0.1 |

Treat these as the floor for a green deploy, not the goal. Localhost
runs are noisy (see "Measuring locally" below) — the production score
on a freshly-purged CDN is what counts.

## The build pipeline

CI (`.github/workflows/deploy.yml`) runs five steps in order:

1. `npm ci` — install bifrost devDependencies (esbuild, purgecss).
2. `npm run bundle` — esbuild rolls the navbar, search, reading-list,
   PWA, ToC, and to-top modules into two artifacts:
   - `static/js/dist/core.bundle.js` — defer-loaded on every page
   - `static/js/dist/search.bundle.js` — lazy-loaded on user intent
3. `zola build` — generates `public/`.
4. `npm run purgecss` — trims `main.css` + `critical.css` against the
   built HTML. **`fontFace: false`** (see "Font-face purge trap" below).
5. `npm run inline-critical` — inlines `critical.css` into every HTML
   `<head>` and rewrites the `main.css` link into a non-blocking
   preload + `<noscript>` fallback. Appends `?v=<sha>` to the URL when
   `BUILD_VERSION` is set in the environment.

Local dev (`zola serve`) skips PurgeCSS and inline-critical — those
post-process the built `public/` tree, which `zola serve` doesn't
produce.

## The cache-bust contract

GitHub Pages is fronted by Cloudflare with a 7-day TTL on
`main.css`. Without intervention, deploying CSS changes means up to
a week of HTML referencing the *new* main.css URL while Cloudflare
serves the *old* file. We hit this exactly once during the citation-
serif rollout — local Lighthouse looked correct, prod looked
unchanged for 6+ hours.

The fix is in `scripts/inline-critical.js`:

```js
const BUILD_VERSION = (process.env.BUILD_VERSION || '').trim();

function bustUrl(href) {
    if (!BUILD_VERSION) return href;
    return href.includes('?')
        ? `${href}&v=${BUILD_VERSION}`
        : `${href}?v=${BUILD_VERSION}`;
}
```

`.github/workflows/deploy.yml` passes `BUILD_VERSION: ${{ github.sha }}`
into the inline-critical step. Every deploy ships HTML that references
`main.css?v=<commit-sha>`. Cloudflare has never cached that URL, so
the first request after a deploy bypasses the edge and pulls fresh
CSS from origin.

This **does not** bust the HTML itself. If HTML changes structure
or moves classes around, the stale Cloudflare HTML can still mismatch
the fresh CSS for the duration of the HTML cache. In practice
Cloudflare's default HTML TTL is short (minutes, governed by GitHub
Pages headers) and varnish-style hops drain within ~10 min. If you
ship a structural HTML change that breaks against the old CSS, you
must purge HTML manually.

Bundle URLs (`?v=N` in `templates/partials/scripts.html` and
`static/js/search-loader.js`) follow the same logic but are bumped
**manually** when the bundles change in a way that would mismatch
old HTML. Bump both together. The current version is `?v=3`.

## Known LCP traps

These are the patterns the site has actually been bitten by. Treat
each as a load-bearing invariant — breaking any of them costs ~10–20
points of Performance.

### Landing video play() can usurp the LCP candidate

The §1 hero section uses `<video preload="none" poster="...">`. With
`preload="none"` and no `autoplay`, the browser paints the poster as
the LCP candidate (~1.5–2s on Lantern mobile).

The moment `video.play()` is called, the browser starts decoding the
WebM. The first decoded frame becomes a **new** LCP candidate at
~6–8s — even though the poster has been visually stable for seconds.
Lighthouse measures the worst LCP and the score craters.

The mitigation lives in `templates/index.html` (in the deferred
landing-init IIFE):

```js
let userEngaged = false;

// IO callback drives visual state on every load…
setActiveVisual(idx);
// …but defers playback until first user input.
if (userEngaged) setActiveVideo(idx);

const userEvents = [
    'scroll', 'click', 'keydown',
    'touchstart', 'pointerdown',
    'wheel', 'mousemove',
];
const onEngage = () => {
    if (userEngaged) return;
    userEngaged = true;
    userEvents.forEach((e) => document.removeEventListener(e, onEngage, true));
    const visible = document.querySelector('.landing-section.is-active');
    if (visible) setActiveVideo(visible.getAttribute('data-section'));
};
userEvents.forEach((e) => document.addEventListener(e, onEngage, {
    passive: true, capture: true, once: false,
}));
```

Real visitors trigger one of these events within ~100–500 ms of
arrival — perceived as autoplay. Lighthouse's audit mode doesn't
simulate any input, so playback never fires and the poster remains
the LCP candidate.

§1's `is-active` class and dot 1's `--active` class are set
**server-side**, so first paint already shows the correct visual
state without any JS work. Don't move that into JS — it's what lets
the engagement gate be tolerable.

### Search index can balloon to 64 MB

Zola's `[search]` block builds `search_index.<lang>.json` for Fuse.
By default it dumps the **entire rendered body** of every page into
each record. On this site that meant:

- English index: ~64 MB raw, ~6 MB gzipped
- Each translation: similar order of magnitude

The previous `static/js/search.js` had an opportunistic prefetch:

```js
if ("requestIdleCallback" in window) {
    requestIdleCallback(() => initSearch(), { timeout: 4000 });
}
```

Lighthouse's headless browser fires `requestIdleCallback` within
**~1s of paint**. Every audit pulled the full 64 MB on the main
thread. LCP and TBT both went red.

The fix is two-part:

1. **`config.toml`** caps each record's body at 2000 chars
   (~400 words — title + first 2–3 paragraphs):

   ```toml
   [search]
   index_format = "fuse_json"
   truncate_content_length = 2000
   ```

   This brings the English index from 64 MB → ~2.4 MB raw
   (~830 KB gz). The trade-off: long phrase matches buried deep
   inside articles degrade. The alternative was an unusable index.

2. **`static/js/search.js`** no longer prefetches the index at
   idle. It's loaded only on real user intent — focus / click /
   typing / ⌘+/ trigger `initSearch()` through the existing event
   handlers. First search waits ~1–2s on mobile (acceptable);
   subsequent are instant.

   `static/js/search-loader.js` still rIC-prefetches the
   `search.bundle.js` itself (small, no index fetch on load). That's
   fine and worth keeping.

If you ever revive an idle/early prefetch path, **also** verify the
index size at build time. A regex grep over `public/search_index.*.json`
in CI would catch a regression here cheaply.

### PurgeCSS silently strips @font-face declarations referenced via CSS variables

PurgeCSS's `fontFace: true` (its default in v5+) scans the built
HTML for `font-family: <name>` declarations and drops any
`@font-face` whose family name doesn't appear.

The font system in this theme exposes families through CSS custom
properties (`--font-family-citation`, `--font-family-mono`, etc.)
and components consume them as `font-family: var(--font-family-X)`.
PurgeCSS can't see through the variable indirection. It assumes the
declared families are unused and drops the `@font-face` for them.

After the citation-serif rollout, the "IBM Plex Serif" `@font-face`
count in the purged CSS silently went from 6 → 1. Reader prose fell
back to system serif and looked wrong; symptoms were "the font is
not loading" rather than "PurgeCSS is wrong," which made it hard
to find.

`scripts/purgecss.js` now sets:

```js
fontFace: false,
```

with a comment explaining why. The bytes saved by pruning `@font-face`
don't justify the fragility — we curate the `@font-face` set
deliberately in `sass/base/_fonts.scss`. If you ever flip this back
on, you must also stop using CSS variables for `font-family` (or
build an allowlist that mirrors the variable map), and you must
regression-test every layer-1/2/3/4 surface on a freshly purged
build.

## Console-warning patterns

These are quieter than LCP regressions but show up in DevTools and
ding Lighthouse Best Practices. The patterns recur because the
fixes are non-obvious — capturing them here so a future contributor
doesn't re-introduce them.

### will-change budget on full-viewport layers

Firefox (and to a lesser extent Chromium) caps total `will-change`
surface area at **3× the document viewport** — roughly 1.3M px² on a
typical mobile profile. When the total of all `will-change` elements
exceeds the budget, the browser logs:

> Will-change memory consumption is too high. Budget limit is the
> document surface area multiplied by 3. Occurrences of will-change
> over the budget will be ignored.

…and **ignores every `will-change` on the page**. Not just the
overflow.

The landing page used to put `will-change: opacity` on each
`.landing-section__media` — five elements, each `position: fixed;
inset: 0;`, so each one was a full viewport. Five viewports × ~288K
px² = 1.44M, over budget. The hint was already being ignored, but
the cost in memory + the warning persisted.

Rules:

- Don't put `will-change` on `position: fixed` elements that span
  the whole viewport. Modern browsers auto-composite opacity
  transitions on those — the hint is redundant.
- If you must use `will-change` on a large element, **scope it
  with a state class** so only the active instance carries the
  hint (e.g. `.foo.is-animating { will-change: transform; }`),
  not every instance.
- Audit periodically: `grep -rn will-change sass/` and check
  whether each consumer is small + transient. If it's
  full-viewport + permanent, it's wrong.

### `<link rel="preload">` CORS mismatch

Preload + consumer must agree on CORS state. The `<video poster>`
fetch is no-CORS (no Origin header sent); a `<link rel="preload"
as="image" crossorigin>` is CORS-anonymous. The browser treats them
as different requests, fetches twice, and warns:

> The resource at "…poster.webp" preloaded with link preload was
> not used within a few seconds.

Same trap applies to font preloads. Fonts must always be preloaded
with `crossorigin`, because `@font-face` fetches are CORS. So
**fonts: keep `crossorigin`. Images for `<img>` / `<video poster>`:
drop `crossorigin`** (unless you specifically need the image's pixel
data via canvas, in which case both sides must have `crossorigin`).

### Preloading the wrong font weight / variant

Preloading a woff2 file that no rendered element actually uses
within the first few seconds also produces the "not used within a
few seconds" warning. Two failure modes:

1. **Weight mismatch.** The landing hero heading and every site
   h2/h3 use Space Grotesk *bold* (700). We were preloading the
   400 (regular) woff2, which no first-paint element uses. The
   bold woff2 fetched late and the regular one was a cold load.
   Preload the weight the LCP candidate actually uses.

2. **Hidden first paint.** The navbar language dropdown contains
   CJK glyphs (`日本語`, `简体中文`, etc.) that need Noto Sans
   subsets. Those `<li>` elements are in the DOM at page load but
   inside a `display: none` dropdown. The browser counts them as
   unused. Preloading those subsets fires the warning on every
   non-CJK page. Drop the preload — the `@font-face` declaration
   with `unicode-range` will fetch on demand when the dropdown
   opens (system-font fallback shows for ~100–200 ms during the
   swap, which is acceptable for a one-off interaction).

The corollary: **only preload fonts you're certain the LCP-relevant
or above-fold-visible element will request within ~1 second.**
Everything else should rely on `@font-face` + `font-display: swap`.

## Measuring locally

Lighthouse mobile (Lantern, 4× CPU) is heavily influenced by host
machine load. During the citation-serif rollout, runs at host load
average 8–17 produced FCP 7–12s and Performance 38–46. The same
build at load average <2 produced FCP 1.6–2.0s and Performance 70+.

Before treating a local number as a regression:

1. `uptime` — host load average should be < 2 across the 1-min /
   5-min figures. Close everything noisy.
2. `pkill -9 -f zola` and `pkill -9 -f node` — kill straggler dev
   processes. Background `zola serve` processes will re-emit `main.css`
   between PurgeCSS and the audit, silently un-purging.
3. Run Lighthouse **at least three times** and discard the slowest.
   First run is always cold-cache slow and not representative.
4. Verify which `main.css` URL is being served — the rewritten link
   should reference the inlined critical + preload swap. If you see
   the raw synchronous `<link rel="stylesheet">`, the inline-critical
   step didn't run.

The authoritative measurement is **production after a Cloudflare
purge**. Local numbers are a smoke check, not a verdict.

For accessibility, prefer `axe-core` (via Puppeteer) over Lighthouse's
a11y category — axe gives a clean pass/fail per rule and isn't
sensitive to host load. When writing axe test scripts, **strip every
variation of the `main.css` link** (synchronous `<link>`, preload,
`<noscript>` fallback) and inject critical.css + main.css inline as
`<style>` blocks. A previous test script only stripped the
`<noscript>` fallback, which meant Puppeteer kept fetching `main.css`
from prod — measuring the *old* cached CSS, not the current build.
The "22 a11y violations" we briefly chased were entirely from that.

## Red flags — what to check when Performance drops

In rough order of "most likely to be the actual cause":

1. **Cloudflare cache lag.** Did the deploy just land? Wait 10 min
   and re-measure. If `main.css?v=<sha>` does NOT match the current
   commit SHA on prod, the HTML itself is still cached stale —
   manual CF purge needed.
2. **Search index size.** `ls -lh public/search_index.en.json` after
   a build. If it's > 5 MB, `truncate_content_length` is missing or
   has been raised. The English index target is ~2.4 MB raw.
3. **Eager prefetch resurrected.** Grep for `requestIdleCallback`
   and `setTimeout` calls in `search.js`, `search-loader.js`, and
   any new module. The only `rIC` that's allowed is the bundle
   prefetch in `search-loader.js`.
4. **Video autoplay logic re-enabled.** Grep `templates/index.html`
   for `video.play()`. The only `setActiveVideo()` call that should
   fire on page load is the one gated by `userEngaged`. The
   `playFirstVideo` / `schedulePlay` pattern (removed) auto-played
   §1 on load and **must not** come back without a different LCP
   strategy.
5. **PurgeCSS `fontFace`.** `grep fontFace scripts/purgecss.js`.
   Must be `fontFace: false`. If a font-family addition isn't
   rendering on prod after a deploy, this is the first thing to
   check.
6. **Unbumped `?v=N`.** If you changed JS, did you bump
   `templates/partials/scripts.html` and `static/js/search-loader.js`?
   Stale bundles against fresh templates produce silent breakage.
7. **Posters and below-fold media.** §2–§5 video posters are still
   fetched eagerly via `<source>` declarations. ~300 KB of below-fold
   posters loads before §1's poster paints. Not yet fixed — flagged
   as the next pass once §1 LCP is stable.
8. **Preload warnings in DevTools console.** "Resource preloaded
   but not used" is rarely benign — usually it means a CORS
   mismatch (drop `crossorigin` for `<img>` / `<video poster>`
   preloads) or a wrong font weight / variant (preload the
   weight the LCP element actually uses). See "Console-warning
   patterns" above.
9. **Unused CSS.** Lighthouse periodically flags 200+ KB of unused
   CSS. PurgeCSS already runs, so most of the "unused" is gated by
   `:hover`, `:focus-visible`, `:lang(...)`, or `[data-theme="..."]`
   selectors that the HTML scan misses. Don't chase this until
   everything above is clean — the easy wins live above.

## File index

| Concern | File |
|---|---|
| Critical CSS extraction | `sass/critical.scss` |
| PurgeCSS config (safelist, `fontFace: false`) | `scripts/purgecss.js` |
| Critical inline + cache-bust | `scripts/inline-critical.js` |
| Bundle build (esbuild) | `scripts/bundle.js` |
| Landing video LCP gate | `templates/index.html` (deferred IIFE) |
| Search index lazy-load | `static/js/search.js` (`initSearchUI`) |
| Search bundle lazy-load | `static/js/search-loader.js` |
| Bundle URL versioning | `templates/partials/scripts.html`, `static/js/search-loader.js` |
| Font-face declarations | `sass/base/_fonts.scss` |
| Font family stacks (per-script + citation) | `sass/base/_typography.scss` |
| Search index truncation (www) | `config.toml` `[search]` block |
| CI build version threading | `.github/workflows/deploy.yml` (www) |

When in doubt, run through "Red flags" top-to-bottom before deeper
investigation. The list is ordered by frequency, not by
sophistication — the boring cache-lag answer is usually the right
one.
