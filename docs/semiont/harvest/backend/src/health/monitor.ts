/**
 * Phase 3 — Health Monitor.
 *
 * Sub-features:
 *   3a. Stuck detector (output.log mtime > stuckThresholdMin → SIGTERM/SIGKILL → requeue/fail)
 *   3b. 偷懶 keyword detection (post-session commit scan → auto-spawn polish)
 *   3c. Quality gate auto-runner (footnote / manifesto-11 / format-check) → polish task
 *   3d. Cancel propagation (separate endpoint wires here)
 *   3e. ENOTFOUND/ECONNRESET/ETIMEDOUT → auto-requeue with cooldown
 *
 * Runs as a setInterval tick — config.healthPollSec (default 60s).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import { getDb } from '../db/client.ts';
import { child as childLogger } from '../logger.ts';
import { isPaused } from '../scheduler/cron.ts';
import { killSession, listActive, unregister } from '../spawner/concurrency.ts';
import { getTask, createTask, saveTask } from '../tasks/manager.ts';
import type { Task } from '../tasks/types.ts';

const log = childLogger({ module: 'health/monitor' });

const LAZY_KEYWORDS = [
  'TODO',
  'skip',
  '簡化',
  '簡略',
  '先這樣',
  'placeholder',
  'hack',
];

const RETRYABLE_NETWORK_ERRORS = ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'];

let timer: ReturnType<typeof setInterval> | null = null;
let recentlyHandled: Set<string> = new Set();

export function startHealthMonitor(): void {
  if (timer) return;
  if (config.disableHealthMonitor) {
    log.info('health monitor disabled via env');
    return;
  }
  const intervalMs = config.healthPollSec * 1000;
  timer = setInterval(() => {
    tick().catch((err) =>
      log.error({ err: String(err) }, 'health tick failed'),
    );
  }, intervalMs);
  log.info({ intervalMs }, 'health monitor started');
}

export function stopHealthMonitor(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

async function tick(): Promise<void> {
  if (isPaused()) return;
  detectStuck();
  // Post-session checks (lazy / quality / network retry) are reactive — they
  // run when a session enters the DB with completed_at set. We re-scan
  // recent sessions every tick to catch any we missed (idempotent via
  // recentlyHandled set + DB markers).
  await scanRecentlyCompletedSessions();
}

/** 3a — kill sessions whose output.log hasn't been touched in N minutes. */
function detectStuck(): void {
  const sessions = listActive();
  const now = Date.now();
  const limitMs = config.stuckThresholdMin * 60_000;
  for (const s of sessions) {
    const task = getTask(s.taskId);
    if (!task) continue;
    const sessionRecord = task.sessions.find((sr) => sr.id === s.sessionId);
    const logPath = sessionRecord?.log_path;
    if (!logPath || !existsSync(logPath)) continue;
    let mtime = 0;
    try {
      mtime = statSync(logPath).mtimeMs;
    } catch {
      continue;
    }
    const idleMs = now - mtime;
    if (idleMs < limitMs) continue;

    log.warn(
      {
        sessionId: s.sessionId,
        taskId: s.taskId,
        idleMin: Math.round(idleMs / 60_000),
        threshold: config.stuckThresholdMin,
      },
      'stuck session — escalating SIGTERM',
    );
    const term = killSession(s.sessionId, 'SIGTERM');
    setTimeout(() => {
      const stillThere = listActive().find((x) => x.sessionId === s.sessionId);
      if (stillThere) {
        log.warn(
          { sessionId: s.sessionId },
          'SIGTERM ignored — escalating SIGKILL',
        );
        killSession(s.sessionId, 'SIGKILL');
        setTimeout(() => unregister(s.sessionId), 2_000);
      }
    }, 10_000);

    const note = `stuck >${config.stuckThresholdMin}min, killed by health monitor (${term.reason})`;
    if (sessionRecord) {
      sessionRecord.exit_code = -2;
      sessionRecord.completed_at = new Date().toISOString();
    }
    task.status = 'failed';
    saveTask(task, note);

    const db = getDb();
    db.run(
      `UPDATE sessions SET completed_at = ?, exit_code = -2, killed_reason = ? WHERE id = ?`,
      [new Date().toISOString(), note, s.sessionId],
    );

    if (task.attempts < task.max_attempts) {
      task.status = 'pending';
      saveTask(
        task,
        `requeued after stuck kill (attempt ${task.attempts}/${task.max_attempts})`,
      );
      log.info({ taskId: task.id }, 'task requeued after stuck kill');
    } else {
      log.warn(
        { taskId: task.id, attempts: task.attempts },
        'task hit max_attempts after stuck — staying failed',
      );
    }
  }
}

