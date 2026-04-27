/**
 * Harvest backend — HTTP entrypoint.
 *
 * Run: `bun run dev`  (watch mode via package.json)
 *      `bun run src/server.ts`  (no watch)
 */

import { Hono } from 'hono';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { getDb, closeDb } from './db/client.ts';
import {
  listTasks,
  getTask,
  createTask,
  updateTaskStatus,
  reindexFromDisk,
  saveTask,
} from './tasks/manager.ts';
import { isTaskPriority } from './tasks/types.ts';
import { ArticleInboxAdapter } from './intake/article-inbox.ts';
import { generateDailyReport } from './reporter/daily.ts';
import {
  isPaused,
  pauseScheduler,
  resumeScheduler,
  startScheduler,
  stopScheduler,
} from './scheduler/cron.ts';
import { startAutoSpawn, stopAutoSpawn } from './scheduler/auto-spawn.ts';
import { startHealthMonitor, stopHealthMonitor } from './health/monitor.ts';
import { loadProfiles } from './spawner/boot-profiles.ts';
import { join } from 'node:path';
import {
  markActiveSessionsForReview,
  reconcileOrphanSessions,
} from './lifecycle/shutdown.ts';
import { handleGithubWebhook } from './webhook/github.ts';
import { cleanupStaleWorktrees } from './spawner/worktree.ts';
import {
  logPathForSession,
  pollLogSince,
  streamLog,
} from './spawner/log-stream.ts';
import {
  killSession,
  activeForTask,
  unregister,
} from './spawner/concurrency.ts';

const app = new Hono();
const startTs = Date.now();

mkdirSync(config.paths.harvestRoot, { recursive: true });
mkdirSync(config.paths.tasksRoot, { recursive: true });
mkdirSync(config.paths.reportsRoot, { recursive: true });

const db = getDb();
loadProfiles();
reindexFromDisk();
reconcileOrphanSessions();
cleanupStaleWorktrees();

const inbox = new ArticleInboxAdapter();
if (!config.disableWatch) {
  inbox
    .start()
    .catch((err) => logger.error({ err: String(err) }, 'inbox start failed'));
}
if (!config.disableCron) {
  startScheduler();
  startAutoSpawn();
}
startHealthMonitor();

app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  if (origin?.startsWith('http://localhost:')) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
  return;
});

app.get('/api/health', (c) => {
  let dbOk = true;
  try {
    db.query('SELECT 1').get();
  } catch {
    dbOk = false;
  }
  return c.json({
    ok: dbOk,
    uptime_s: Math.round((Date.now() - startTs) / 1000),
    db_ok: dbOk,
    repo_root: config.repoRoot,
    scheduler_paused: isPaused(),
  });
});

app.get('/api/tasks', (c) => {
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const limit = c.req.query('limit');
  const tasks = listTasks({
    ...(status ? { status: status as never } : {}),
    ...(priority ? { priority } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
  });
  return c.json({ count: tasks.length, tasks });
});

app.get('/api/tasks/:id', (c) => {
  const id = c.req.param('id');
  const task = getTask(id);
  if (!task) return c.json({ error: 'not found' }, 404);
  return c.json(task);
});

app.post('/api/tasks', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object')
    return c.json({ error: 'invalid json body' }, 400);
  const {
    type,
    boot_profile,
    priority,
    title,
    notes,
    dependencies,
    deadline,
    inputs,
  } = body as Record<string, unknown>;
  if (
    typeof type !== 'string' ||
    typeof boot_profile !== 'string' ||
    typeof title !== 'string'
  ) {
    return c.json(
      { error: 'type, boot_profile, title required (strings)' },
      400,
    );
  }
  if (!isTaskPriority(priority)) {
    return c.json({ error: 'priority must be P0|P1|P2|P3' }, 400);
  }
  const task = createTask({
    type,
    boot_profile,
    priority,
    title,
    created_by:
      typeof (body as Record<string, unknown>).created_by === 'string'
        ? ((body as Record<string, unknown>).created_by as string)
        : 'api',
    notes: typeof notes === 'string' ? notes : undefined,
    dependencies: Array.isArray(dependencies)
      ? (dependencies.filter((d) => typeof d === 'string') as string[])
      : undefined,
    deadline: typeof deadline === 'string' ? deadline : undefined,
    inputs:
      inputs && typeof inputs === 'object'
        ? (inputs as Record<string, unknown>)
        : undefined,
  });
  return c.json(task, 201);
});

