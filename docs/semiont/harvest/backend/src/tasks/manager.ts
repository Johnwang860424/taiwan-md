/**
 * Task manager — CRUD over `.harvest/tasks/` and the SQLite index.
 *
 * Rule: task.yml is the source of truth, SQLite is a query cache. Every write
 * goes to YAML first, then mirrors into SQLite.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.ts';
import { getDb } from '../db/client.ts';
import { child } from '../logger.ts';
import {
  type NewTaskInput,
  type Task,
  type TaskStatus,
  isTaskStatus,
  isTaskPriority,
} from './types.ts';
import { ensureTaskFolder, readTaskYaml, writeTaskYaml } from './folder-io.ts';

const log = child({ module: 'tasks/manager' });

/** Slugify a title into a filesystem-safe ASCII-ish chunk (CJK preserved). */
export function slugify(title: string): string {
  return title
    .trim()
    .replace(/[\s\/\\]+/g, '-')
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Generate a fresh task id of shape `YYYY-MM-DD-NNN-{slug}`.
 * The NNN counter scopes per-day so multiple tasks the same day stay sortable.
 */
export function generateTaskId(title: string, now: Date = new Date()): string {
  const date = formatDate(now);
  const counter = nextDayCounter(date);
  const slug = slugify(title);
  return `${date}-${String(counter).padStart(3, '0')}-${slug}`;
}

function formatDate(d: Date): string {
  // Always emit local date (avoid UTC midnight surprises for cheyu's TZ).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextDayCounter(date: string): number {
  const db = getDb();
  const row = db
    .query<
      { count: number },
      [string]
    >('SELECT COUNT(*) AS count FROM tasks WHERE id LIKE ?')
    .get(`${date}-%`);
  return (row?.count ?? 0) + 1;
}

/** Creates a new task: folder + task.yml + SQLite row. Returns the Task. */
export function createTask(input: NewTaskInput): Task {
  if (!isTaskPriority(input.priority)) {
    throw new Error(`Invalid priority: ${input.priority}`);
  }
  const now = new Date();
  const id = generateTaskId(input.title, now);
  const folderPath = join(config.paths.tasksRoot, id);
  ensureTaskFolder(folderPath);

  const nowIso = now.toISOString();
  const task: Task = {
    schema_version: 1,
    id,
    type: input.type,
    boot_profile: input.boot_profile,
    status: 'pending',
    priority: input.priority,
    title: input.title,
    folder_path: folderPath,
    created_at: nowIso,
    created_by: input.created_by,
    updated_at: nowIso,
    dependencies: input.dependencies ?? [],
    blockers: [],
    sessions: [],
    attempts: 0,
    max_attempts: 3,
    ...(input.deadline ? { deadline: input.deadline } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.inputs ? { inputs: input.inputs } : {}),
  };

  writeTaskYaml(task, `task created by ${input.created_by}`);
  upsertTaskRow(task);

  if (task.dependencies.length > 0) {
    const db = getDb();
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)',
    );
    for (const dep of task.dependencies) {
      stmt.run(task.id, dep);
    }
  }

  log.info(
    { taskId: task.id, type: task.type, priority: task.priority },
    'task created',
  );
  return task;
}

/** Loads a single task by id (from disk). Returns null if missing. */
export function getTask(id: string): Task | null {
  const folderPath = join(config.paths.tasksRoot, id);
  if (!existsSync(join(folderPath, 'task.yml'))) return null;
  return readTaskYaml(folderPath);
}

export interface ListTasksFilter {
  status?: TaskStatus | TaskStatus[];
  priority?: string;
  limit?: number;
  /**
   * Phase 5.1 (2026-04-30): soft-delete handling.
   * Default 'live' — exclude soft-deleted tasks (deleted_at IS NOT NULL).
   * 'all' — include both live and soft-deleted.
   * 'deleted' — show only soft-deleted (for restore UI).
   */
  scope?: 'live' | 'all' | 'deleted';
}

