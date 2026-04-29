/**
 * Claude CLI spawner.
 *
 * Spawns the `claude` CLI as a child process with the prompt piped on stdin.
 * Streams stdout/stderr to a per-session log file under
 * `.harvest/tasks/{id}/sessions/{session-id}.log` and to pino.
 *
 * Hard timeout per session: config.sessionTimeoutMs (default 90 min).
 *
 * Bug 1 v2 (2026-04-27): commit attribution prefers `--grep=[sid:<short>]`
 * marker (prompt requires it) over the v1 time+author window, which mis-
 * attributed external commits during the spawn window.
 *
 * Bug 2 v2 (2026-04-27): earlier `detached:true` broke claude — it lost its
 * controlling terminal and stuck on stdin/keychain reads (verified with 3
 * spawns sleeping at 0% CPU for 8 minutes). Reverted. SIGINT cascade is now
 * accepted as a known limitation: when cheyu Ctrl+C's the backend in tmux,
 * children die too — but the shutdown handler marks active sessions
 * `awaiting-cheyu` in the DB before exit, and the orphan reconciler on next
 * startup cleans them up to `failed`. Fix `bash stop.sh && bash start.sh`
 * to restart cleanly without losing visibility.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.ts';
import { getDb } from '../db/client.ts';
import { child as childLogger } from '../logger.ts';
import { saveTask } from '../tasks/manager.ts';
import type { Task, TaskSession } from '../tasks/types.ts';
import { buildSpawnPrompt } from './prompt-builder.ts';
import {
  tryRegister as tryRegisterActive,
  setPhase as setActivePhase,
  unregister as unregisterActive,
} from './concurrency.ts';
import { createWorktree, finalizeWorktree, type Worktree } from './worktree.ts';
import { recordSpawnedSession } from '../scheduler/session-counter.ts';

/**
 * Default model + engine per task type.
 *
 * Phase 5 (2026-04-29): Cheyu's policy — DEFAULT EVERYTHING TO CLAUDE OPUS.
 * Only simple/mechanical tasks get cheaper alternatives (Sonnet) or
 * external engines (codex/ollama). Override via task.inputs.{model,engine}.
 *
 *   tier 1 — simple / mechanical (codex / ollama eligible after testing):
 *     data-refresh / format-check / status-report
 *   tier 2 — translation (Sonnet OK; codex/ollama eligible after testing):
 *     lang-sync-refresh / lang-sync-translate
 *   tier 3 — heavy creation / decision (always Opus claude):
 *     article-rewrite / article-evolve / article-new / pr-review /
 *     issue-handle / spore-publish / contributor-thank-you / self-diagnose
 */
/**
 * Default model lookup is engine-aware: claude / codex / ollama have
 * different model namespaces. Picking sonnet for codex would be a 400.
 */
const DEFAULT_MODEL_BY_ENGINE_TYPE: Record<string, Record<string, string>> = {
  claude: {
    // tier 2 — translation (Sonnet)
    'lang-sync-refresh': 'claude-sonnet-4-6',
    'lang-sync-translate': 'claude-sonnet-4-6',
    // tier 1 — mechanical (Sonnet)
    'data-refresh': 'claude-sonnet-4-6',
    'format-check': 'claude-sonnet-4-6',
    'status-report': 'claude-sonnet-4-6',
    // tier 3 — heavy (Opus)
    'article-rewrite': 'claude-opus-4-6',
    'article-evolve': 'claude-opus-4-6',
    'article-new': 'claude-opus-4-6',
    'pr-review': 'claude-opus-4-6',
    'issue-handle': 'claude-opus-4-6',
    'spore-publish': 'claude-opus-4-6',
    'contributor-thank-you': 'claude-opus-4-6',
    'self-diagnose': 'claude-opus-4-6',
  },
  codex: {
    // codex CLI default model on ChatGPT account (gpt-5 / o3 etc auto)
    // Leaving empty = let codex CLI use its account default; we just don't
    // pass -m if no override. Spawner handles via taskModel === '' branch.
    'lang-sync-refresh': '',
    'lang-sync-translate': '',
    'data-refresh': '',
    'format-check': '',
    'status-report': '',
  },
  ollama: {
    // qwen3.5:35b-a3b-coding-nvfp4 is cheyu's local default for code/translation
    'lang-sync-refresh': 'qwen3.5:35b-a3b-coding-nvfp4',
    'lang-sync-translate': 'qwen3.5:35b-a3b-coding-nvfp4',
    'data-refresh': 'qwen3.5:35b-a3b-coding-nvfp4',
    'format-check': 'qwen3.5:35b-a3b-coding-nvfp4',
    'status-report': 'qwen3.5:35b-a3b-coding-nvfp4',
  },
};

