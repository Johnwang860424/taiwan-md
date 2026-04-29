/**
 * Schema migrations.
 *
 * Strategy: schema.sql is idempotent (CREATE TABLE IF NOT EXISTS) for fresh
 * databases. For pre-existing databases that need new columns on existing
 * tables, we run additive ALTER statements gated by `PRAGMA table_info`
 * checks so they're safe to re-run.
 */

import type { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CURRENT_SCHEMA_VERSION = 3;

export function applyMigrations(db: Database): void {
  const schemaPath = join(__dirname, 'schema.sql');
  const ddl = readFileSync(schemaPath, 'utf8');
  db.exec(ddl);

  // Additive column migrations for the `sessions` table — needed for
  // pre-2026-04-27 DBs that already exist on cheyu's box.
  ensureColumn(db, 'sessions', 'spawn_start_iso', 'TEXT');
  ensureColumn(db, 'sessions', 'cancelled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'sessions', 'killed_reason', 'TEXT');
  ensureColumn(db, 'sessions', 'worktree_path', 'TEXT');
  ensureColumn(db, 'sessions', 'worktree_branch', 'TEXT');

  const row = db
    .query<
      { version: number },
      []
    >('SELECT MAX(version) AS version FROM schema_version')
    .get();
  const current = row?.version ?? 0;
  if (current < CURRENT_SCHEMA_VERSION) {
    db.run('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)', [
      CURRENT_SCHEMA_VERSION,
      new Date().toISOString(),
    ]);
  }

  // Phase 5 (2026-04-29): seed scheduler_type_policy with default disabled list.
  // PR-touching task types default OFF (cheyu wants manual oversight).
  // article-* + lang-sync-* default ON (safe to auto-fire).
  const seedPolicy: Record<string, number> = {
    'article-rewrite': 1,
    'article-evolve': 1,
    'article-new': 1,
    'lang-sync-refresh': 1,
    'lang-sync-translate': 1,
    'data-refresh': 1,
    'spore-publish': 0, // outbound, manual
    'pr-review': 0,
    'issue-handle': 0,
    'contributor-thank-you': 0,
    'self-diagnose': 1,
    'status-report': 1,
    'format-check': 1,
  };
  const now = new Date().toISOString();
  for (const [type, enabled] of Object.entries(seedPolicy)) {
    db.run(
      'INSERT OR IGNORE INTO scheduler_type_policy (task_type, auto_spawn_enabled, updated_at) VALUES (?, ?, ?)',
      [type, enabled, now],
    );
  }
}

function ensureColumn(
  db: Database,
  table: string,
  column: string,
  type: string,
): void {
  const cols = db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
