/**
 * Harvest backend — HTTP entrypoint.
 *
 * Run: `bun run dev`  (watch mode via package.json)
 *      `bun run src/server.ts`  (no watch)
 *
 * Boots up:
 *   - SQLite (auto-migrate)
 *   - Boot profiles (load + validate MANIFESTO presence)
 *   - ARTICLE-INBOX file watch
 *   - Cron (daily 08:00 +0800 report)
 *   - Hono HTTP API
 *
 * Graceful shutdown on SIGINT/SIGTERM.
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
import { loadProfiles } from './spawner/boot-profiles.ts';
import { join } from 'node:path';

const app = new Hono();
const startTs = Date.now();

// ─── Bootstrap ────────────────────────────────────────────────────────────
mkdirSync(config.paths.harvestRoot, { recursive: true });
mkdirSync(config.paths.tasksRoot, { recursive: true });
mkdirSync(config.paths.reportsRoot, { recursive: true });

const db = getDb();
loadProfiles(); // throws on missing MANIFESTO etc. — fail fast.
reindexFromDisk();

const inbox = new ArticleInboxAdapter();
if (!config.disableWatch) {
  inbox
    .start()
    .catch((err) => logger.error({ err: String(err) }, 'inbox start failed'));
}
if (!config.disableCron) {
  startScheduler();
}

// ─── Routes ───────────────────────────────────────────────────────────────

// CORS for UI dev server (Astro localhost:4321) — Phase 2 frontend separate origin.
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

/**
 * Manual spawn trigger.
 *
 * Behaviour:
 * - dry=true: synchronous, returns the built prompt without invoking claude.
 * - dry=false (default): **fire-and-forget**. Returns 202 Accepted immediately
 *   with the session metadata. The actual claude run continues in the
 *   background; the UI sees status transitions via /api/tasks polling and
 *   /api/sessions/active. Multiple concurrent spawns are allowed up to
 *   HARVEST_MAX_CONCURRENT (default 3).
 * - 409 Conflict if (a) task is already in `spawning` or `in-progress` state
 *   for one of its sessions, or (b) max concurrent reached.
 */
app.post('/api/tasks/:id/spawn', async (c) => {
  const id = c.req.param('id');
  const task = getTask(id);
  if (!task) return c.json({ error: 'not found' }, 404);
  const dry = c.req.query('dry') === 'true';

  const { spawnClaudeForTask } = await import('./spawner/claude-cli.ts');
  const { canSpawn, activeForTask, activeCount, maxConcurrent } =
    await import('./spawner/concurrency.ts');

  if (dry) {
    const result = await spawnClaudeForTask(task, { dryRun: true });
    return c.json(result);
  }

  const existing = activeForTask(id);
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

  // Fire-and-forget. We don't await — return 202 immediately.
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

/**
 * Live snapshot of currently-running claude sessions (in-memory).
 * Polled by the UI header badge + Sections that need real-time runs.
 */
app.get('/api/sessions/active', async (c) => {
  const { listActive, activeCount, maxConcurrent } =
    await import('./spawner/concurrency.ts');
  return c.json({
    count: activeCount(),
    max: maxConcurrent(),
    sessions: listActive(),
  });
});

/**
 * Vitals proxy — exposes the main site's organ-score JSON so the harvest UI
 * can render Section 1 without cross-origin file reads. Read-only proxy of
 * `<repoRoot>/public/api/dashboard-organism.json`.
 */
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

/** Analytics proxy — same pattern for `dashboard-analytics.json`. */
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
  return c.json({ paused: true });
});

app.post('/api/control/resume', (c) => {
  resumeScheduler();
  return c.json({ paused: false });
});

/** Manual one-shot inbox scan (triggers the same logic as the file watcher). */
app.post('/api/intake/scan', async (c) => {
  const detected = await inbox.scanOnce();
  return c.json({ detected: detected.length, entries: detected });
});

// ─── Boot HTTP listener ───────────────────────────────────────────────────

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
    reportsRoot: config.paths.reportsRoot,
    inbox: config.paths.articleInbox,
    inboxExists: existsSync(config.paths.articleInbox),
  },
  '🧬 harvest backend up',
);

// ─── Graceful shutdown ────────────────────────────────────────────────────

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  await inbox.stop().catch(() => {});
  stopScheduler();
  closeDb();
  server.stop();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