/**
 * Task types eligible for non-claude engine experimentation. UI / API can
 * route these to codex or ollama via task.inputs.engine. Other types stay
 * on claude even if engine override is requested (safer default for v1).
 */
const ENGINE_ELIGIBLE_TIER: Record<string, 'simple' | 'heavy'> = {
  'data-refresh': 'simple',
  'format-check': 'simple',
  'status-report': 'simple',
  'lang-sync-refresh': 'simple',
  'lang-sync-translate': 'simple',
};

export class ConcurrencyLimitError extends Error {
  constructor() {
    super('max concurrent sessions reached');
    this.name = 'ConcurrencyLimitError';
  }
}

const log = childLogger({ module: 'spawner/claude-cli' });

export interface SpawnResult {
  sessionId: string;
  exitCode: number;
  durationMs: number;
  logPath: string;
  promptPath: string;
  /** Commits this session produced (best-effort, parsed via session-scoped git log). */
  commits: string[];
  /** True when the hard timeout fired and we killed the process. */
  timedOut: boolean;
}

export interface SpawnOptions {
  /** Skip actually running claude — only build the prompt and persist it. */
  dryRun?: boolean;
}

/**
 * Spawn a `claude` process for a given Task. Returns once the child exits or
 * the hard timeout fires.
 */
