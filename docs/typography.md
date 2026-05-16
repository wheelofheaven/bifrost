# Typography — the Bifrost script system

Wheel of Heaven sits at an unusual intersection of registers: mythic,
archival, speculative, scientific, technical, scriptural, cinematic.
A single typographic voice would collapse the project into one of them.
The bifrost theme instead uses **four typographic layers**, each
signalling a different kind of authority and cognitive mode.

This document is the source of truth for which layer applies to which
element. When in doubt, consult it before introducing new styles.

## The four layers

| Layer | Role | Latin font | Signals |
|---|---|---|---|
| 1. Primary reading | Body prose, essays, explanations | Jost | interpretation, narrative voice |
| 2. Structural / conceptual | Titles, section headings, framing concepts | Space Grotesk | conceptual framing, geometric modernism |
| 3. Citation / scholarly | Quotations, scripture, citations, epigraphs | IBM Plex Serif | source material, documentary gravitas |
| 4. Technical / metadata | Badges, timestamps, IDs, taxonomies | iA Writer Quattro | systemization, archival cataloguing — warmer / more editorial than a developer-terminal mono |

The semantic intent is what matters, not the font name.
Readers subconsciously learn the mapping:

- **sans (Jost)** → "this is interpretation"
- **grotesk display (Space Grotesk)** → "this is framing"
- **serif (Plex Serif)** → "this is source material"
- **mono (iA Writer Quattro)** → "this is system / meta"

That mapping is the project's cognitive navigation.
Mixing layers arbitrarily — body in mono, scripture in sans, metadata
in serif — destroys it.

## Layer 1 — primary reading

Use for: article prose, essays, explanatory paragraphs, long-form
reading. Default body voice across the site.

Latin: **Jost**, humanist geometric. Cyrillic ships in the same Jost
subset (`jost-v19-cyrillic_latin-*.woff2`).

Suggested settings for long-form prose:

```scss
font-size: 1.05rem;
line-height: 1.75;
max-width: 72ch;
font-weight: 400;
```

Avoid light weights (Jost looks fragile under 400) and avoid stretching
content past 72ch (reading rhythm breaks).

## Layer 2 — structural / conceptual

Use for: page titles, section headings, chapter names, timeline period
labels, map labels, framing concepts ("The Working Hypothesis").

Latin: **Space Grotesk**, geometric sans with subtle tension.

Avoid:
- all-caps applied site-wide (looks cyberpunk)
- excessive letter-spacing on body-sized headings
- oversized futuristic styling

The power of Space Grotesk here is restraint.
If a heading feels too future-tech, drop weight or tighten tracking
before changing the font.

## Layer 3 — citation / scholarly

Use for: quotations, scripture excerpts, bibliographic references,
epigraphs, translated ancient texts, author citations.

Latin target: **IBM Plex Serif**.

Why a serif here, and why this serif:

- **Tonal separation** from body prose — the reader sees at a glance
  that the text is *quoted*, not the author's interpretation.
- **Documentary gravitas** without "Bible-website" or "fantasy-novel"
  overtones. Merriweather, Playfair, Cinzel, EB Garamond all drift in
  those directions and are explicitly avoided.
- **Pairs cleanly with Space Grotesk** — both come from the
  geometric-modernist family of the early 21st century.

Multiscript fallback: **Noto Serif** family for non-Latin scripts
(Noto Serif SC / TC / JP / KR / Hebrew / Greek). This preserves the
"source material" signal across the entire corpus, which spans Hebrew
scripture, Greek philosophy, Sanskrit, Akkadian transliterations, etc.

The Hebrew serif voice is already set: **Frank Ruhl Libre** (Raphael
Frank, 1908; modernized by Yanek Iontef). It's the canonical Hebrew
text serif and already covers inline Hebrew (`.hebrew`, `[lang="he"]`).
Keep it as the layer-3 Hebrew face.

