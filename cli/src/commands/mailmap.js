/**
 * Taiwan.md Mailmap Command
 *
 * Inspect and manage repo .mailmap for consolidating scattered git commit
 * identities. Git native feature: .mailmap maps {commit-name, commit-email}
 * to a canonical {name, email} so `git shortlog` / `git log --format=%aN`
 * / GitHub contributor graph all treat them as one person.
 *
 * Usage:
 *   taiwanmd mailmap                 — list all commit identities + consolidation state
 *   taiwanmd mailmap scan --mine     — find your own identity variants (via git config user.email)
 *   taiwanmd mailmap add             — interactive: add a new canonical + aliases block
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(CLI_ROOT, '..');
const MAILMAP_PATH = path.join(REPO_ROOT, '.mailmap');

function isInRepo() {
  try {
    return (
      fs.existsSync(path.join(REPO_ROOT, 'knowledge')) &&
      fs.existsSync(path.join(REPO_ROOT, '.git'))
    );
  } catch {
    return false;
  }
}

function git(args) {
  return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/**
 * Pull all commit identities from git log. Returns:
 *   [{ name, email, count, canonicalName, canonicalEmail }]
 * sorted by count desc. `canonical*` reflect the post-mailmap mapping.
 */
export function collectIdentities() {
  const raw = git(`log --format='%an|%ae|%aN|%aE' --all`).trim();
  const counts = new Map();
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const [name, email, cName, cEmail] = line.split('|');
    const key = `${name}|${email}`;
    const prev = counts.get(key) || {
      name,
      email,
      canonicalName: cName,
      canonicalEmail: cEmail,
      count: 0,
    };
    prev.count++;
    counts.set(key, prev);
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

function formatIdentity(id) {
  return `${id.name} <${id.email}>`;
}

function isConsolidated(id) {
  return id.name !== id.canonicalName || id.email !== id.canonicalEmail;
}

function printScan(identities, mine = null) {
  console.log(chalk.bold('\n🧬 Git commit identities\n'));

  const filtered = mine
    ? identities.filter(
        (id) =>
          id.email.toLowerCase().includes(mine.toLowerCase()) ||
          id.name.toLowerCase().includes(mine.toLowerCase()),
      )
    : identities;

  if (!filtered.length) {
    console.log(chalk.gray(`  沒有找到符合 "${mine}" 的 commit 身份。\n`));
    return;
  }

  for (const id of filtered) {
    const consolidated = isConsolidated(id);
    const commitStr = chalk.gray(`${String(id.count).padStart(5)} commits`);
    const identityStr = formatIdentity(id);
    if (consolidated) {
      const canonical = `${id.canonicalName} <${id.canonicalEmail}>`;
      console.log(
        `  ${commitStr}  ${chalk.yellow(identityStr)}\n` +
          `  ${' '.repeat(14)}  ${chalk.green('→')} ${chalk.cyan(canonical)} ${chalk.gray('(via .mailmap)')}`,
      );
    } else {
      console.log(`  ${commitStr}  ${identityStr}`);
    }
  }

  if (mine) {
    const total = filtered.reduce((s, id) => s + id.count, 0);
    const canonicalGroups = new Set(
      filtered.map((id) => `${id.canonicalName}|${id.canonicalEmail}`),
    );
    console.log('');
    console.log(
      chalk.gray(
        `  符合 "${mine}" 的 commits: ${total} 次，合併後 ${canonicalGroups.size} 個身份。`,
      ),
    );
    if (canonicalGroups.size > 1) {
      console.log(
        chalk.yellow(
          '  ⚠️  還有分裂。考慮跑 `taiwanmd mailmap add` 把剩下的合併起來。',
        ),
      );
    }
  }
  console.log('');
}

async function addEntry() {
  if (!isInRepo()) {
    console.error(chalk.red('\n❌ 必須在 taiwan-md repo 內執行。\n'));
    process.exit(1);
  }

  const identities = collectIdentities();
  const unconsolidated = identities.filter((id) => !isConsolidated(id));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  console.log(chalk.bold('\n🧬 Mailmap — add canonical + aliases\n'));
  console.log(
    chalk.gray('   把你在 git 歷史裡散掉的身份合併成一個 canonical。'),
  );
  console.log(chalk.gray('   這會修改 .mailmap（repo 共享，要 PR）。\n'));

  try {
    const canonical = await prompt(
      rl,
      chalk.bold('Canonical identity (格式: Name <email>): '),
    );
    if (!/^.+\s+<[^>]+>$/.test(canonical)) {
      rl.close();
      console.error(chalk.red('\n❌ 格式錯誤。要 "Name <email>" 這樣。\n'));
      process.exit(1);
    }

    console.log(chalk.gray('\n   未合併的 commit 身份 (前 15 名)：'));
    const top = unconsolidated.slice(0, 15);
    top.forEach((id, i) => {
      console.log(
        `   ${chalk.cyan(String(i + 1).padStart(2))}. ${formatIdentity(id)} ${chalk.gray(`(${id.count} commits)`)}`,
      );
    });
    console.log('');

    const sel = await prompt(
      rl,
      chalk.bold('要當 alias 的編號 (逗號分開，如 1,3,5; 空白取消): '),
    );
    rl.close();

    if (!sel) {
      console.log(chalk.gray('\n取消。\n'));
      return;
    }

    const indices = sel
      .split(',')
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((n) => n >= 0 && n < top.length);

    if (!indices.length) {
      console.error(chalk.red('\n❌ 沒有選到合法的編號。\n'));
      process.exit(1);
    }

    const aliases = indices.map((i) => top[i]);
    const entries = aliases
      .map((a) => `${canonical} ${formatIdentity(a)}`)
      .join('\n');

    const banner = `\n# Added by taiwanmd mailmap on ${new Date().toISOString().slice(0, 10)}`;
    const newBlock = `${banner}\n${entries}\n`;

    // Preview
    console.log(chalk.bold('\n即將 append 到 .mailmap:\n'));
    console.log(chalk.gray(newBlock));

    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
    const confirm = await prompt(rl2, chalk.bold('確認？(y/N): '));
    rl2.close();

    if (!/^y(es)?$/i.test(confirm)) {
      console.log(chalk.gray('\n取消，沒動 .mailmap。\n'));
      return;
    }

    fs.appendFileSync(MAILMAP_PATH, newBlock, 'utf8');

    console.log(
      chalk.green(
        `\n✅ 寫入 .mailmap: ${aliases.length} aliases 合併到 canonical。`,
      ),
    );
    console.log(
      chalk.gray('   驗證: `git log --format=%aN | sort -u | grep ...`'),
    );
    console.log(
      chalk.gray(
        '   .mailmap 是 repo 共享的，提 PR commit 進去 git 歷史才完整合併。\n',
      ),
    );
  } catch (err) {
    rl.close();
    console.error(chalk.red(`\n❌ 失敗: ${err.message}\n`));
    process.exit(1);
  }
}

export function mailmapCommand(program) {
  const cmd = program
    .command('mailmap')
    .description(
      'Inspect + manage .mailmap (git commit identity consolidation)',
    );

  cmd
    .command('scan', { isDefault: true })
    .description('List commit identities and consolidation state')
    .option(
      '--mine',
      'Filter to your identity variants (via git config user.email)',
    )
    .option('--match <keyword>', 'Filter by name/email keyword')
    .option('--json', 'Output JSON')
    .action((opts) => {
      if (!isInRepo()) {
        console.error(chalk.red('\n❌ 必須在 taiwan-md repo 內執行。\n'));
        process.exit(1);
      }
      const identities = collectIdentities();
      let filter = opts.match || null;
      if (opts.mine && !filter) {
        try {
          filter = git('config user.email').trim();
        } catch {
          filter = null;
        }
      }
      if (opts.json) {
        const out = filter
          ? identities.filter(
              (id) =>
                id.email.toLowerCase().includes(filter.toLowerCase()) ||
                id.name.toLowerCase().includes(filter.toLowerCase()),
            )
          : identities;
        console.log(JSON.stringify(out, null, 2));
        return;
      }
      printScan(identities, filter);
    });

  cmd
    .command('add')
    .description('Interactive: add canonical + aliases block to .mailmap')
    .action(addEntry);
}