export async function spawnClaudeForTask(
  task: Task,
  options: SpawnOptions = {},
): Promise<SpawnResult> {
  const sessionId = randomUUID();
  const sessionsDir = join(task.folder_path, 'sessions');
  mkdirSync(sessionsDir, { recursive: true });
  const logPath = join(sessionsDir, `${sessionId}.log`);
  const promptPath = join(sessionsDir, `${sessionId}.prompt.md`);

  const spawnedAt = new Date();
  const spawnStartIso = spawnedAt.toISOString();

  // Race fix: reserve the concurrency slot SYNCHRONOUSLY before any await.
  // Otherwise the auto-spawn loop's canSpawn() check sees stale state while
  // earlier iterations are still mid-await on createWorktree, and N>max
  // sessions can register (verified 2026-04-27 — 9 sessions ran with max=3).
  if (!options.dryRun) {
    const reserved = tryRegisterActive({
      sessionId,
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.type,
      bootProfile: task.boot_profile,
      pid: undefined,
      spawnedAt: spawnStartIso,
      phase: 'spawning',
    });
    if (!reserved) throw new ConcurrencyLimitError();
  }

  // Worktree isolation per spawn (after reservation so we don't create
  // worktrees we won't use).
  //
  // Phase 5.1 (2026-04-30): worktree is now an explicit task input arg.
  // - task.inputs.worktree === false → run in main repo (no isolation)
  // - any other value (or absent)     → default ON (fresh worktree per spawn)
  // Cheyu's rule: 「以後預設都要開 worktree (這也變成任務 arg 選項)，避免大幅碰撞」
  // — every PR review / article / lang-sync task gets its own worktree by
  // default to prevent multi-session collision on shared files.
  const wantWorktree = task.inputs?.worktree !== false;
  let worktree: Worktree | null = null;
  if (!options.dryRun && wantWorktree) {
    try {
      worktree = await createWorktree(sessionId, task.id);
    } catch (err) {
      unregisterActive(sessionId);
      log.error(
        { taskId: task.id, sessionId, error: String(err) },
        'failed to create worktree — aborting spawn',
      );
      throw err;
    }
  } else if (!options.dryRun && !wantWorktree) {
    log.info(
      { taskId: task.id, sessionId },
      'worktree explicitly disabled via task.inputs.worktree=false — running in main repo',
    );
  }

  const prompt = buildSpawnPrompt(task, sessionId, worktree);
  writeFileSync(promptPath, prompt, 'utf8');

  const sessionRecord: TaskSession = {
    id: sessionId,
    spawned_at: spawnStartIso,
    log_path: logPath,
    prompt_path: promptPath,
  };
  task.sessions.push(sessionRecord);
  task.attempts += 1;
  task.status = 'spawning';
  saveTask(task, `spawn attempt ${task.attempts} session=${sessionId}`);

  const db = getDb();
  db.run(
    `INSERT INTO sessions (id, task_id, pid, spawned_at, spawn_start_iso, log_path, prompt_path, worktree_path, worktree_branch)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      task.id,
      spawnStartIso,
      spawnStartIso,
      logPath,
      promptPath,
      worktree?.path ?? null,
      worktree?.branch ?? null,
    ],
  );

  if (options.dryRun) {
    log.info(
      { taskId: task.id, sessionId, logPath },
      'dryRun=true — skipping claude exec',
    );
    sessionRecord.completed_at = new Date().toISOString();
    sessionRecord.exit_code = 0;
    task.status = 'pending';
    saveTask(task, 'dry-run complete (no claude exec)');
    unregisterActive(sessionId);
    return {
      sessionId,
      exitCode: 0,
      durationMs: 0,
      logPath,
      promptPath,
      commits: [],
      timedOut: false,
    };
  }

  task.status = 'in-progress';
  saveTask(task, `claude session ${sessionId} starting`);

  // Engine selection (resolve FIRST so model lookup is engine-aware).
  // Only simple-tier task types accept engine override; heavy tasks force claude.
  const requestedEngine =
    (task.inputs?.engine as string | undefined) ?? 'claude';
  const tier = ENGINE_ELIGIBLE_TIER[task.type];
  const taskEngine = tier === 'simple' ? requestedEngine : 'claude';

  // Engine-aware default model lookup. Falls back to claude-sonnet-4-6 for
  // unmapped task types on claude engine; codex / ollama use their own tables.
  const engineDefaults = DEFAULT_MODEL_BY_ENGINE_TYPE[taskEngine] ?? {};
  const taskModel =
    (task.inputs?.model as string | undefined) ??
    engineDefaults[task.type] ??
    (taskEngine === 'claude' ? 'claude-sonnet-4-6' : '');
  const gitHead = (() => {
    try {
      return require('node:child_process')
        .execSync('git rev-parse --short HEAD', {
          cwd: worktree?.path ?? config.repoRoot,
          encoding: 'utf8',
        })
        .trim();
    } catch {
      return 'unknown';
    }
  })();

  const logStream = createWriteStream(logPath, { flags: 'a' });
  // Rich metadata header for future diagnostics: model attribution, timing,
  // worktree branch, git head, task inputs snapshot. Anything we might want
  // to grep later when comparing successful vs failed runs.
  const metadataHeader = [
    `# ═══ Session metadata ═══`,
    `# session_id:        ${sessionId}`,
    `# task_id:           ${task.id}`,
    `# task_type:         ${task.type}`,
    `# task_priority:     ${task.priority}`,
    `# task_title:        ${task.title}`,
    `# boot_profile:      ${task.boot_profile}`,
    `# engine:            ${taskEngine}`,
    `# model:             ${taskModel}`,
    `# claude_bin:        ${config.claudeBin}`,
    `# spawn_attempt:     ${task.attempts}`,
    `# spawned_at_iso:    ${spawnStartIso}`,
    `# spawned_at_local:  ${spawnedAt.toString()}`,
    `# worktree_path:     ${worktree?.path ?? '(none)'}`,
    `# worktree_branch:   ${worktree?.branch ?? '(none)'}`,
    `# repo_head:         ${gitHead}`,
    `# inputs:            ${JSON.stringify(task.inputs ?? {})}`,
    `# host:              ${require('node:os').hostname()}`,
    `# node_version:      ${process.version}`,
    `# bun_version:       ${process.versions.bun ?? 'n/a'}`,
    `# pid_parent:        ${process.pid}`,
    `# ═════════════════════════`,
    '',
    '',
  ].join('\n');
  logStream.write(metadataHeader);

  // ════════════════════════════════════════════════════════════════
  // Engine dispatch — claude / codex / ollama (via codex --oss)
  // task.inputs.engine selects; default 'claude'.
  // For codex: optional task.inputs.codexLocalProvider ('ollama' | 'lmstudio')
  // routes to local OSS provider; otherwise ChatGPT subscription default model.
  // ════════════════════════════════════════════════════════════════
  let engineBin: string;
  let cliArgs: string[];
  if (taskEngine === 'codex' || taskEngine === 'ollama') {
    engineBin = 'codex';
    cliArgs = ['exec', '--json', '--full-auto', '--skip-git-repo-check'];
    if (taskModel) cliArgs.push('-m', taskModel);
    // 'ollama' alias = codex with --oss --local-provider=ollama
    if (taskEngine === 'ollama') {
      cliArgs.push('--oss', '--local-provider=ollama');
    } else if (task.inputs?.codexLocalProvider) {
      cliArgs.push(
        '--oss',
        `--local-provider=${task.inputs.codexLocalProvider}`,
      );
    }
    if (worktree?.path) {
      cliArgs.push('-C', worktree.path);
    }
  } else {
    // claude (default)
    engineBin = config.claudeBin;
    cliArgs = [
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--model',
      taskModel,
      '--dangerously-skip-permissions',
    ];
    if (process.env.ANTHROPIC_API_KEY) cliArgs.unshift('--bare');
  }

  // Bug 2 v2: detached:true broke spawned claude (no controlling terminal →
  // stuck on stdin/keychain). Reverted. SIGINT cascade prevention is now done
  // upstream in tmux start.sh via `setsid bun ...` so bun gets its own session
  // and tmux's SIGINT no longer reaches our spawned children.
  log.info(
    {
      taskId: task.id,
      sessionId,
      engine: taskEngine,
      model: taskModel,
      bin: engineBin,
      args: cliArgs,
    },
    'spawning agent',
  );
  const child = spawn(engineBin, cliArgs, {
    cwd: worktree?.path ?? config.repoRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HARVEST_TASK_ID: task.id,
      HARVEST_SESSION_ID: sessionId,
      HARVEST_SESSION_SHORT: sessionId.slice(0, 8),
      HARVEST_WORKTREE_PATH: worktree?.path ?? '',
      HARVEST_WORKTREE_BRANCH: worktree?.branch ?? '',
      HARVEST_ENGINE: taskEngine,
      HARVEST_MODEL: taskModel,
      HARVEST_ALLOW_SELF_COMMIT:
        task.inputs?.allow_self_commit === false ? 'false' : 'true',
    },
  });

  db.run('UPDATE sessions SET pid = ? WHERE id = ?', [
    child.pid ?? null,
    sessionId,
  ]);
  setActivePhase(sessionId, 'in-progress', child.pid);
  log.info({ taskId: task.id, sessionId, pid: child.pid }, 'spawned claude');
  // Phase 5: track session count → trigger Master Review every 10 sessions.
  // Skip when the task itself is a self-diagnose / Master Review (no recursion).
  if (task.type !== 'self-diagnose') {
    try {
      recordSpawnedSession();
    } catch (err) {
      log.warn({ err: String(err) }, 'session counter failed (non-fatal)');
    }
  }

  child.stdin.write(prompt);
  child.stdin.end();
  child.stdout.on('data', (chunk: Buffer) => logStream.write(chunk));
  child.stderr.on('data', (chunk: Buffer) => logStream.write(chunk));

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    log.warn(
      { taskId: task.id, sessionId, timeoutMs: config.sessionTimeoutMs },
      'hard timeout — killing claude',
    );
    try {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
    setTimeout(() => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, 5_000);
  }, config.sessionTimeoutMs);

  const exitCode: number = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? -1));
    child.on('error', (err) => {
      logStream.write(`\n[spawner] error: ${String(err)}\n`);
      resolve(-1);
    });
  });
  clearTimeout(timeout);
  logStream.end();

  const completedAt = new Date();
  sessionRecord.completed_at = completedAt.toISOString();
  sessionRecord.exit_code = exitCode;

  // Worktree finalize: when worktree-isolated, count commits on the branch
  // (not via main-repo log) since they're not yet in main HEAD's history.
  // Then merge branch back to main + remove worktree (or keep on failure).
  let commits: string[] = [];
  if (worktree) {
    commits = await commitsOnBranch(worktree.branch);
    const failed = exitCode !== 0 || timedOut;
    const result = await finalizeWorktree(worktree, {
      failed,
      commitsCount: commits.length,
    });
    if (result.conflicts) {
      logStream.write(
        `\n[spawner] WARNING: merge conflict on branch ${worktree.branch} — worktree kept at ${worktree.path}\n`,
      );
    }
    if (result.merged && commits.length > 0) {
      try {
        await runGit(['push', 'origin', 'HEAD']);
      } catch (err) {
        logStream.write(`\n[spawner] git push failed: ${String(err)}\n`);
      }
    }
  } else {
    // dryRun or worktree-disabled fallback: use legacy session-marker grep
    commits = await commitsInWindow(
      spawnStartIso,
      completedAt,
      sessionId.slice(0, 8),
    );
  }
  if (commits.length) sessionRecord.commits = commits;

  db.run('UPDATE sessions SET completed_at = ?, exit_code = ? WHERE id = ?', [
    sessionRecord.completed_at,
    exitCode,
    sessionId,
  ]);
  if (commits.length) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO session_commits (session_id, commit_hash) VALUES (?, ?)',
    );
    for (const c of commits) stmt.run(sessionId, c);
  }

  task.status = inferStatusFromExit(exitCode, timedOut);
  saveTask(
    task,
    `claude session ${sessionId} exited code=${exitCode} timedOut=${timedOut}`,
  );

  unregisterActive(sessionId);

  log.info(
    { taskId: task.id, sessionId, exitCode, timedOut, commits: commits.length },
    'claude session ended',
  );

  return {
    sessionId,
    exitCode,
    durationMs: completedAt.getTime() - spawnedAt.getTime(),
    logPath,
    promptPath,
    commits,
    timedOut,
  };
}

