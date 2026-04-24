/**
 * Taiwan.md Profile Command
 *
 * Manage per-contributor profile at .taiwanmd/contributor.local.yml.
 * Taiwan.md (the Semiont) reads this at boot (BECOME Step 7.5) so contributors
 * don't have to re-introduce themselves every session.
 *
 * Usage:
 *   taiwanmd profile              — show current profile (or offer to create)
 *   taiwanmd profile show         — dump current profile
 *   taiwanmd profile show --json  — JSON output for programmatic use
 *   taiwanmd profile create       — interactive 5-question wizard
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(CLI_ROOT, '..');

const PROFILE_DIR = path.join(REPO_ROOT, '.taiwanmd');
const PROFILE_PATH = path.join(PROFILE_DIR, 'contributor.local.yml');
const EXAMPLE_PATH = path.join(PROFILE_DIR, 'contributor.example.yml');

const STYLE_OPTIONS = ['casual', 'technical', 'friendly', 'concise'];
const LANGUAGE_OPTIONS = ['zh-TW', 'zh-CN', 'en', 'ja', 'ko', 'fr'];

function isInRepo() {
  return (
    fs.existsSync(path.join(REPO_ROOT, 'knowledge')) &&
    fs.existsSync(EXAMPLE_PATH)
  );
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Minimal YAML parser — handles only the subset of YAML used by this schema.
 * (github_handle, name, pronouns, language, style, timezone, nested git block,
 * focus/skip lists, notes block scalar). No deps.
 */