app.post('/api/tasks/:id/cancel', (c) => {
  const id = c.req.param('id');
  const task = getTask(id);
  if (!task) return c.json({ error: 'not found' }, 404);
  if (task.status !== 'pending' && task.status !== 'blocked') {
    return c.json(
      { error: `cannot cancel task in status=${task.status}` },
      409,
    );
  }
  const updated = updateTaskStatus(id, 'retired', 'cancelled via API');
  return c.json(updated);
});

app.post('/api/tasks/:id/spawn', async (c) => {
  const id = c.req.param('id');
  const task = getTask(id);
  if (!task) return c.json({ error: 'not found' }, 404);
  const dry = c.req.query('dry') === 'true';

  const { spawnClaudeForTask } = await import('./spawner/claude-cli.ts');
  const {
    canSpawn,
    activeForTask: activeForTaskImport,
    activeCount,
    maxConcurrent,
  } = await import('./spawner/concurrency.ts');

  if (dry) {
    const result = await spawnClaudeForTask(task, { dryRun: true });
    return c.json(result);
  }

  const existing = activeForTaskImport(id);
  if (existing) {
    return c.json(
      {
        error: 'task already has an active session',
        active_session_id: existing.sessionId,
        phase: existing.phase,
      },
      409,
    );
  }

  if (!canSpawn()) {
    return c.json(
      {
        error: 'max concurrent sessions reached',
        active: activeCount(),
        max: maxConcurrent(),
        hint: 'wait for a session to finish or raise HARVEST_MAX_CONCURRENT',
      },
      409,
    );
  }

  if (
    task.status !== 'pending' &&
    task.status !== 'failed' &&
    task.status !== 'awaiting-cheyu'
  ) {
    return c.json(
      {
        error: `cannot spawn task in status=${task.status} (allowed: pending, failed, awaiting-cheyu)`,
      },
      409,
    );
  }

  spawnClaudeForTask(task, { dryRun: false }).catch((err) => {
    logger.error(
      { err: String(err), taskId: id },
      'background spawn failed unexpectedly',
    );
  });

  return c.json(
    {
      task_id: id,
      status: 'spawning',
      active_now: activeCount() + 1,
      max_concurrent: maxConcurrent(),
      message: 'spawn dispatched; poll /api/tasks/:id or /api/sessions/active',
    },
    202,
  );
});

app.get('/api/sessions/active', async (c) => {
  const { listActive, activeCount, maxConcurrent } =
    await import('./spawner/concurrency.ts');
  return c.json({
    count: activeCount(),
    max: maxConcurrent(),
    sessions: listActive(),
  });
});

/** Bug 3 — polling endpoint. */
app.get('/api/sessions/:sid/log', (c) => {
  const sid = c.req.param('sid');
  const sinceQ = c.req.query('since');
  const since = sinceQ ? Number(sinceQ) : 0;
  if (!Number.isFinite(since) || since < 0) {
    return c.json({ error: 'since must be a non-negative number' }, 400);
  }
  const meta = logPathForSession(sid);
  if (!meta.path) return c.json({ error: 'session not found' }, 404);
  const result = pollLogSince(sid, since);
  return c.json(result);
});

