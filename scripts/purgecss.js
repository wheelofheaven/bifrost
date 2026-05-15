#!/usr/bin/env node
/**
 * PurgeCSS - Remove unused CSS
 *
 * Run after `zola build` to analyze built HTML and remove unused styles.
 * IMPORTANT: This modifies files in the public/ directory, not the source.
 */

const { PurgeCSS } = require('purgecss');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../../../public');

// Classes that are added dynamically via JavaScript and must be preserved
const SAFELIST = [
  // Theme classes
  /^data-theme/,
  /^dark$/,
  /^light$/,

  // State classes added by JS
  /--active$/,
  /--open$/,
  /--visible$/,
  /--hidden$/,
  /--loading$/,
  /--loaded$/,
  /--selected$/,
  /--expanded$/,
  /--collapsed$/,
  /--disabled$/,
  /--sticky$/,
  /--scrolled$/,
  /--focused$/,

  // Animation classes
  /^fade-/,
  /^slide-/,
  /^animate-/,

  // Library reader specific
  /^library-book__/,
  /--split$/,

  // Timeline specific
  /^timeline-/,
  /^age-/,

  // Search specific
  /^search-/,

  // Reading list
  /^reading-list/,

  // Toast/snackbar
  /^snackbar/,
  /^toast/,

  // Mobile menu
  /^navbar.*--mobile/,
  /^is-/,
  /^has-/,

  // Utility classes that might be added dynamically
  'hidden',
  'visible',
  'active',
  'show',
  'hide',
  'open',
  'closed',
  'expanded',
  'collapsed',
];

async function purge() {
  const cssFiles = [
    { name: 'main.css', path: path.join(PUBLIC_DIR, 'main.css') },
    { name: 'critical.css', path: path.join(PUBLIC_DIR, 'critical.css') },
  ];

  console.log('\n🧹 PurgeCSS - Removing unused styles\n');

  for (const cssFile of cssFiles) {
    if (!fs.existsSync(cssFile.path)) {
      console.log(`⚠️  ${cssFile.name} not found, skipping`);
      continue;
    }

    const originalSize = fs.statSync(cssFile.path).size;

    try {
      const result = await new PurgeCSS().purge({
        content: [
          path.join(PUBLIC_DIR, '**/*.html'),
        ],
        css: [cssFile.path],
        safelist: {
          standard: SAFELIST.filter(s => typeof s === 'string'),
          deep: SAFELIST.filter(s => s instanceof RegExp),
          greedy: SAFELIST.filter(s => s instanceof RegExp),
        },
        // Preserve CSS variables and keyframes. `fontFace: false` keeps
        // every @font-face declaration — PurgeCSS can't trace font
        // references through CSS custom properties (e.g. families used
        // only via `var(--font-family-citation)`), so the "unused
        // @font-face" detection silently drops fonts that *are* used
        // via variables. We curate the @font-face set deliberately in
        // sass/base/_fonts.scss; the bytes saved by pruning don't
        // justify the fragility.
        variables: true,
        keyframes: true,
        fontFace: false,
      });

      if (result.length > 0) {
        fs.writeFileSync(cssFile.path, result[0].css);
        const newSize = fs.statSync(cssFile.path).size;
        const reduction = Math.round((1 - newSize / originalSize) * 100);

        console.log(
          `✅ ${cssFile.name.padEnd(15)} ` +
          `${(originalSize / 1024).toFixed(1).padStart(8)} KB → ` +
          `${(newSize / 1024).toFixed(1).padStart(8)} KB ` +
          `(${reduction}% reduction)`
        );
      }
    } catch (error) {
      console.error(`❌ Failed to purge ${cssFile.name}:`, error.message);
    }
  }

  console.log('\n✅ PurgeCSS complete\n');
}

purge().catch(console.error);
