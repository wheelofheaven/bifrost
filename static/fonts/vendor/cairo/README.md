# Cairo web font (Arabic interface companion)

Arabic face for interface text and inline citations (`.arabic`, nested
`[lang="ar"]`, and any Arabic glyph reached through the body and display
stacks), chosen in the Firmament companion proof:
<https://firmament.wheelofheaven.world/companions/>. Kufi-based, drawn by
Mohamed Gaber as the Arabic companion to a geometric Latin; its stem measures
0.96× Firmament Sans at Regular and its alef sits on the Latin cap height.

- Family: Cairo, version 3.130, by Mohamed Gaber (Accademia di Belle Arti di
  Urbino). Variable `wght` 200–1000; the `slnt` axis is pinned upright.
- Source: `google/fonts` commit `e7db6ca603fd4862010383ff17ffd6cc4ffac1c0`,
  `ofl/cairo/Cairo[slnt,wght].ttf`
  (SHA-256 `667c987182391c91f4e57a2f455b1794fb5e3ee6ca4ef3383e86bb690fa9c964`).
- Subset: Arabic U+0600–06FF, Arabic Supplement U+0750–077F, Arabic
  Extended-A U+08A0–08FF, Presentation Forms A U+FB50–FDFF and B U+FE70–FEFF,
  U+200C–200F, U+25CC; every codepoint the source has in those ranges
  (297 mappings). The `@font-face` in `sass/base/_fonts.scss` is bounded to
  the same `unicode-range`, so the file is never fetched on pages without
  Arabic and Latin always comes from Firmament Sans.
- Layout features kept: init/medi/fina/rlig joining, mark/mkmk, kern, locl.
- Built with fontTools 4.60.2 (all layout features kept, hinting dropped, WOFF2).
- License: SIL Open Font License 1.1, preserved in `OFL.txt`.
- Checksum of the deployed file: `SHA256SUMS`.

Extended Arabic reading text (library originals) uses Noto Naskh Arabic
through the citation layer instead; see `../noto-naskh-arabic/`.
