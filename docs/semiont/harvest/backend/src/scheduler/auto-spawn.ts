/**
 * Phase 4 — Auto-spawn loop.
 *
 * Every config.autoSpawnPollSec (default 300s = 5 min):
 *   1. Skip if scheduler paused.
 *   2. Pull pending tasks ordered by priority asc, created_at asc.
 *   3. For each, if it satisfies min_priority_for_auto_spawn AND canSpawn(),
 *      fire spawnClaudeForTask. Otherwise stop.
 *   4. Log every decision.
 *
 * Without this loop the engine is half-built — cheyu would still need to
 * click ▶️ for every P0/P1.
 */

import { config } from '../config.ts';
import { child as childLogger } from '../logger.ts';
import { isPaused } from './cron.ts';
import { canSpawn, activeForTask } from '../spawner/concurrency.ts';
import { listTasks } from '../tasks/manager.ts';
import {
  spawnClaudeForTask,
  ConcurrencyLimitError,
} from '../spawner/claude-cli.ts';
import { logger } from '../logger.ts';
import type { TaskPriority } from '../tasks/types.ts';
import { isTypeAutoSpawnEnabled } from './type-policy.ts';

const log = childLogger({ module: 'scheduler/auto-spawn' });

let timer: ReturnType<typeof setInterval> | null = null;
let lastTickAt: number = 0;
let currentIntervalMs: number = 300_000; // overridable via setAutoSpawnInterval

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function startAutoSpawn(): void {
  if (timer) return;
  if (config.disableAutoSpawn) {
    log.info('auto-spawn disabled via env');
    return;
  }
  currentIntervalMs = config.autoSpawnPollSec * 1000;
  startWithInterval(currentIntervalMs);
}

function startWithInterval(intervalMs: number): void {
  if (timer) clearInterval(timer);
  currentIntervalMs = intervalMs;
  timer = setInterval(() => {
    lastTickAt = Date.now();
    tick().catch((err) =>
      log.error({ err: String(err) }, 'auto-spawn tick failed'),
    );
  }, intervalMs);
  log.info(
    { intervalMs, minPriority: config.autoSpawnMinPriority },
    'auto-spawn (re)started',
  );
}

export function stopAutoSpawn(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Phase 5 — runtime interval override. Resets timer if running. */
export function setAutoSpawnInterval(seconds: number): number {
  const ms = Math.max(30, Math.floor(seconds)) * 1000;
  if (timer) startWithInterval(ms);
  else currentIntervalMs = ms;
  return Math.floor(ms / 1000);
}

export function getAutoSpawnRuntime(): {
  intervalSec: number;
  lastTickIso: string | null;
  nextTickInSec: number | null;
  running: boolean;
} {
  const now = Date.now();
  const next = lastTickAt
    ? Math.max(0, Math.ceil((lastTickAt + currentIntervalMs - now) / 1000))
    : null;
  return {
    intervalSec: Math.floor(currentIntervalMs / 1000),
    lastTickIso: lastTickAt ? new Date(lastTickAt).toISOString() : null,
    nextTickInSec: next,
    running: timer !== null,
  };
}

async function tick(): Promise<void> {
  if (isPaused()) {
    log.debug('auto-spawn skipped — scheduler paused');
    return;
  }
  const minRank = PRIORITY_RANK[config.autoSpawnMinPriority] ?? 1;
  const candidates = listTasks({ status: 'pending', limit: 20 });
  if (candidates.length === 0) {
    log.debug('auto-spawn: no pending tasks');
    return;
  }
  for (const task of candidates) {
    if (!canSpawn()) {
      log.info(
        { remaining: candidates.length },
        'auto-spawn: max concurrent reached, stopping',
      );
      return;
    }
    const rank = PRIORITY_RANK[task.priority] ?? 99;
    if (rank > minRank) {
      log.debug(
        {
          taskId: task.id,
          priority: task.priority,
          minPriority: config.autoSpawnMinPriority,
        },
        'auto-spawn: priority too low, skipping',
      );
      continue;
    }
    if (activeForTask(task.id)) {
      log.debug(
        { taskId: task.id },
        'auto-spawn: task already active, skipping',
      );
      continue;
    }
    if (task.attempts >= task.max_attempts) {
      log.debug(
        { taskId: task.id, attempts: task.attempts },
        'auto-spawn: max attempts hit, skipping',
      );
      continue;
    }
    if (!isTypeAutoSpawnEnabled(task.type)) {
      log.debug(
        { taskId: task.id, type: task.type },
        'auto-spawn: task type disabled in policy, skipping (manual only)',
      );
      continue;
    }
    log.info(
      {
        taskId: task.id,
        type: task.type,
        priority: task.priority,
        attempts: task.attempts,
      },
      'auto-spawn: dispatching',
    );
    spawnClaudeForTask(task, { dryRun: false }).catch((err) => {
      if (err instanceof ConcurrencyLimitError) {
        log.info(
          { taskId: task.id },
          'auto-spawn: tryRegister rejected — slot taken by parallel spawn',
        );
        return;
      }
      logger.error(
        { err: String(err), taskId: task.id },
        'auto-spawn: background spawn failed',
      );
    });
  }
}

export function autoSpawnConfigSummary(): {
  enabled: boolean;
  intervalSec: number;
  minPriority: TaskPriority | string;
} {
  return {
    enabled: !config.disableAutoSpawn,
    intervalSec: config.autoSpawnPollSec,
    minPriority: config.autoSpawnMinPriority,
  };
}
