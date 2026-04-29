/**
 * Concurrency manager — tracks active claude sessions in memory and enforces
 * a max concurrency limit. Hot-readable by the API for live status badges.
 *
 * Why in-memory: sessions are short-lived (≤ 90 min hard timeout) and we
 * always have at most ~5 running. SQLite still records the canonical session
 * row; this map is just for "what's running RIGHT NOW" queries.
 */

import { config } from '../config.ts';
import { child as childLogger } from '../logger.ts';

const log = childLogger({ module: 'spawner/concurrency' });

export interface ActiveSession {
  sessionId: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  bootProfile: string;
  pid: number | undefined;
  spawnedAt: string; // ISO
  /** "spawning" right after start, "in-progress" once we've confirmed claude is running. */
  phase: 'spawning' | 'in-progress';
}

const active = new Map<string, ActiveSession>();

// Phase 5 (2026-04-29): runtime-overridable concurrency cap.
// Default seeded from env (HARVEST_MAX_CONCURRENT) but UI / API can change.
let currentMaxConcurrent = config.maxConcurrentSessions;

export function maxConcurrent(): number {
  return currentMaxConcurrent;
}

export function setMaxConcurrent(n: number): number {
  currentMaxConcurrent = Math.max(1, Math.min(20, Math.floor(n)));
  log.info({ maxConcurrent: currentMaxConcurrent }, 'updated max concurrent');
  return currentMaxConcurrent;
}

export function activeCount(): number {
  return active.size;
}

export function listActive(): ActiveSession[] {
  return Array.from(active.values()).sort((a, b) =>
    a.spawnedAt.localeCompare(b.spawnedAt),
  );
}

export function isActive(sessionId: string): boolean {
  return active.has(sessionId);
}

export function activeForTask(taskId: string): ActiveSession | undefined {
  for (const s of active.values()) if (s.taskId === taskId) return s;
  return undefined;
}

export function canSpawn(): boolean {
  return active.size < currentMaxConcurrent;
}

export function register(session: ActiveSession): void {
  active.set(session.sessionId, session);
  log.info(
    {
      sessionId: session.sessionId,
      taskId: session.taskId,
      activeCount: active.size,
      max: currentMaxConcurrent,
    },
    'session registered',
  );
}

/**
 * Atomic check-and-insert. Use this instead of `canSpawn() + register()` —
 * the two-step sequence races when callers do async work between them.
 *
 * Returns true if reservation succeeded (caller now owns a slot and MUST
 * unregister on failure). Returns false if at limit (no state changed).
 */
export function tryRegister(session: ActiveSession): boolean {
  if (active.size >= currentMaxConcurrent) {
    log.info(
      {
        sessionId: session.sessionId,
        taskId: session.taskId,
        activeCount: active.size,
        max: currentMaxConcurrent,
      },
      'tryRegister rejected — at max concurrency',
    );
    return false;
  }
  active.set(session.sessionId, session);
  log.info(
    {
      sessionId: session.sessionId,
      taskId: session.taskId,
      activeCount: active.size,
      max: currentMaxConcurrent,
    },
    'session registered',
  );
  return true;
}

export function setPhase(
  sessionId: string,
  phase: ActiveSession['phase'],
  pid?: number,
): void {
  const s = active.get(sessionId);
  if (!s) return;
  s.phase = phase;
  if (pid !== undefined) s.pid = pid;
}

export function unregister(sessionId: string): void {
  if (active.delete(sessionId)) {
    log.info({ sessionId, activeCount: active.size }, 'session unregistered');
  }
}

export interface CancelResult {
  ok: boolean;
  reason: string;
  pid?: number;
}

/**
 * SIGTERM the child PID for a session. Caller is responsible for marking the
 * session row in DB. Returns ok=false if the session isn't in the active map
 * or has no pid recorded.
 */
export function killSession(
  sessionId: string,
  signal: NodeJS.Signals = 'SIGTERM',
): CancelResult {
  const s = active.get(sessionId);
  if (!s) return { ok: false, reason: 'session not active' };
  if (s.pid === undefined) return { ok: false, reason: 'no pid recorded' };
  try {
    // Negative pid = process group (we spawn detached → child is its own
    // group leader; this kills any subprocesses too).
    try {
      process.kill(-s.pid, signal);
    } catch {
      process.kill(s.pid, signal);
    }
    return { ok: true, reason: `${signal} sent`, pid: s.pid };
  } catch (err) {
    return { ok: false, reason: String(err), pid: s.pid };
  }
}
