#!/usr/bin/env node
/**
 * Bundle JS files using esbuild
 *
 * Creates optimized bundles for different page types:
 * - core.bundle.js: Common scripts for all pages
 * - library.bundle.js: Library-specific scripts
 * - timeline.bundle.js: Timeline-specific scripts
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '../static/js');
const OUT_DIR = path.join(__dirname, '../static/js/dist');

// Bundle configurations
const bundles = {
  'core.bundle.js': [
    'vendor/fuse.min.js',  // Fuse.js search library (self-hosted)
    'vendor/fuse-global.js',  // Expose Fuse globally after UMD load
    'navbar.js',
    'navbar-mobile-toggle.js',
    'search.js',
    'reading-list.js',
    'pwa.js',
    'toc-scroll-spy.js',
    'to-top.js',
    'prefetch.js',  // Prefetch links on hover for instant navigation
  ],
  'library.bundle.js': [
    'library-storage.js',
    'library-reader.js',
    'library-search.js',
    'library-study-tools.js',
  ],
  'timeline.bundle.js': [
    'timeline.js',
  ],
};

async function bundle() {
  // Ensure output directory exists
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const isWatch = process.argv.includes('--watch');
  const results = [];

  for (const [outputFile, inputFiles] of Object.entries(bundles)) {
    // Read and concatenate all input files
    const contents = inputFiles
      .map(file => {
        const filePath = path.join(JS_DIR, file);
        if (!fs.existsSync(filePath)) {
          console.warn(`Warning: ${file} not found, skipping`);
          return '';
        }
        return fs.readFileSync(filePath, 'utf8');
      })
      .filter(Boolean)
      .join('\n\n');

    // Write temporary entry file
    const entryFile = path.join(OUT_DIR, `_entry_${outputFile}`);
    fs.writeFileSync(entryFile, contents);

    try {
      const result = await esbuild.build({
        entryPoints: [entryFile],
        bundle: false,
        minify: true,
        sourcemap: false,
        outfile: path.join(OUT_DIR, outputFile),
        target: ['es2020'],
        format: 'iife',
        ...(isWatch && {
          watch: {
            onRebuild(error, result) {
              if (error) console.error(`Rebuild failed for ${outputFile}:`, error);
              else console.log(`Rebuilt ${outputFile}`);
            },
          },
        }),
      });

      // Clean up temp file
      fs.unlinkSync(entryFile);

      const stats = fs.statSync(path.join(OUT_DIR, outputFile));
      const originalSize = inputFiles.reduce((sum, file) => {
        const filePath = path.join(JS_DIR, file);
        return sum + (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);
      }, 0);

      results.push({
        name: outputFile,
        files: inputFiles.length,
        original: originalSize,
        minified: stats.size,
        reduction: Math.round((1 - stats.size / originalSize) * 100),
      });

    } catch (error) {
      console.error(`Failed to bundle ${outputFile}:`, error);
      process.exit(1);
    }
  }

  // Print summary
  console.log('\n📦 Bundle Summary\n');
  console.log('Bundle                  Files   Original    Minified    Reduction');
  console.log('─'.repeat(70));

  let totalOriginal = 0;
  let totalMinified = 0;

  for (const r of results) {
    totalOriginal += r.original;
    totalMinified += r.minified;
    console.log(
      `${r.name.padEnd(22)} ${String(r.files).padStart(5)}   ` +
      `${(r.original / 1024).toFixed(1).padStart(8)} KB  ` +
      `${(r.minified / 1024).toFixed(1).padStart(8)} KB  ` +
      `${String(r.reduction).padStart(8)}%`
    );
  }

  console.log('─'.repeat(70));
  console.log(
    `${'Total'.padEnd(22)} ${String(results.reduce((s, r) => s + r.files, 0)).padStart(5)}   ` +
    `${(totalOriginal / 1024).toFixed(1).padStart(8)} KB  ` +
    `${(totalMinified / 1024).toFixed(1).padStart(8)} KB  ` +
    `${String(Math.round((1 - totalMinified / totalOriginal) * 100)).padStart(8)}%`
  );
  console.log('\n✅ Bundles written to static/js/dist/\n');

  if (isWatch) {
    console.log('Watching for changes...');
  }
}

bundle().catch(console.error);