interface RecentSession {
  id: string;
  task_id: string;
  exit_code: number | null;
  log_path: string | null;
  completed_at: string | null;
  killed_reason: string | null;
}

async function scanRecentlyCompletedSessions(): Promise<void> {
  const db = getDb();
  // Scan sessions completed in the last 30 minutes that we haven't handled.
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const rows = db
    .query<RecentSession, [string]>(
      `SELECT id, task_id, exit_code, log_path, completed_at, killed_reason
       FROM sessions
       WHERE completed_at IS NOT NULL AND completed_at >= ?`,
    )
    .all(cutoff);

  for (const r of rows) {
    if (recentlyHandled.has(r.id)) continue;
    const task = getTask(r.task_id);
    if (!task) continue;

    if (r.exit_code === 0) {
      detectLazyCommitsForSession(task, r);
      runQualityGatesAndMaybePolish(task, r);
    } else if (r.exit_code !== null && r.exit_code !== 0) {
      maybeRetryNetworkFailure(task, r);
    }
    recentlyHandled.add(r.id);
  }

  // Garbage-collect old entries from the dedupe set.
  if (recentlyHandled.size > 500) {
    recentlyHandled = new Set(Array.from(recentlyHandled).slice(-200));
  }
}

/** 3b — scan commit messages from this session for 偷懶 markers. */
function detectLazyCommitsForSession(task: Task, r: RecentSession): void {
  const sessionRecord = task.sessions.find((s) => s.id === r.id);
  const commits = sessionRecord?.commits ?? [];
  if (commits.length === 0) return;
  const flagged: { hash: string; subject: string; keywords: string[] }[] = [];
  for (const hash of commits) {
    const subject = gitShowSubject(hash);
    const lowered = subject.toLowerCase();
    const matched = LAZY_KEYWORDS.filter((k) =>
      lowered.includes(k.toLowerCase()),
    );
    if (matched.length > 0) flagged.push({ hash, subject, keywords: matched });
  }
  if (flagged.length === 0) return;

  const notes = [
    `previous spawn (${r.id}) left 偷懶 markers in commit messages — clean them up:`,
    ...flagged.map(
      (f) => `- ${f.hash.slice(0, 8)} ${f.subject}  [${f.keywords.join(', ')}]`,
    ),
  ].join('\n');

  log.info(
    { taskId: task.id, sessionId: r.id, count: flagged.length },
    '偷懶 markers detected — auto-creating polish task',
  );
  createTask({
    type: 'article-evolve',
    boot_profile: 'content-writing',
    priority: 'P1',
    title: `Polish: ${task.title} (clean 偷懶 markers)`,
    created_by: 'health-monitor',
    notes,
    inputs: {
      parent_task: task.id,
      parent_session: r.id,
      reason: 'lazy-keywords',
      flagged_commits: flagged,
    },
  });
}