/** Bug 3 — SSE log stream. */
app.get('/api/sessions/:sid/log/stream', (c) => {
  const sid = c.req.param('sid');
  const meta = logPathForSession(sid);
  if (!meta.path) return c.json({ error: 'session not found' }, 404);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string): void => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream already closed by client — ignore.
        }
      };
      const cleanup = streamLog(sid, write, () => {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
      // Hono passes through AbortSignal; we hook it for cleanup on disconnect.
      const signal = c.req.raw.signal;
      signal.addEventListener('abort', () => cleanup());
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

/** Phase 3.4 — cancel an active session for a task. */
app.post('/api/sessions/:sid/cancel', (c) => {
  const sid = c.req.param('sid');
  const result = killSession(sid, 'SIGTERM');
  if (!result.ok) {
    return c.json({ error: result.reason, sid }, 404);
  }
  // Mark DB + task.
  db.run(
    `UPDATE sessions SET cancelled = 1, killed_reason = ?, completed_at = COALESCE(completed_at, ?) WHERE id = ?`,
    ['cancelled via API', new Date().toISOString(), sid],
  );
  const row = db
    .query<
      { task_id: string },
      [string]
    >('SELECT task_id FROM sessions WHERE id = ?')
    .get(sid);
  if (row) {
    const task = getTask(row.task_id);
    if (task) {
      task.status = 'awaiting-cheyu';
      saveTask(task, `session ${sid} cancelled via API`);
    }
  }
  setTimeout(() => unregister(sid), 5_000);
  return c.json({ ok: true, sid, pid: result.pid });
});

/** Convenience: cancel by task id (cancels its active session). */
app.post('/api/tasks/:id/cancel-spawn', (c) => {
  const id = c.req.param('id');
  const active = activeForTask(id);
  if (!active)
    return c.json({ error: 'no active session for task', task_id: id }, 404);
  const result = killSession(active.sessionId, 'SIGTERM');
  if (!result.ok) {
    return c.json({ error: result.reason, sid: active.sessionId }, 500);
  }
  db.run(
    `UPDATE sessions SET cancelled = 1, killed_reason = ?, completed_at = COALESCE(completed_at, ?) WHERE id = ?`,
    ['cancelled via API', new Date().toISOString(), active.sessionId],
  );
  const task = getTask(id);
  if (task) {
    task.status = 'awaiting-cheyu';
    saveTask(task, `session ${active.sessionId} cancelled via API`);
  }
  setTimeout(() => unregister(active.sessionId), 5_000);
  return c.json({ ok: true, sid: active.sessionId, pid: result.pid });
});

app.get('/api/vitals', (c) => {
  const path = join(config.repoRoot, 'public/api/dashboard-organism.json');
  if (!existsSync(path)) return c.json({ error: 'no vitals data' }, 404);
  try {
    return c.json(JSON.parse(readFileSync(path, 'utf8')));
  } catch (err) {
    return c.json(
      { error: 'failed to parse vitals', detail: String(err) },
      500,
    );
  }
});

app.get('/api/analytics', (c) => {
  const path = join(config.repoRoot, 'public/api/dashboard-analytics.json');
  if (!existsSync(path)) return c.json({ error: 'no analytics data' }, 404);
  try {
    return c.json(JSON.parse(readFileSync(path, 'utf8')));
  } catch (err) {
    return c.json(
      { error: 'failed to parse analytics', detail: String(err) },
      500,
    );
  }
});

app.get('/api/reports/today', (c) => {
  const date = formatLocalDate(new Date());
  const path = join(config.paths.reportsRoot, `${date}.md`);
  if (!existsSync(path))
    return c.json({ error: 'no report for today yet', date }, 404);
  const md = readFileSync(path, 'utf8');
  return c.text(md);
});

app.get('/api/reports/:date', (c) => {
  const date = c.req.param('date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return c.json({ error: 'date must be YYYY-MM-DD' }, 400);
  const path = join(config.paths.reportsRoot, `${date}.md`);
  if (!existsSync(path)) return c.json({ error: 'not found', date }, 404);
  return c.text(readFileSync(path, 'utf8'));
});

app.post('/api/reports/generate', async (c) => {
  const date = c.req.query('date');
  const result = await generateDailyReport(date ?? undefined);
  return c.json(result);
});

app.post('/api/control/pause', (c) => {
  pauseScheduler();
  stopAutoSpawn();
  stopHealthMonitor();
  return c.json({ paused: true });
});

app.post('/api/control/resume', (c) => {
  resumeScheduler();
  startAutoSpawn();
  startHealthMonitor();
  return c.json({ paused: false });
});

app.post('/api/intake/scan', async (c) => {
  const detected = await inbox.scanOnce();
  return c.json({ detected: detected.length, entries: detected });
});

/** Phase 4 — GitHub webhook receiver. */
app.post('/api/webhook/github', async (c) => {
  const raw = await c.req.text();
  const result = await handleGithubWebhook(raw, {
    signature: c.req.header('x-hub-signature-256') ?? null,
    event: c.req.header('x-github-event') ?? null,
  });
  return c.json(result.body, result.status as never);
});

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

logger.info(
  {
    port: server.port,
    repoRoot: config.repoRoot,
    dbPath: config.dbPath,
    cron: !config.disableCron,
    watch: !config.disableWatch,
    autoSpawn: !config.disableAutoSpawn,
    healthMonitor: !config.disableHealthMonitor,
    reportsRoot: config.paths.reportsRoot,
    inbox: config.paths.articleInbox,
    inboxExists: existsSync(config.paths.articleInbox),
  },
  '🧬 harvest backend up',
);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  // Bug 2: tag active sessions awaiting-cheyu before we go (children survive
  // because they're detached).
  markActiveSessionsForReview(signal);
  await inbox.stop().catch(() => {});
  stopAutoSpawn();
  stopHealthMonitor();
  stopScheduler();
  closeDb();
  server.stop();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