/** Lists tasks via the SQLite index (for fast filter/sort). */
export function listTasks(filter: ListTasksFilter = {}): Task[] {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  // Soft-delete scope (default: live only)
  const scope = filter.scope ?? 'live';
  if (scope === 'live') {
    where.push('deleted_at IS NULL');
  } else if (scope === 'deleted') {
    where.push('deleted_at IS NOT NULL');
  } // 'all' — no filter

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      where.push(`status IN (${filter.status.map(() => '?').join(',')})`);
      params.push(...filter.status);
    } else {
      where.push('status = ?');
      params.push(filter.status);
    }
  }
  if (filter.priority) {
    where.push('priority = ?');
    params.push(filter.priority);
  }

  // Phase 5.1 fix: don't push LIMIT into SQL — SQLite has stale rows whose
  // folder was archived externally. listTasks must filter null in JS layer
  // FIRST, then apply limit. Otherwise SQL `LIMIT 5` could return 5 oldest
  // ghost rows whose folders are gone, and the user sees count=0 even though
  // SQLite has 70+ rows. Apply ORDER + WHERE in SQL but limit in JS.
  const sql =
    'SELECT id FROM tasks' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ' ORDER BY priority ASC, created_at ASC';

  // bun:sqlite SQLQueryBindings — runtime-safe coercion. We've validated
  // each param above as string; this cast is purely for the type checker.
  const rows = db
    .query<{ id: string }, never[]>(sql)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .all(...(params as never[]));
  const tasks: Task[] = [];
  const cap = filter.limit ? Number(filter.limit) : Infinity;
  for (const row of rows) {
    const t = getTask(row.id);
    if (t) tasks.push(t);
    if (tasks.length >= cap) break;
  }
  return tasks;
}

/** Update only the status (with status.log audit trail). */
export function updateTaskStatus(
  id: string,
  status: TaskStatus,
  note: string,
): Task {
  if (!isTaskStatus(status)) throw new Error(`Invalid status: ${status}`);
  const task = getTask(id);
  if (!task) throw new Error(`Task not found: ${id}`);
  task.status = status;
  task.updated_at = new Date().toISOString();
  writeTaskYaml(task, note);
  upsertTaskRow(task);
  return task;
}

/** Persist arbitrary task changes back to disk + index. */
export function saveTask(task: Task, statusNote?: string): void {
  task.updated_at = new Date().toISOString();
  writeTaskYaml(task, statusNote);
  upsertTaskRow(task);
}

/**
 * Phase 5.1 (2026-04-30): SOFT DELETE — sets deleted_at timestamp on task row.
 * Cheyu's rule: 「任務的刪除功能能夠是 soft delete 嗎」.
 *
 * Soft delete keeps:
 *   - SQLite row (with deleted_at IS NOT NULL)
 *   - `.harvest/tasks/<id>/` folder (sessions + logs + brief preserved)
 *   - sessions table entries
 *
 * listTasks() with default scope='live' filters them out automatically.
 * Use scope='deleted' to list soft-deleted (for restore UI).
 *
 * Refuses if task is currently spawning / in-progress (active session would
 * be misleadingly hidden). Caller must cancel first.
 *
 * To hard-delete (purge for real), use hardDeleteTask() — meant for explicit
 * cleanup tooling, never the UI delete button.
 */
export function deleteTask(id: string): {
  ok: boolean;
  reason?: string;
  softDeleted?: boolean;
} {
  const task = getTask(id);
  if (!task) return { ok: false, reason: 'not found' };
  if (task.status === 'spawning' || task.status === 'in-progress') {
    return {
      ok: false,
      reason: `task is ${task.status} — cancel session first`,
    };
  }
  const db = getDb();
  const now = new Date().toISOString();
  db.run('UPDATE tasks SET deleted_at = ? WHERE id = ?', [now, id]);
  log.info({ taskId: id, deletedAt: now }, 'task soft-deleted');
  return { ok: true, softDeleted: true };
}