/** 3c — run available quality gate scripts on touched files. */
function runQualityGatesAndMaybePolish(task: Task, r: RecentSession): void {
  // Phase 5 (2026-04-29): self-correcting task types own their internal
  // verify loop and should NOT trigger an external Polish followup.
  // Spawning a fresh task = re-loading full context for what should be
  // an in-session loop (translate → verify → fix → re-verify).
  const SELF_VERIFYING = new Set([
    'lang-sync-refresh',
    'lang-sync-translate',
    'data-refresh',
    'format-check',
    'status-report',
    'self-diagnose',
  ]);
  if (SELF_VERIFYING.has(task.type)) return;

  const sessionRecord = task.sessions.find((s) => s.id === r.id);
  const commits = sessionRecord?.commits ?? [];
  if (commits.length === 0) return;
  const touched = filesTouchedByCommits(commits);
  const articleFiles = touched.filter(
    (f) => f.startsWith('knowledge/') && f.endsWith('.md'),
  );
  if (articleFiles.length === 0) return;

  const failures: { script: string; output: string }[] = [];
  for (const script of [
    'scripts/tools/check-manifesto-11.sh',
    'scripts/tools/footnote-scan.sh',
    'scripts/tools/format-check.sh',
  ]) {
    const fullPath = join(config.repoRoot, script);
    if (!existsSync(fullPath)) continue;
    const result = spawnSync('bash', [fullPath, ...articleFiles], {
      cwd: config.repoRoot,
      timeout: 60_000,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      failures.push({
        script,
        output: ((result.stdout ?? '') + (result.stderr ?? '')).slice(0, 4000),
      });
    }
  }
  if (failures.length === 0) return;

  const notes = [
    `quality gates failed after spawn ${r.id}:`,
    ...failures.map((f) => `\n## ${f.script}\n\n${f.output}\n`),
  ].join('\n');

  log.info(
    { taskId: task.id, count: failures.length },
    'quality gate failures — auto-creating polish task',
  );
  createTask({
    type: 'article-evolve',
    boot_profile: 'content-writing',
    priority: 'P1',
    title: `Polish: ${task.title} (quality gate failures)`,
    created_by: 'health-monitor',
    notes,
    inputs: {
      parent_task: task.id,
      parent_session: r.id,
      reason: 'quality-gate',
      failed_scripts: failures.map((f) => f.script),
    },
  });
}

/** 3e — retry on transient network errors. */
function maybeRetryNetworkFailure(task: Task, r: RecentSession): void {
  if (!r.log_path || !existsSync(r.log_path)) return;
  let logBody = '';
  try {
    logBody = readFileSync(r.log_path, 'utf8');
  } catch {
    return;
  }
  const matched = RETRYABLE_NETWORK_ERRORS.find((e) => logBody.includes(e));
  if (!matched) return;

  if (task.attempts >= task.max_attempts) {
    log.warn(
      { taskId: task.id, attempts: task.attempts },
      'network failure but max_attempts reached',
    );
    return;
  }

  const cooldownMs = config.retryCooldownSec * 1000;
  log.info(
    { taskId: task.id, error: matched, cooldownMs },
    'retryable network error — requeuing after cooldown',
  );
  setTimeout(() => {
    const fresh = getTask(task.id);
    if (!fresh) return;
    if (fresh.status !== 'failed') return;
    fresh.status = 'pending';
    saveTask(
      fresh,
      `auto-requeue after ${matched} (cooldown ${config.retryCooldownSec}s)`,
    );
  }, cooldownMs);
}

function gitShowSubject(hash: string): string {
  const r = spawnSync('git', ['log', '-1', '--pretty=%s', hash], {
    cwd: config.repoRoot,
    encoding: 'utf8',
  });
  if (r.status !== 0) return '';
  return (r.stdout ?? '').trim();
}

function filesTouchedByCommits(hashes: string[]): string[] {
  const seen = new Set<string>();
  for (const h of hashes) {
    const r = spawnSync('git', ['show', '--name-only', '--pretty=', h], {
      cwd: config.repoRoot,
      encoding: 'utf8',
    });
    if (r.status !== 0) continue;
    for (const line of (r.stdout ?? '').split('\n')) {
      const trimmed = line.trim();
      if (trimmed) seen.add(trimmed);
    }
  }
  return Array.from(seen);
}
