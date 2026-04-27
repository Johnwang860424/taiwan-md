/**
 * Per-spawn git worktree isolation.
 *
 * Why: multiple concurrent spawns sharing one working tree race on `git add`
 * and clobber each other's commits (verified 2026-04-27 — 沈伯洋 spawn
 * accidentally committed 魚條's files because both ran `git add .` in parallel).
 *
 * Solution: every spawn gets its own `git worktree` rooted at
 * `.harvest/worktrees/<sid-short>/` on a branch `harvest/<task-id>-<sid-short>`.
 * The spawn's cwd is the worktree, so its git operations are fully isolated.
 * After the spawn exits, the engine merges the branch back into main and
 * removes the worktree (or keeps it for inspection if exit was non-zero).
 */

import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { config } from '../config.ts';
import { child as childLogger } from '../logger.ts';

const log = childLogger({ module: 'spawner/worktree' });

export interface Worktree {
  path: string;
  branch: string;
}

export async function createWorktree(
  sessionId: string,
  taskId: string,
): Promise<Worktree> {
  const sidShort = sessionId.slice(0, 8);
  const safeTaskSlug = taskId.slice(0, 60).replace(/[^\w-]/g, '_');
  const branch = `harvest/${safeTaskSlug}-${sidShort}`;
  const path = join(config.repoRoot, '.harvest', 'worktrees', sidShort);

  mkdirSync(dirname(path), { recursive: true });
  await runGit(['worktree', 'remove', '--force', path]).catch(() => {});
  await runGit(['branch', '-D', branch]).catch(() => {});
  await runGit(['worktree', 'add', '-b', branch, path, 'HEAD']);

  log.info({ sessionId, taskId, path, branch }, 'created worktree');
  return { path, branch };
}

export interface FinalizeResult {
  merged: boolean;
  conflicts: boolean;
  removed: boolean;
}

/**
 * After spawn exits: merge branch back to current HEAD (fast-forward when
 * possible, else a real merge commit), then remove the worktree + branch.
 *
 * On `failed=true` we skip the merge and KEEP the worktree (cheyu can
 * inspect what the failed spawn left behind). The branch lingers too.
 */
export async function finalizeWorktree(
  wt: Worktree,
  opts: { failed: boolean; commitsCount: number },
): Promise<FinalizeResult> {
  if (opts.failed) {
    log.warn(
      { ...wt, commitsCount: opts.commitsCount },
      'spawn failed — keeping worktree + branch for inspection',
    );
    return { merged: false, conflicts: false, removed: false };
  }

  if (opts.commitsCount === 0) {
    log.info(wt, 'no commits to merge — removing worktree + branch');
    await safeRemoveWorktree(wt);
    return { merged: true, conflicts: false, removed: true };
  }

  let merged = false;
  let conflicts = false;
  try {
    await runGit(['merge', '--ff-only', wt.branch]);
    merged = true;
  } catch {
    try {
      await runGit([
        'merge',
        '--no-ff',
        '-m',
        `🧬 [semiont] merge harvest worktree ${wt.branch}`,
        wt.branch,
      ]);
      merged = true;
    } catch (err) {
      conflicts = true;
      log.error(
        { ...wt, error: String(err) },
        'merge failed — leaving worktree + branch for cheyu',
      );
      await runGit(['merge', '--abort']).catch(() => {});
      return { merged: false, conflicts: true, removed: false };
    }
  }

  await safeRemoveWorktree(wt);
  return { merged, conflicts, removed: true };
}

async function safeRemoveWorktree(wt: Worktree): Promise<void> {
  await runGit(['worktree', 'remove', '--force', wt.path]).catch((err) => {
    log.warn({ ...wt, error: String(err) }, 'worktree remove failed');
  });
  await runGit(['branch', '-D', wt.branch]).catch(() => {});
}

/**
 * On backend startup: prune dead worktree records (their dirs got nuked
 * externally) and warn about any harvest worktrees still on disk so cheyu
 * can decide whether to remove them.
 */
export async function cleanupStaleWorktrees(): Promise<void> {
  await runGit(['worktree', 'prune']).catch(() => {});
  try {
    const list = await runGit(['worktree', 'list', '--porcelain']);
    const harvestWts = list
      .split('\n\n')
      .filter((block) => block.includes('.harvest/worktrees/'));
    if (harvestWts.length) {
      log.warn(
        { count: harvestWts.length },
        'stale harvest worktrees on disk — likely from previous backend crash; inspect or remove manually',
      );
    }
  } catch {
    // ignore
  }
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: config.repoRoot });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`git ${args.join(' ')} exit ${code}: ${stderr}`));
    });
  });
}
