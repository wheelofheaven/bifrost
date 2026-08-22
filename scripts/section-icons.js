#!/usr/bin/env node
/**
 * Generate static/js/section-icons.js — a section-slug → inline-SVG map for
 * the JS surfaces that build markup at runtime and so can't call the
 * `section_icons::section` Tera macro (the reading panel's rows, chiefly).
 *
 * Why a generated bundle module rather than a per-page inline map like
 * wiki-section.html's `window.WIKI_CATEGORY_ICONS`: these five glyphs are
 * ~9KB of path data. That map is rendered on one page; this one is needed
 * on every page, so inlining it would pay 9KB per request. Inside
 * core.bundle.js it is paid once and then cached.
 *
 * Single source of truth stays data/icons.json (the slug → icon-id
 * bindings) plus templates/partials/icons/ (the glyphs). This script only
 * copies from them — re-run it after editing either. `npm run bundle`
 * runs it first, so the normal build path keeps the copy fresh.
 */

const fs = require('fs');
const path = require('path');

const THEME_DIR = path.join(__dirname, '..');
const ICON_PARTIALS = path.join(THEME_DIR, 'templates/partials/icons');
const OUT_FILE = path.join(THEME_DIR, 'static/js/section-icons.js');
// data/icons.json lives at the *site* root, not in the theme: from
// themes/bifrost/scripts/ that is three levels up.
const BINDINGS_FILE = path.join(THEME_DIR, '../../data/icons.json');

// The sections a reading row can belong to: the five templates that carry
// a bookmark button (articles, library, news, timeline, wiki) — which is
// also exactly the set page-progress records. Adding a section here costs
// its glyph's bytes on every page, so keep it to sections that actually
// appear in the panel.
const SECTIONS = ['articles', 'library', 'news', 'timeline', 'wiki'];

function buildSectionIcons() {
    if (!fs.existsSync(BINDINGS_FILE)) {
        // The standalone theme clone has no site root and so no bindings
        // file. Leave the committed copy alone rather than emitting an
        // empty map over it.
        console.log('⚠️  data/icons.json not found — keeping existing section-icons.js');
        return false;
    }

    const registry = JSON.parse(fs.readFileSync(BINDINGS_FILE, 'utf8'));
    const bindings = (registry.bindings && registry.bindings.section) || {};

    const entries = SECTIONS.map((slug) => {
        const iconId = bindings[slug];
        if (!iconId) throw new Error(`No section binding for "${slug}" in data/icons.json`);
        const iconFile = path.join(ICON_PARTIALS, `${iconId}.html`);
        if (!fs.existsSync(iconFile)) throw new Error(`Missing icon partial: ${iconId}.html`);
        return [slug, fs.readFileSync(iconFile, 'utf8').trim()];
    });

    const map = entries
        .map(([slug, svg]) => `        ${slug}: ${JSON.stringify(svg)},`)
        .join('\n');

    const out = `// GENERATED FILE — do not edit by hand.
// Run \`npm run section-icons\` (or \`npm run bundle\`) to regenerate from
// data/icons.json + templates/partials/icons/. See scripts/section-icons.js.
//
// Section identity glyphs for runtime-built markup. Server-rendered
// markup calls the \`section_icons::section\` Tera macro instead; this is
// the same registry, reachable from JS.
(function () {
    'use strict';

    const ICONS = {
${map}
    };

    window.WohSectionIcons = {
        /**
         * Chip-sized glyph for a section slug, ready to concatenate into a
         * template string. Empty for an unknown slug, so callers can splice
         * it in unconditionally and fall back to a bare text label.
         */
        markup(slug) {
            const svg = ICONS[slug];
            if (!svg) return '';
            return '<span class="section-mark section-mark--chip" aria-hidden="true">' + svg + '</span>';
        }
    };
})();
`;

    fs.writeFileSync(OUT_FILE, out);
    console.log(`✅ section-icons.js — ${entries.length} glyphs, ${(out.length / 1024).toFixed(1)}KB`);
    return true;
}

if (require.main === module) {
    buildSectionIcons();
}

module.exports = { buildSectionIcons };
