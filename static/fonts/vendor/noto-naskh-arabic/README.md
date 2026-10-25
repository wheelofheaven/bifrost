# Noto Naskh Arabic web font (Arabic reading companion)

Arabic face for extended reading through the citation layer
(`--font-family-citation`): library originals such as the Hidden Words, and
scripture blocks. Chosen in the Firmament companion proof
<https://firmament.wheelofheaven.world/companions/> as the reading candidate;
Naskh carries long text more kindly than the Kufi interface face (Cairo).

- Family: Noto Naskh Arabic, version 2.021, by Google / the Noto project.
  Variable `wght` 400–700.
- Source: `google/fonts` commit `e7db6ca603fd4862010383ff17ffd6cc4ffac1c0`,
  `ofl/notonaskharabic/NotoNaskhArabic[wght].ttf`
  (SHA-256 `67b5a525a661b607971fbd3f96a81b89d3a768e74534fca84f18ac97e6fab72f`).
- Subset: the same Arabic ranges as Cairo (U+0600–06FF, U+0750–077F,
  U+08A0–08FF, U+FB50–FDFF, U+FE70–FEFF, U+200C–200F, U+25CC); 1,177
  mappings, full vocalisation and Qur'anic annotation marks included. The
  `@font-face` in `sass/base/_fonts.scss` is bounded to the same range.
- Built with fontTools 4.60.2 (all layout features kept, hinting dropped, WOFF2).
- License: SIL Open Font License 1.1, preserved in `OFL.txt`.
- Checksum of the deployed file: `SHA256SUMS`.

Native-reader review of a full Hidden Words chapter at reading size is still
owed; the proof's measurements chose the face, readers decide whether it stays.
