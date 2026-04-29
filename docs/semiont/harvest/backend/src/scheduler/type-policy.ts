/**
 * Phase 5 (2026-04-29) — Per-task-type auto-spawn allow/deny list.
 *
 * Cheyu wants 駕駛艙 control: each task type has a checkbox for whether
 * auto-spawn is allowed to fire it. Manual spawn (POST /api/tasks/:id/spawn)
 * always works regardless of policy.
 *
 * Default seed list lives in `db/migrations.ts`:
 *   article-* / lang-sync-* / data-refresh / self-diagnose → ON
 *   pr-review / issue-handle / contributor-thank-you / spore-publish → OFF
 *
 * State is in SQLite (table: scheduler_type_policy). Migrations seed defaults.
 */

import { getDb } from '../db/client.ts';
import { child } from '../logger.ts';

const log = child({ module: 'scheduler/type-policy' });

export interface TypePolicy {
  task_type: string;
  auto_spawn_enabled: boolean;
  updated_at: string;
}

export function listTypePolicies(): TypePolicy[] {
  const db = getDb();
  const rows = db
    .query<
      { task_type: string; auto_spawn_enabled: number; updated_at: string },
      []
    >('SELECT task_type, auto_spawn_enabled, updated_at FROM scheduler_type_policy ORDER BY task_type')
    .all();
  return rows.map((r) => ({
    task_type: r.task_type,
    auto_spawn_enabled: r.auto_spawn_enabled === 1,
    updated_at: r.updated_at,
  }));
}

export function setTypePolicy(taskType: string, enabled: boolean): TypePolicy {
  const db = getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO scheduler_type_policy (task_type, auto_spawn_enabled, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(task_type) DO UPDATE SET auto_spawn_enabled=excluded.auto_spawn_enabled, updated_at=excluded.updated_at`,
    [taskType, enabled ? 1 : 0, now],
  );
  log.info({ taskType, enabled }, 'updated type policy');
  return { task_type: taskType, auto_spawn_enabled: enabled, updated_at: now };
}

export function isTypeAutoSpawnEnabled(taskType: string): boolean {
  const db = getDb();
  const row = db
    .query<
      { auto_spawn_enabled: number },
      [string]
    >('SELECT auto_spawn_enabled FROM scheduler_type_policy WHERE task_type = ?')
    .get(taskType);
  // Unknown type → default to ENABLED (don't break legacy types we haven't seeded)
  if (!row) return true;
  return row.auto_spawn_enabled === 1;
}
