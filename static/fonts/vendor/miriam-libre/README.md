# Miriam Libre web font (Hebrew companion)

Body and display companion for the Hebrew locale (`:lang(he)`), chosen in the
Firmament companion proof: <https://firmament.wheelofheaven.world/companions/>.
It matches Firmament Sans on stem weight and typographic colour at both weights,
and its Hebrew descends from Raphael Frank's monolinear Miriam, as Frank Ruhl
Libre (the Hebrew citation serif) descends from Frank's Frank-Rühl.

- Family: Miriam Libre, version 2.000, by Michal Sahar. Variable `wght` 400–700.
- Source: `google/fonts` commit `e7db6ca603fd4862010383ff17ffd6cc4ffac1c0`,
  `ofl/miriamlibre/MiriamLibre[wght].ttf`
  (SHA-256 `9ea850118d552d25e1fb8242cbd429a5801c691b6ce218458e1a039045114bb8`).
- Subset: Hebrew block U+0590–05FF, Alphabetic Presentation Forms U+FB1D–FB4F,
  U+200C–2010, U+20AA, U+25CC; every codepoint the source has in those ranges
  (76 mappings). The `@font-face` in `sass/base/_fonts.scss` is bounded to the
  same `unicode-range`, so Latin and digits always fall through to Firmament
  Sans / Space Grotesk and this file is never fetched on pages without Hebrew.
- Not included upstream: sof pasuq (U+05C3) and cantillation marks. Pointed
  source text stays in the citation layer (Frank Ruhl Libre), which has them.
- Built with fontTools 4.60.2 (`pyftsubset`-equivalent options: all layout
  features kept, `fvar`/`gvar` kept, hinting dropped, WOFF2).
- License: SIL Open Font License 1.1, preserved in `OFL.txt`.
- Checksum of the deployed file: `SHA256SUMS`.

Inline Hebrew citations inside other-language prose (`.hebrew`, nested
`[lang="he"]`) keep Frank Ruhl Libre; see `sass/base/_base.scss`.
