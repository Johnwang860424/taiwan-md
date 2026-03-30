#!/usr/bin/env node
/**
 * Import caris-events/invade vocab database into Taiwan.md terminology.
 * 
 * - Reads invade YML files from data/terminology/_sources/invade/
 * - Checks which words we already have
 * - Creates new YAML entries for missing ones in display format
 * 
 * Usage: node tools/import-invade.js [--dry-run] [--force]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const TERM_DIR = join(import.meta.dirname, '..', 'data', 'terminology');
const INVADE_DIR = join(TERM_DIR, '_sources', 'invade');
const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

// Load existing terminology
function loadExisting() {
  const existing = new Map(); // china word → file
  const existingTw = new Map(); // taiwan word → file
  const files = readdirSync(TERM_DIR).filter(f => (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('_'));
  for (const file of files) {
    try {
      const raw = readFileSync(join(TERM_DIR, file), 'utf-8');
      const d = parseYaml(raw);
      const china = d?.display?.china || d?.china || '';
      const taiwan = d?.display?.taiwan || d?.taiwan || '';
      if (china) {
        // Handle "X / Y" format
        for (const v of china.split(/[\/／]/).map(s => s.trim()).filter(Boolean)) {
          existing.set(v, file);
        }
      }
      if (taiwan) {
        for (const v of taiwan.split(/[\/／]/).map(s => s.trim()).filter(Boolean)) {
          existingTw.set(v, file);
        }
      }
    } catch {}
  }
  return { existing, existingTw };
}

// Parse invade YML format
function parseInvade(raw) {
  const d = parseYaml(raw);
  if (!d) return null;
  
  const word = d.word; // This is the CN word
  if (!word) return null;
  
  const description = (d.description || '').trim();
  const category = (d.category || '').toLowerCase();
  const explicit = d.explicit || false;
  
  // Extract Taiwan equivalents from examples
  const twWords = new Set();
  if (d.examples && Array.isArray(d.examples)) {
    for (const ex of d.examples) {
      if (ex.words && Array.isArray(ex.words)) {
        for (const w of ex.words) {
          twWords.add(w);
        }
      }
    }
  }
  
  return { word, description, category, explicit, twWords: [...twWords] };
}

// Map invade category to our category
function mapCategory(cat) {
  const map = {
    'adjective': 'daily',
    'verb': 'daily',
    'noun': 'daily',
    'interjection': 'daily',
    'phrase': 'daily',
    'slang': 'daily',
  };
  return map[cat] || 'daily';
}

// Determine fork type
function determineForkType(twWords, cnWord) {
  // Most invade entries are E-type (CN internet slang not used in TW)
  return 'E';
}

// Sanitize filename
function sanitizeFilename(word) {
  return word.replace(/[\/\\:*?"<>|]/g, '_');
}

const { existing, existingTw } = loadExisting();
const invadeFiles = readdirSync(INVADE_DIR).filter(f => f.endsWith('.yml'));

let added = 0;
let skipped = 0;
let alreadyExists = 0;
let explicit_skipped = 0;
const newEntries = [];

for (const file of invadeFiles) {
  const raw = readFileSync(join(INVADE_DIR, file), 'utf-8');
  const entry = parseInvade(raw);
  if (!entry) { skipped++; continue; }
  
  // Skip explicit/vulgar content
  if (entry.explicit && !force) {
    explicit_skipped++;
    continue;
  }
  
  // Check if we already have this word
  if (existing.has(entry.word)) {
    alreadyExists++;
    continue;
  }
  
  // Check if any TW equivalent already maps to this
  let foundExisting = false;
  for (const tw of entry.twWords) {
    if (existingTw.has(tw) || existing.has(entry.word)) {
      foundExisting = true;
      break;
    }
  }
  // Also check if the CN word itself is in our taiwan column (same word both sides)
  if (existingTw.has(entry.word)) {
    foundExisting = true;
  }
  
  if (foundExisting && !force) {
    alreadyExists++;
    continue;
  }
  
  if (entry.twWords.length === 0) {
    skipped++;
    continue;
  }
  
  const taiwanDisplay = entry.twWords.join(' / ');
  const forkType = determineForkType(entry.twWords, entry.word);
  
  const newData = {
    id: sanitizeFilename(entry.word).toLowerCase(),
    category: mapCategory(entry.category),
    fork_type: forkType,
    display: {
      taiwan: taiwanDisplay,
      china: entry.word,
    },
    etymology: {
      origin: entry.description || `中國用語「${entry.word}」，台灣說「${taiwanDisplay}」。`,
    },
    notes: `來源：caris-events/invade (CC0)`,
    sources: ['https://github.com/caris-events/invade'],
    added: new Date().toISOString().split('T')[0],
  };
  
  const filename = `${sanitizeFilename(entry.word)}.yaml`;
  const filepath = join(TERM_DIR, filename);
  
  // Don't overwrite existing files
  if (existsSync(filepath) && !force) {
    alreadyExists++;
    continue;
  }
  
  if (dryRun) {
    console.log(`  📝 ${entry.word} → ${taiwanDisplay}`);
  } else {
    writeFileSync(filepath, stringifyYaml(newData, { lineWidth: 120 }), 'utf-8');
  }
  
  newEntries.push({ cn: entry.word, tw: taiwanDisplay });
  added++;
}

console.log(`\n📊 invade 導入結果:`);
console.log(`  ✅ 新增: ${added}`);
console.log(`  ⏭️  已存在: ${alreadyExists}`);
console.log(`  🔞 不雅跳過: ${explicit_skipped}`);
console.log(`  ⚠️  跳過(無台灣對應/解析失敗): ${skipped}`);
console.log(`  📦 invade 總數: ${invadeFiles.length}`);

if (dryRun) {
  console.log('\n  (dry run — no files changed)');
}

if (newEntries.length > 0 && !dryRun) {
  console.log(`\n📝 新增詞條列表:`);
  for (const e of newEntries.slice(0, 50)) {
    console.log(`  ${e.cn} → ${e.tw}`);
  }
  if (newEntries.length > 50) {
    console.log(`  ... 及其他 ${newEntries.length - 50} 筆`);
  }
}
