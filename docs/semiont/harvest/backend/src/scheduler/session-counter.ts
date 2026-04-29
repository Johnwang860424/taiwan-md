/**
 * Session counter — Phase 5 (2026-04-29).
 *
 * Track total spawned (in-progress) sessions since backend boot.
 * Every 10 sessions → schedule a Master Review task (deduped 1hr).
 *
 * Persisted in SQLite KV-style table so backend restarts don't lose count
 * (we count from the lifetime of this Taiwan.md instance, not just uptime).
 */
import { getDb } from '../db/client.ts';
import { child } from '../logger.ts';
import { scheduleMasterReview } from './cron.ts';

const log = child({ module: 'scheduler/session-counter' });

const KEY = 'session-counter:total';
const STEP = 10;

function getTotal(): number {
  const db = getDb();
  // Reuse scheduler_type_policy table? No — make a generic kv table. Cheapest:
  // store as a fake row in a tiny table. We add it via SQL exec on demand.
  db.exec(
    `CREATE TABLE IF NOT EXISTS kv_int (
       key TEXT PRIMARY KEY,
       value INTEGER NOT NULL,
       updated_at TEXT NOT NULL
     )`,
  );
  const row = db
    .query<
      { value: number },
      [string]
    >('SELECT value FROM kv_int WHERE key = ?')
    .get(KEY);
  return row?.value ?? 0;
}

function setTotal(n: number): void {
  const db = getDb();
  db.run(
    `INSERT INTO kv_int (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    [KEY, n, new Date().toISOString()],
  );
}

/**
 * Call when a new session is spawned. Increments counter; fires Master Review
 * task creation when crossing a multiple of STEP.
 */
export function recordSpawnedSession(): void {
  const prev = getTotal();
  const next = prev + 1;
  setTotal(next);
  if (Math.floor(next / STEP) > Math.floor(prev / STEP)) {
    log.info(
      { totalSessions: next },
      `session counter crossed multiple of ${STEP} — scheduling Master Review`,
    );
    void scheduleMasterReview('session-counter');
  }
}

export function getSessionCount(): number {
  return getTotal();
}