/**
 * Phase 5.1 (2026-04-30): restore a soft-deleted task back to live.
 * Caller should pass an id that's currently deleted (deleted_at IS NOT NULL).
 */
export function restoreTask(id: string): { ok: boolean; reason?: string } {
  const db = getDb();
  const row = db
    .query<
      { deleted_at: string | null },
      [string]
    >('SELECT deleted_at FROM tasks WHERE id = ?')
    .get(id);
  if (!row) return { ok: false, reason: 'not found' };
  if (row.deleted_at == null)
    return { ok: false, reason: 'task is not deleted' };
  db.run('UPDATE tasks SET deleted_at = NULL WHERE id = ?', [id]);
  log.info({ taskId: id }, 'task restored from soft delete');
  return { ok: true };
}

/**
 * Phase 5.1 (2026-04-30): permanent delete — removes SQLite row + folder.
 * NOT exposed via UI button. Reserved for explicit cleanup tooling
 * (e.g. archival scripts that purge soft-deleted tasks > N days old).
 */
export function hardDeleteTask(id: string): {
  ok: boolean;
  reason?: string;
  folderRemoved?: boolean;
} {
  const task = getTask(id);
  if (!task) return { ok: false, reason: 'not found' };
  if (task.status === 'spawning' || task.status === 'in-progress') {
    return {
      ok: false,
      reason: `task is ${task.status} — cancel session first`,
    };
  }
  const db = getDb();
  try {
    db.run('DELETE FROM sessions WHERE task_id = ?', [id]);
  } catch {
    // older schema may not have sessions table or different FK setup; ignore
  }
  db.run('DELETE FROM tasks WHERE id = ?', [id]);
  let folderRemoved = false;
  if (task.folder_path && existsSync(task.folder_path)) {
    try {
      const { rmSync } = require('node:fs') as typeof import('node:fs');
      rmSync(task.folder_path, { recursive: true, force: true });
      folderRemoved = true;
    } catch (err) {
      log.warn(
        { taskId: id, err: String(err) },
        'task folder removal failed — DB row deleted but disk leftover',
      );
    }
  }
  log.info({ taskId: id, folderRemoved }, 'task hard-deleted');
  return { ok: true, folderRemoved };
}

function upsertTaskRow(task: Task): void {
  const db = getDb();
  db.run(
    `INSERT INTO tasks (id, type, boot_profile, status, priority, title, folder_path,
       created_at, created_by, updated_at, attempts, max_attempts, deadline)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       boot_profile = excluded.boot_profile,
       status = excluded.status,
       priority = excluded.priority,
       title = excluded.title,
       folder_path = excluded.folder_path,
       updated_at = excluded.updated_at,
       attempts = excluded.attempts,
       max_attempts = excluded.max_attempts,
       deadline = excluded.deadline`,
    [
      task.id,
      task.type,
      task.boot_profile,
      task.status,
      task.priority,
      task.title,
      task.folder_path,
      task.created_at,
      task.created_by,
      task.updated_at,
      task.attempts,
      task.max_attempts,
      task.deadline ?? null,
    ],
  );
}

/**
 * Walks the tasks folder and reindexes SQLite. Useful when SQLite gets wiped
 * or out-of-sync. Safe to run repeatedly.
 */
export function reindexFromDisk(): number {
  if (!existsSync(config.paths.tasksRoot)) {
    mkdirSync(config.paths.tasksRoot, { recursive: true });
    return 0;
  }
  let count = 0;
  for (const entry of readdirSync(config.paths.tasksRoot, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const folder = join(config.paths.tasksRoot, entry.name);
    if (!existsSync(join(folder, 'task.yml'))) continue;
    try {
      const task = readTaskYaml(folder);
      upsertTaskRow(task);
      count++;
    } catch (err) {
      log.warn({ folder, err: String(err) }, 'skipped malformed task folder');
    }
  }
  log.info({ count }, 'reindexed tasks from disk');
  return count;
}