The Greek serif voice is also set: **GFS Didot** (Greek Font Society's
revival of Didot's Greek). Full polytonic coverage. Keep it as the
layer-3 Greek face.

## Layer 4 — technical / metadata

Use for:
- badges and pills (claim type, source family, status)
- taxonomy labels (category chips, tags)
- timestamps and dates (especially precessional dates)
- manuscript IDs and reference codes
- source classifications
- AI-generated notices / data-attribute hints
- map coordinates
- glossary IDs and hover annotations
- code samples and inline `<code>` / `<pre>`

Latin: **iA Writer Quattro** (the duospace `iAWriterQuattroS`).

Why this mono, deliberately not IBM Plex Mono:

- The project catalogues things — books, references, ages,
  precessional positions, codes. A monospaced face says "this is
  a record in a system."
- Plex Mono was the obvious "system anchor" pick (same designer
  / metrics as Plex Serif), but it reads as technical instrumentation
  — closer to a developer terminal than to an editorial archive.
  Quattro's slight warmth — a duospace, not a strict mono — fits
  this project better. The site already runs on the warm side
  (Jost body, italic Plex Serif citations, accent-gradient
  hairlines), and a colder Plex Mono fights that.
- Quattro pairs well with Jost: both have humanist warmth and a
  similar x-height profile. Reading from body sans into a mono pill
  on the same page doesn't feel like crossing into a different
  tooling layer — which is exactly the contrast we don't want for
  metadata that lives *alongside* prose.

What to **avoid** in this layer:

- Overly programmer-centric monospace (Fira Code with ligatures,
  Cascadia, JetBrains Mono with high contrast). They tip the page
  toward "developer dashboard."

Multiscript fallback: the `$font-family-mono` stack drops into
system CJK gothic faces (Hiragino, Yu Gothic, PingFang, Microsoft
YaHei, Noto Sans JP/SC) for any monospaced metadata that contains
CJK glyphs — there's no widely-deployed "duospace" CJK face that
preserves Quattro's tone, so we lean on the system gothic stack
rather than force a visual mismatch.

## Per-script overrides

The Latin-first stack does not work identically across scripts.
The theme already implements per-script body+display pairs that
preserve the layer-1/layer-2 distinction:

| Script | Layer 1 (body) | Layer 2 (display) |
|---|---|---|
| Japanese | Zen Kaku Gothic New | M PLUS 1p |
| Simplified Chinese | Noto Sans SC | Noto Serif SC |
| Traditional Chinese | Noto Sans TC | Noto Serif TC |
| Korean | Pretendard | IBM Plex Sans KR |
| Russian (Cyrillic) | Jost (Cyrillic subset) | Space Grotesk (Google Fonts, Cyrillic + Latin) |
| Hebrew | — | Frank Ruhl Libre |
| Greek | — | GFS Didot |

Stacks live in `sass/base/_typography.scss` as
`$font-family-{lang}-body` and `$font-family-{lang}-display`.
Web font loads are conditional in `partials/fonts-css.html` based
on `detected_lang`.

When extending the system, use `:lang()` selectors for script-specific
tuning (line-height, tracking, weight). Examples that matter on this
project:

```scss
:lang(ja) { line-height: 1.7; }   // Japanese needs tighter line-height
:lang(ko) { letter-spacing: 0.01em; }  // Korean can tolerate more spacing
:lang(zh), :lang(zh-Hant) { font-weight: 500; }  // CJK headings need heavier weights
:lang(he) { font-feature-settings: "kern"; }
```

## Embracing visible script diversity

Do **not** over-normalize across scripts.
Hebrew should look ancient and dense. Korean should look modular.
Japanese should look layered. Greek should look philosophical. IPA
should look scientific. That diversity reinforces the project's
"archive assembled from multiple civilizations" atmosphere.

The goal of the multiscript stack is *tonal consistency of role*
(body still feels like body, citation still feels like citation),
not *visual identity of glyph shape*. The latter is impossible across
scripts and trying to force it makes everything look mediocre.

## Token names in SCSS

`sass/base/_typography.scss` exposes these SCSS variables:

| Variable | Layer | Notes |
|---|---|---|
| `$font-family-body` (alias of `$font-family-sans`) | 1 | Body prose, Jost |
| `$font-family-lead` (alias of `$font-family-serif`) | 2 | Display/headlines. Name "serif" is historical; the actual font is Space Grotesk (sans). |
| `$font-family-citation` | 3 | IBM Plex Serif → CJK serifs → Hebrew / Greek serifs → system serif |
| `$font-family-tech` (alias of `$font-family-mono`) | 4 | iA Writer Quattro (`iAWriterQuattroS`) |

CSS custom properties (`var(--font-family-lead)` etc.) are set in
`sass/themes/_init.scss` and resolved per `:lang(...)`. Prefer the
CSS variables in component SCSS so per-lang switches propagate.

## Current implementation state vs target

- ✅ Layer 1 (Jost body) — in place.
- ✅ Layer 2 (Space Grotesk display) — in place.
- ✅ Layer 3 (IBM Plex Serif citation) — in place as of the typography
  system rollout. Self-hosted Latin + Latin Extended, regular / bold /
  italic. CJK / Hebrew / Greek citations fall through to Noto Serif {JP,
  SC, TC, KR} / Frank Ruhl Libre / GFS Didot via the stack and
  `unicode-range`. Consumers (`var(--font-family-citation)`) live in
  `_wiki-shortcodes.scss`, `_wiki-quotes.scss`, and `_wiki.scss` today;
  more surfaces will follow (see "Where layer 3 should land" below).
- ✅ Layer 4 (iA Writer Quattro mono) — in place. The duospace warmth
  is deliberate (see "Layer 4" above for the reasoning); the project
  doesn't want a cold developer-terminal feel for its metadata pills.

## Layer 3 surfaces — current state

Wired up and rendering Plex Serif (Latin) / Noto Serif fallback (non-Latin):

| Surface | Selector | Files affected |
|---|---|---|
| Wiki entry blockquotes | `.wiki__content blockquote` | ~670 wiki entries across 9 languages |
| Library book reader prose | `.library-book__para-original`, `.library-book__para-translation` | 96 library books |
| Article blockquotes | `.article__content blockquote` | rule in place; activates per article |
| Timeline genesis verses | `.timeline-page__verse` | 9 timeline-age pages |
| Timeline body blockquotes | `.timeline-page__content blockquote` | same set as above |
| Landing coda hero quote | `.landing-coda__quote` | `/` |
| Newsroom dispatch sources | `.dispatch__source-item` (+ link/outlet/date) | each dispatch |
| Wiki references list | `.wiki__reference-item` (+ link/title/author/publication/date/description) | rule in place; activates per entry once `[extra] references = [...]` is populated |

Per-surface ergonomic tuning is intentional (size, leading, italic,
border treatment) — different reading contexts justify slightly
different treatments while sharing the same citation stack via
`--font-family-citation`. See each component's SCSS comment for
the reasoning behind its specific tuning.

Dormant scaffolding — fully styled, activates when first used in
content:

- `templates/shortcodes/library.html` (`.library-quote`)
- `templates/shortcodes/author.html` / `templates/macros/author.html`
  (`.author-profile`, author blockquote citations)
- `[extra] references` field on wiki entries

The remaining edge cases (generic `<blockquote>` and `<cite>` in
`_base.scss`, the definition shortcode body) are intentionally left
on body sans — `<cite>` is short attribution metadata (layer 4
territory) and a bare unscoped `<blockquote>` is rare enough on this
site that the section-specific rules cover the real cases.

## When to introduce a new layer

Don't.
Four layers is enough. Adding a fifth ("emphasis," "callout," "lead
paragraph") fragments the cognitive map and forces the reader to
re-learn the system. Variation within an existing layer (weight,
size, color, italics) is almost always the right move.

The one exception is **script-specific variants**, which extend a
layer rather than replacing it (see "Per-script overrides" above).