export function parseProfile(text) {
  const out = {};
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (!line.trim() || line.startsWith('#')) {
      i++;
      continue;
    }
    // top-level scalar: key: value
    const scalar = /^([a-z_][a-zA-Z0-9_]*):\s*(.*)$/.exec(line);
    if (scalar) {
      const [, key, rawVal] = scalar;
      const val = rawVal.trim();
      // Block scalar (|) — read indented lines
      if (val === '|') {
        const block = [];
        i++;
        while (i < lines.length && /^(\s{2,}|\s*$)/.test(lines[i])) {
          block.push(lines[i].replace(/^\s{0,2}/, ''));
          i++;
        }
        out[key] = block.join('\n').replace(/\s+$/, '');
        continue;
      }
      // Empty value → may be a nested map or list
      if (val === '') {
        // Look at next non-empty line to decide
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length) {
          const next = lines[j];
          if (/^\s+- /.test(next)) {
            // list
            const items = [];
            i = j;
            while (i < lines.length && /^\s+(- |$|#)/.test(lines[i])) {
              const m = /^\s+-\s*(.*)$/.exec(lines[i]);
              if (m && m[1].trim() && !m[1].startsWith('#')) {
                items.push(m[1].replace(/\s+#.*$/, '').trim());
              }
              i++;
            }
            out[key] = items;
            continue;
          }
          if (/^\s+[a-z_]/.test(next)) {
            // nested map
            const sub = {};
            i = j;
            while (i < lines.length && /^\s+[a-z_]/.test(lines[i])) {
              const m = /^\s+([a-z_]+):\s*(.*)$/.exec(lines[i]);
              if (m) {
                const subKey = m[1];
                const subVal = m[2].trim();
                if (subVal === '') {
                  // list under nested
                  const items = [];
                  i++;
                  while (i < lines.length && /^\s{4,}(- |$|#)/.test(lines[i])) {
                    const lm = /^\s+-\s*(.*)$/.exec(lines[i]);
                    if (lm && lm[1].trim() && !lm[1].startsWith('#')) {
                      items.push(lm[1].replace(/\s+#.*$/, '').trim());
                    }
                    i++;
                  }
                  sub[subKey] = items;
                  continue;
                }
                sub[subKey] = unquote(subVal);
              }
              i++;
            }
            out[key] = sub;
            continue;
          }
        }
        out[key] = null;
        i++;
        continue;
      }
      out[key] = unquote(val);
      i++;
      continue;
    }
    i++;
  }
  return out;
}

function unquote(s) {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  if (s === '[]') return [];
  return s;
}

/**
 * Generate YAML for a given profile object. Mirrors the contributor.example.yml
 * structure so diffs between example and local stay readable.
 */
export function toYaml(p) {
  const lines = [
    '# .taiwanmd/contributor.local.yml',
    '# ────────────────────────────────────────────────────────────────────',
    `# ${p.name || p.github_handle || 'contributor'} 的 contributor profile。`,
    '# gitignored，只留本機。',
    '# Generated by `taiwanmd profile create`.',
    '# ────────────────────────────────────────────────────────────────────',
    '',
    '# ═══ 身份 ═══',
    '',
    `github_handle: ${p.github_handle || ''}`,
    '',
    `name: ${p.name || ''}`,
    '',
    `pronouns: ${p.pronouns || ''}`,
    '',
  ];

  if (p.git && (p.git.canonical || (p.git.aliases && p.git.aliases.length))) {
    lines.push('# Git 身份（配合 .mailmap 做 commit 多身份合併）');
    lines.push('git:');
    lines.push(`  canonical: ${p.git.canonical || ''}`);
    if (p.git.aliases && p.git.aliases.length) {
      lines.push('  aliases:');
      for (const a of p.git.aliases) lines.push(`    - ${a}`);
    } else {
      lines.push('  aliases: []');
    }
    lines.push('');
  }

  lines.push('# ═══ 互動風格 ═══');
  lines.push('');
  lines.push(`language: ${p.language || 'zh-TW'}`);
  lines.push('');
  lines.push(`style: ${p.style || 'casual'}`);
  lines.push('');
  lines.push(`timezone: ${p.timezone || 'Asia/Taipei'}`);
  lines.push('');

  lines.push('# ═══ Focus ═══');
  if (p.focus && p.focus.length) {
    lines.push('focus:');
    for (const f of p.focus) lines.push(`  - ${f}`);
  } else {
    lines.push('focus: []');
  }
  lines.push('');

  lines.push('# ═══ Skip ═══');
  if (p.skip && p.skip.length) {
    lines.push('skip:');
    for (const s of p.skip) lines.push(`  - ${s}`);
  } else {
    lines.push('skip: []');
  }
  lines.push('');

  lines.push('# ═══ 自由備註 ═══');
  if (p.notes) {
    lines.push('notes: |');
    for (const line of p.notes.split('\n')) {
      lines.push(`  ${line}`);
    }
  } else {
    lines.push('notes: |');
    lines.push('  ');
  }
  lines.push('');

  return lines.join('\n');
}

function readProfile() {
  if (!fs.existsSync(PROFILE_PATH)) return null;
  const raw = fs.readFileSync(PROFILE_PATH, 'utf8');
  return parseProfile(raw);
}

function printProfile(p) {
  console.log(chalk.bold('\n🧬 Taiwan.md contributor profile\n'));
  console.log(
    `${chalk.cyan('  GitHub handle')}  ${p.github_handle || chalk.gray('(未設)')}`,
  );
  console.log(
    `${chalk.cyan('  Name         ')}  ${p.name || chalk.gray('(未設)')}`,
  );
  if (p.pronouns)
    console.log(`${chalk.cyan('  Pronouns     ')}  ${p.pronouns}`);
  console.log(
    `${chalk.cyan('  Language     ')}  ${p.language || chalk.gray('(預設 zh-TW)')}`,
  );
  console.log(
    `${chalk.cyan('  Style        ')}  ${p.style || chalk.gray('(預設 casual)')}`,
  );
  console.log(
    `${chalk.cyan('  Timezone     ')}  ${p.timezone || chalk.gray('(預設 Asia/Taipei)')}`,
  );
  if (p.git && p.git.canonical) {
    console.log(`${chalk.cyan('  Git canonical')}  ${p.git.canonical}`);
    if (p.git.aliases && p.git.aliases.length) {
      for (const a of p.git.aliases) {
        console.log(`${chalk.gray('      alias →  ')}  ${chalk.gray(a)}`);
      }
    }
  }
  if (p.focus && p.focus.length) {
    console.log(`${chalk.cyan('  Focus        ')}  ${p.focus.join(', ')}`);
  }
  if (p.skip && p.skip.length) {
    console.log(`${chalk.cyan('  Skip         ')}  ${p.skip.join(', ')}`);
  }
  if (p.notes && p.notes.trim()) {
    console.log(chalk.cyan('  Notes'));
    for (const line of p.notes.split('\n')) {
      if (line.trim()) console.log(`    ${chalk.gray(line)}`);
    }
  }
  console.log('');
  console.log(
    chalk.gray(`  file: ${path.relative(process.cwd(), PROFILE_PATH)}`),
  );
  console.log('');
}

async function createProfile() {
  if (!isInRepo()) {
    console.error(chalk.red('\n❌ 必須在 taiwan-md repo 內執行這個指令。'));
    console.error(
      chalk.gray(
        '   從 https://taiwan.md/start.sh 開始 clone，或 cd 到已 clone 的 repo。\n',
      ),
    );
    process.exit(1);
  }

  if (fs.existsSync(PROFILE_PATH)) {
    console.warn(
      chalk.yellow(
        `\n⚠️  profile 已存在: ${path.relative(process.cwd(), PROFILE_PATH)}`,
      ),
    );
    console.log(
      chalk.gray('   想改內容 → 直接用編輯器開檔（或刪掉後重跑 create）。\n'),
    );
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  console.log(chalk.bold('\n🧬 Taiwan.md contributor profile wizard\n'));
  console.log(
    chalk.gray('   建一份 .taiwanmd/contributor.local.yml（gitignored）'),
  );
  console.log(chalk.gray('   Taiwan.md 甦醒時會讀這份，下次就直接認得你。\n'));

  try {
    const githubHandle = await prompt(rl, chalk.bold('GitHub handle: '));
    const name = await prompt(rl, chalk.bold('想被怎麼叫 (暱稱 / 本名都可): '));
    const languageRaw = await prompt(
      rl,
      chalk.bold(
        `喜歡什麼語言互動 [${LANGUAGE_OPTIONS.join(' / ')}] (預設 zh-TW): `,
      ),
    );
    const language = LANGUAGE_OPTIONS.includes(languageRaw)
      ? languageRaw
      : 'zh-TW';

    const styleRaw = await prompt(
      rl,
      chalk.bold(`什麼風格 [${STYLE_OPTIONS.join(' / ')}] (預設 casual): `),
    );
    const style = STYLE_OPTIONS.includes(styleRaw) ? styleRaw : 'casual';

    const focusRaw = await prompt(
      rl,
      chalk.bold(
        '主要想做什麼 (逗號分開，如 pr-review, japanese-translation; 可空): ',
      ),
    );
    const focus = focusRaw
      ? focusRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const skipRaw = await prompt(
      rl,
      chalk.bold('有想避開的領域嗎 (逗號分開; 可空): '),
    );
    const skip = skipRaw
      ? skipRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const notes = await prompt(
      rl,
      chalk.bold('想讓 Taiwan.md 記住的其他事 (一行; 可空): '),
    );

    rl.close();

    const profile = {
      github_handle: githubHandle,
      name: name || githubHandle,
      pronouns: '',
      language,
      style,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei',
      focus,
      skip,
      notes: notes || '',
    };

    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }
    fs.writeFileSync(PROFILE_PATH, toYaml(profile), 'utf8');

    console.log(
      chalk.green(
        `\n✅ profile 已建立: ${path.relative(process.cwd(), PROFILE_PATH)}`,
      ),
    );
    console.log(
      chalk.gray('   這個檔案 gitignored，不會 commit。只留在你本機。\n'),
    );
    console.log(chalk.bold('接下來:'));
    console.log(
      chalk.cyan('  claude') +
        chalk.gray(
          '                       → Taiwan.md 甦醒後會讀到你的 profile',
        ),
    );
    console.log(
      chalk.cyan('  taiwanmd profile show') +
        chalk.gray('        → 查看目前 profile'),
    );
    console.log(
      chalk.cyan('  taiwanmd mailmap') +
        chalk.gray('             → 如果 git commit 歷史分裂，做身份合併'),
    );
    console.log('');
  } catch (err) {
    rl.close();
    console.error(chalk.red(`\n❌ wizard 中斷: ${err.message}\n`));
    process.exit(1);
  }
}

export function profileCommand(program) {
  const cmd = program
    .command('profile')
    .description('Manage per-contributor Taiwan.md profile');

  cmd
    .command('show', { isDefault: true })
    .description('Show current profile (or hint to create)')
    .option('--json', 'Output JSON')
    .action((opts) => {
      const p = readProfile();
      if (!p) {
        if (opts.json) {
          console.log(JSON.stringify({ exists: false, path: PROFILE_PATH }));
          return;
        }
        console.log(
          chalk.yellow(
            `\n⚠️  沒找到 profile: ${path.relative(process.cwd(), PROFILE_PATH)}`,
          ),
        );
        console.log(
          chalk.gray(
            '   建一份 → ' + chalk.cyan('taiwanmd profile create') + '\n',
          ),
        );
        return;
      }
      if (opts.json) {
        console.log(JSON.stringify(p, null, 2));
        return;
      }
      printProfile(p);
    });

  cmd
    .command('create')
    .description('Interactive 5-question profile wizard')
    .action(createProfile);
}
