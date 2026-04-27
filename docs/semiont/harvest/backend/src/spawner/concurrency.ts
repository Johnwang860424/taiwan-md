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

export function maxConcurrent(): number {
  return config.maxConcurrentSessions;
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
  return active.size < config.maxConcurrentSessions;
}

export function register(session: ActiveSession): void {
  active.set(session.sessionId, session);
  log.info(
    {
      sessionId: session.sessionId,
      taskId: session.taskId,
      activeCount: active.size,
      max: config.maxConcurrentSessions,
    },
    'session registered',
  );
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
