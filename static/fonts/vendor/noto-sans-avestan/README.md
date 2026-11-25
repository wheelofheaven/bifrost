# Noto Sans Avestan web font (Avestan reading face)

Avestan face for the Vendidad (Avestan) in the library interlinear, reached through the citation layer
(`--font-family-citation`). Most systems ship no Avestan font, so without this
face the original script renders as empty boxes.

- Family: Noto Sans Avestan, regular, by Google / the Noto project.
- Source: the `avestan` subset served by Google Fonts (fonts.gstatic.com),
  downloaded 2026-11-25.
- The `@font-face` in `sass/base/_fonts.scss` is bounded to U+10B00–10B3F, so the file
  loads only on pages that contain Avestan text.
- License: SIL Open Font License 1.1, preserved in `OFL.txt`.
- Checksum of the deployed file: `SHA256SUMS`.
