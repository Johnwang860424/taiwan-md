#!/usr/bin/env node
/**
 * check-scoped-css-size.mjs — Phase 8 guard
 *
 * Reports total lines of scoped <style> CSS across src/components,
 * src/layouts, src/pages, and src/templates. Fails if any single file
 * exceeds the hard cap, and emits the ranked top 10 so regressions
 * show up in PRs.
 *
 * Usage:
 *   node scripts/tools/check-scoped-css-size.mjs           # report
 *   node scripts/tools/check-scoped-css-size.mjs --budget  # enforce budget
 *
 * The budget is deliberately generous — scoped CSS is allowed, just not
 * allowed to grow without someone noticing.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const SCAN_DIRS = [
  'src/components',
  'src/layouts',
  'src/pages',
  'src/templates',
];

// Files over this line count get flagged as regressions.
// Pick values that match current state so new growth is visible.
const PER_FILE_HARD_CAP = 2500;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (extname(entry) === '.astro') {
      out.push(full);
    }
  }
  return out;
}

function countScopedStyleLines(contents) {
  // Matches `<style>` or `<style is:global>` or `<style define:vars={...}>`
  // up to the matching `</style>`. Reports the total inside-tag line count
  // (excluding the tag lines themselves).
  let total = 0;
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  let m;
  while ((m = re.exec(contents)) !== null) {
    const inner = m[1];
    // Count lines of non-blank content inside the style block
    const lines = inner.split('\n').length;
    total += Math.max(0, lines - 1);
  }
  return total;
}

const files = [];
for (const dir of SCAN_DIRS) {
  const full = join(REPO_ROOT, dir);
  try {
    walk(full, files);
  } catch {
    /* dir missing — skip */
  }
}

const results = [];
let grandTotal = 0;
for (const f of files) {
  const contents = readFileSync(f, 'utf-8');
  const lines = countScopedStyleLines(contents);
  if (lines > 0) {
    results.push({ file: relative(REPO_ROOT, f), lines });
    grandTotal += lines;
  }
}

results.sort((a, b) => b.lines - a.lines);

const enforce = process.argv.includes('--budget');
const offenders = results.filter((r) => r.lines > PER_FILE_HARD_CAP);

console.log(`\n📊 Scoped <style> CSS across ${SCAN_DIRS.join(', ')}\n`);
console.log(`  Files with scoped styles: ${results.length}`);
console.log(`  Total scoped CSS lines: ${grandTotal}`);
console.log(`  Per-file hard cap: ${PER_FILE_HARD_CAP}\n`);

console.log('Top 10 files by scoped CSS size:');
for (const r of results.slice(0, 10)) {
  const flag = r.lines > PER_FILE_HARD_CAP ? ' ⚠️' : '';
  console.log(`  ${String(r.lines).padStart(5)}  ${r.file}${flag}`);
}

if (offenders.length > 0) {
  console.log(
    `\n⚠️  ${offenders.length} file(s) exceed the ${PER_FILE_HARD_CAP}-line hard cap:`,
  );
  for (const o of offenders) {
    console.log(`    ${o.file} (${o.lines} lines)`);
  }
  if (enforce) {
    console.error(
      '\n❌ Failing because --budget was set. Migrate or split one of the above.',
    );
    process.exit(1);
  } else {
    console.log('\n(report-only mode; pass --budget to fail CI on this)');
  }
} else {
  console.log('\n✅ All files under cap.');
}
