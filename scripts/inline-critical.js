#!/usr/bin/env node
/**
 * Inline critical CSS + non-block main.css + cache-bust JS bundles
 *
 * Post-build step. For every HTML file in public/:
 *   1. Inlines public/critical.css inside <head>
 *   2. Rewrites the synchronous <link rel="stylesheet" href=".../main.css">
 *      into a non-render-blocking preload-then-stylesheet swap
 *   3. Appends `?v=<BUILD_VERSION>` to all JS bundle URLs (overwriting any
 *      pre-existing `?v=...`), so Cloudflare cannot serve a stale bundle
 *      against fresh HTML
 *
 * The search bundle is loaded dynamically from inside core.bundle.js, so a
 * separate post-pass rewrites the literal "search.bundle.js?v=..." string
 * embedded in that minified file.
 *
 * Critical.css is ~9 KB gzipped; the cost of inlining it per page is
 * accepted in exchange for unblocking FCP/LCP. Run AFTER purgecss so the
 * inlined sheet is already trimmed.
 *
 * Cache-busting rationale: Cloudflare caches static assets (CSS/JS) for
 * up to 7 days by default. Without a per-deploy URL change, returning
 * visitors keep getting the old bundle until the cache is manually
 * purged. By stamping every CSS + JS bundle URL with the build SHA the
 * URL itself is new on every deploy, so the CDN cache miss on first
 * fetch is the freshness guarantee — no manual purge needed.
 *
 * Without BUILD_VERSION (local dev) URLs are left unchanged; zola serve's
 * live-reload handles freshness.
 *
 * Idempotent: re-running on already-processed files is a no-op.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../../../public');
const CRITICAL_PATH = path.join(PUBLIC_DIR, 'critical.css');
const BUILD_VERSION = (process.env.BUILD_VERSION || '').trim();

// JS bundles referenced from HTML. core.bundle.js is loaded on every page;
// library.bundle.js only on /library/<slug>/ pages.
const JS_BUNDLES = ['core.bundle.js', 'library.bundle.js'];

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(p);
        else if (entry.isFile() && p.endsWith('.html')) yield p;
    }
}

function bustUrl(href) {
    if (!BUILD_VERSION) return href;
    return href.includes('?')
        ? `${href}&v=${BUILD_VERSION}`
        : `${href}?v=${BUILD_VERSION}`;
}

// Rewrites every JS bundle reference in an HTML attribute (src="...")
// to `name?v=<sha>`, stripping any existing query so the URL is canonical
// per deploy. Operates on a single bundle name at a time so we don't
// accidentally swallow other query parameters.
function bustJsBundles(html) {
    if (!BUILD_VERSION) return html;
    let result = html;
    for (const name of JS_BUNDLES) {
        const escaped = name.replace(/\./g, '\\.');
        // Match: bundle name + optional existing ?query, up to closing "
        const re = new RegExp(`(${escaped})(\\?[^"]*)?(?=")`, 'g');
        result = result.replace(re, `$1?v=${BUILD_VERSION}`);
    }
    return result;
}

function rewrite(html, criticalCss) {
    // Already processed? Look for our sentinel.
    if (html.includes('data-critical-inlined')) return null;

    // Find the main.css stylesheet link. Zola HTML-encodes URL slashes in
    // attribute values (e.g. https:&#x2F;&#x2F;), so match the literal
    // attribute text rather than parsing the URL.
    const linkRe = /<link[^>]*rel="stylesheet"[^>]*href="([^"]*main\.css[^"]*)"[^>]*>/;
    const match = html.match(linkRe);
    if (!match) return null;
    const href = bustUrl(match[1]);

    const replacement =
        `<style data-critical-inlined>${criticalCss}</style>` +
        `<link rel="preload" href="${href}" as="style" ` +
        `onload="this.onload=null;this.rel='stylesheet'">` +
        `<noscript><link rel="stylesheet" href="${href}"></noscript>`;

    return bustJsBundles(html.replace(linkRe, replacement));
}

// Rewrite the search bundle URL string embedded inside core.bundle.js,
// since the search loader builds the <script src> at runtime rather than
// loading via an HTML <script src>. Without this pass the search modal
// would keep loading the stale CDN-cached search.bundle.js even after a
// fresh deploy.
function bustSearchBundleInCore() {
    if (!BUILD_VERSION) return false;
    const corePath = path.join(PUBLIC_DIR, 'js/dist/core.bundle.js');
    if (!fs.existsSync(corePath)) return false;
    const src = fs.readFileSync(corePath, 'utf8');
    // Match search.bundle.js with optional existing ?v=... up to the
    // next quote (single or double) — the URL lives inside a JS string
    // literal in the minified bundle.
    const re = /search\.bundle\.js(\?v=[^"']*)?/g;
    const rewritten = src.replace(re, `search.bundle.js?v=${BUILD_VERSION}`);
    if (rewritten === src) return false;
    fs.writeFileSync(corePath, rewritten);
    return true;
}

function main() {
    if (!fs.existsSync(CRITICAL_PATH)) {
        console.error('❌ critical.css not found at', CRITICAL_PATH);
        process.exit(1);
    }
    const criticalCss = fs.readFileSync(CRITICAL_PATH, 'utf8').trim();
    const criticalKb = (Buffer.byteLength(criticalCss) / 1024).toFixed(1);
    const cachebustMsg = BUILD_VERSION
        ? ` + cache-bust main.css + JS bundles ?v=${BUILD_VERSION}`
        : ' (no BUILD_VERSION set — URLs unchanged)';

    console.log(`\n🎨 Inline critical CSS (${criticalKb} KB) + async main.css${cachebustMsg}\n`);

    let processed = 0;
    let unchanged = 0;
    for (const file of walk(PUBLIC_DIR)) {
        const html = fs.readFileSync(file, 'utf8');
        const rewritten = rewrite(html, criticalCss);
        if (rewritten === null) {
            unchanged++;
            continue;
        }
        fs.writeFileSync(file, rewritten);
        processed++;
    }

    console.log(`✅ Inlined into ${processed} HTML file(s)`);
    if (unchanged > 0) console.log(`   ${unchanged} file(s) had no main.css link (e.g. redirect aliases)`);

    if (bustSearchBundleInCore()) {
        console.log(`✅ Rewrote search.bundle.js URL inside core.bundle.js → ?v=${BUILD_VERSION}`);
    }
    console.log();
}

main();
