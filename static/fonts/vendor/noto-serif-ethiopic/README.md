# Noto Serif Ethiopic web font (Ethiopic reading face)

Ethiopic face for the Ge'ez witnesses of 1 Enoch and Jubilees in the library interlinear, reached through the citation layer
(`--font-family-citation`). Most systems ship no Ethiopic font, so without this
face the original script renders as empty boxes.

- Family: Noto Serif Ethiopic, regular, by Google / the Noto project.
- Source: the `ethiopic` subset served by Google Fonts (fonts.gstatic.com),
  downloaded 2026-11-25.
- The `@font-face` in `sass/base/_fonts.scss` is bounded to U+1200–139F, U+2D80–2DDF, U+AB00–AB2F, so the file
  loads only on pages that contain Ethiopic text.
- License: SIL Open Font License 1.1, preserved in `OFL.txt`.
- Checksum of the deployed file: `SHA256SUMS`.
