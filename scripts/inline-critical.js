#!/usr/bin/env node
/**
 * Inline critical CSS + non-block main.css
 *
 * Post-build step. Walks every HTML file in public/, inlines the contents
 * of public/critical.css inside <head>, and rewrites the synchronous
 * <link rel="stylesheet" href=".../main.css"> into a non-render-blocking
 * preload-then-stylesheet swap (plus a <noscript> fallback).
 *
 * Critical.css is ~9 KB gzipped; the cost of inlining it per page is
 * accepted in exchange for unblocking FCP/LCP. Run AFTER purgecss so the
 * inlined sheet is already trimmed.
 *
 * Idempotent: re-running on already-processed files is a no-op.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../../../public');
const CRITICAL_PATH = path.join(PUBLIC_DIR, 'critical.css');

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(p);
        else if (entry.isFile() && p.endsWith('.html')) yield p;
    }
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
    const href = match[1];

    const replacement =
        `<style data-critical-inlined>${criticalCss}</style>` +
        `<link rel="preload" href="${href}" as="style" ` +
        `onload="this.onload=null;this.rel='stylesheet'">` +
        `<noscript><link rel="stylesheet" href="${href}"></noscript>`;

    return html.replace(linkRe, replacement);
}

function main() {
    if (!fs.existsSync(CRITICAL_PATH)) {
        console.error('❌ critical.css not found at', CRITICAL_PATH);
        process.exit(1);
    }
    const criticalCss = fs.readFileSync(CRITICAL_PATH, 'utf8').trim();
    const criticalKb = (Buffer.byteLength(criticalCss) / 1024).toFixed(1);

    console.log(`\n🎨 Inline critical CSS (${criticalKb} KB) + async main.css\n`);

    let processed = 0;
    let skipped = 0;
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
    console.log();
}

main();
