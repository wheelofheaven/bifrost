# iA Writer Mono S web font (code face)

The strictly monospaced sibling of iA Writer Quattro S, which the theme uses
as its "tech" voice for metadata, labels and inline code. Quattro is a
duospace (wide glyphs take one and a half columns), so listings and BibTeX
fields drift out of alignment in it; Mono S advances every glyph 600/1000 em,
so they align. Exposed as `$font-family-code` in `sass/base/_typography.scss`
and used where text is code proper: the BibTeX citation panel.

- Family: iA Writer Mono S, Version 2.000, by Information Architects Inc.,
  based on IBM Plex Mono. Static Regular (400) and Bold (700); the upstream
  Italic is not vendored (no italic code on the site).
- Source: `iaolo/iA-Fonts` commit `c6588670c71e9ac628acc27b72cde4bf12726b7f`,
  `iA Writer Mono/Webfonts/iAWriterMonoS-{Regular,Bold}.woff2`, taken as
  shipped (no subsetting; 850 glyphs each, Latin, Cyrillic and Greek).
- License: SIL Open Font License 1.1 with Reserved Font Name "iA Writer",
  preserved in `OFL.txt` (upstream `iA Writer Mono/LICENSE.md`).
- Checksums of the deployed files: `SHA256SUMS`
  (Regular `5a0e1e2ca42330ec3edfb30385566ba5963cdc7f8c9a3f3e164baf207ee534d0`, Bold `3c07d30fc8169b38943bf4d7f4b97aa37a7d228678e9cacbe680e4bd52f89801`).

The `@font-face` rules live in `sass/base/_fonts.scss` next to Quattro's and
use `local()` first, as Quattro does, so an installed copy is preferred.