function inferStatusFromExit(
  exitCode: number,
  timedOut: boolean,
): Task['status'] {
  if (timedOut) return 'failed';
  if (exitCode === 0) return 'done';
  return 'failed';
}

/**
 * Find commits this session authored.
 *
 * Primary: grep for the session marker `[sid:<short>]` injected via prompt.
 * Fallback: if no marker matches, fall back to the v1 time+author window so
 * legacy commits or sessions where claude forgot the marker still attribute.
 */
async function commitsInWindow(
  fromIso: string,
  toDate: Date,
  sidShort: string,
): Promise<string[]> {
  try {
    const sinceUntil = [
      `--since=${fromIso}`,
      `--until=${toDate.toISOString()}`,
    ];
    const grepOut = await runGit([
      'log',
      '--pretty=%H',
      `--grep=[sid:${sidShort}]`,
      '--fixed-strings',
      ...sinceUntil,
    ]);
    const marked = grepOut
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (marked.length) return marked;

    const author = (
      await runGit(['config', 'user.name']).catch(() => '')
    ).trim();
    const args = ['log', '--pretty=%H', ...sinceUntil];
    if (author) args.push(`--author=${author}`);
    const out = await runGit(args);
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function commitsOnBranch(branch: string): Promise<string[]> {
  try {
    const out = await runGit(['log', '--pretty=%H', `${branch}`, '^HEAD']);
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
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
