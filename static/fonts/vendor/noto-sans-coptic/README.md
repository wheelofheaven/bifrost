# Noto Sans Coptic web font (Coptic reading face)

Coptic face for the Gospel of Thomas (Sahidic Coptic) in the library interlinear, reached through the citation layer
(`--font-family-citation`). Most systems ship no Coptic font, so without this
face the original script renders as empty boxes.

- Family: Noto Sans Coptic, regular, by Google / the Noto project.
- Source: the `coptic` subset served by Google Fonts (fonts.gstatic.com),
  downloaded 2026-11-25.
- The `@font-face` in `sass/base/_fonts.scss` is bounded to U+2C80–2CFF, U+03E2–03EF, so the file
  loads only on pages that contain Coptic text.
- License: SIL Open Font License 1.1, preserved in `OFL.txt`.
- Checksum of the deployed file: `SHA256SUMS`.
