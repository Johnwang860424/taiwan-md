/**
 * In-process cron.
 *
 * Phase 1: daily-report at 08:00 +0800.
 * Phase 4 additions:
 *   - Hourly: PR audit + Issue audit
 *   - Daily 09:00 +0800: contributor thank-you scan
 *   - Daily 10:00 +0800: translation ratio audit
 *   - Daily 11:00 +0800: terminology patrol
 *   - Daily 18:00 +0800: 3-day no-spore detector
 *   - Every 6h: organ drift scan
 */

import { child } from '../logger.ts';
import { generateDailyReport } from '../reporter/daily.ts';
import {
  auditOpenPrs,
  auditOpenIssues,
  scanContributorThankYous,
  auditTranslationRatios,
  patrolTerminology,
} from './maintainer.ts';
import { checkOrganDrift, checkNoSpore } from './self-diagnose.ts';

const log = child({ module: 'scheduler/cron' });

interface DailyJob {
  kind: 'daily';
  name: string;
  hour: number;
  minute: number;
  tzOffsetMin: number;
  run: () => Promise<void> | void;
  timer?: ReturnType<typeof setTimeout>;
}

interface IntervalJob {
  kind: 'interval';
  name: string;
  intervalMs: number;
  run: () => Promise<void> | void;
  timer?: ReturnType<typeof setInterval>;
}

type Job = DailyJob | IntervalJob;

const TAIPEI_OFFSET_MIN = 8 * 60;

const jobs: Job[] = [];

export function scheduleDaily(
  name: string,
  hour: number,
  minute: number,
  run: () => Promise<void> | void,
  tzOffsetMin: number = TAIPEI_OFFSET_MIN,
): void {
  const job: DailyJob = { kind: 'daily', name, hour, minute, tzOffsetMin, run };
  jobs.push(job);
  arm(job);
}

export function scheduleInterval(
  name: string,
  intervalMs: number,
  run: () => Promise<void> | void,
): void {
  const job: IntervalJob = { kind: 'interval', name, intervalMs, run };
  jobs.push(job);
  job.timer = setInterval(async () => {
    if (_paused) return;
    log.info({ job: job.name }, 'cron firing (interval)');
    try {
      await job.run();
    } catch (err) {
      log.error({ job: job.name, err: String(err) }, 'cron job failed');
    }
  }, intervalMs);
  log.info({ job: job.name, intervalMs }, 'interval cron armed');
}

function arm(job: DailyJob): void {
  const delayMs = msUntilNext(job.hour, job.minute, job.tzOffsetMin);
  job.timer = setTimeout(async () => {
    log.info({ job: job.name }, 'cron firing');
    try {
      await job.run();
      log.info({ job: job.name }, 'cron job complete');
    } catch (err) {
      log.error({ job: job.name, err: String(err) }, 'cron job failed');
    } finally {
      arm(job);
    }
  }, delayMs);
  log.info(
    {
      job: job.name,
      fireInMs: delayMs,
      fireInMin: Math.round(delayMs / 60000),
    },
    'cron armed',
  );
}

export function msUntilNext(
  hour: number,
  minute: number,
  tzOffsetMin: number,
): number {
  const now = new Date();
  const nowTz = new Date(now.getTime() + tzOffsetMin * 60_000);
  const targetTz = new Date(nowTz);
  targetTz.setUTCHours(hour, minute, 0, 0);
  if (targetTz <= nowTz) targetTz.setUTCDate(targetTz.getUTCDate() + 1);
  return targetTz.getTime() - nowTz.getTime();
}

export function startScheduler(): void {
  scheduleDaily('daily-report', 8, 0, async () => {
    await generateDailyReport();
  });
  scheduleDaily('contributor-thank-you-scan', 9, 0, async () => {
    await scanContributorThankYous();
  });
  scheduleDaily('translation-ratio-audit', 10, 0, async () => {
    await auditTranslationRatios();
  });
  scheduleDaily('terminology-patrol', 11, 0, async () => {
    await patrolTerminology();
  });
  scheduleDaily('no-spore-detector', 18, 0, async () => {
    await checkNoSpore();
  });

  scheduleInterval('pr-audit', 60 * 60 * 1000, async () => {
    await auditOpenPrs();
  });
  scheduleInterval('issue-audit', 60 * 60 * 1000, async () => {
    await auditOpenIssues();
  });
  scheduleInterval('organ-drift', 6 * 60 * 60 * 1000, async () => {
    await checkOrganDrift();
  });

  // Phase 5 (2026-04-29): Master Review — every 4hr, full BECOME_TAIWANMD
  // self-diagnose task created in queue. Uses existing self-diagnose task
  // type but with explicit "Master Review" framing (盤點 + 反思 + 進化).
  // Also fires when session counter hits multiples of 10 (see session-counter.ts).
  scheduleInterval('master-review-4hr', 4 * 60 * 60 * 1000, async () => {
    await scheduleMasterReview('4hr-cron');
  });

  log.info({ jobs: jobs.map((j) => j.name) }, 'scheduler started');
}

/**
 * Master Review task creator. Used by both 4hr cron + every-10-sessions trigger.
 * Reuses self-diagnose task type with full-awakening boot profile.
 */
export async function scheduleMasterReview(
  reason: '4hr-cron' | 'session-counter' | 'manual',
): Promise<void> {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // De-dupe: skip if there's already a pending Master Review created < 1hr ago
  try {
    const { listTasks, createTask } = await import('../tasks/manager.ts');
    const recent = listTasks({ status: 'pending', limit: 50 });
    const cutoff = Date.now() - 60 * 60 * 1000;
    const dup = recent.find(
      (t) =>
        t.title.startsWith('Master Review') &&
        new Date(t.created_at).getTime() > cutoff,
    );
    if (dup) {
      log.info(
        { reason, existing: dup.id },
        'master-review skipped — pending task < 1hr old',
      );
      return;
    }
    createTask({
      type: 'self-diagnose',
      boot_profile: 'full-awakening',
      priority: 'P1',
      title: `Master Review (${reason}) ${ts}`,
      created_by: `master-review:${reason}`,
      notes:
        '完整甦醒為 Taiwan.md，做 4.5 拍心跳 + 盤點上次 review 以來的工作 + 反思進化方向。' +
        ' 目標：自我診斷、紀錄、提出下一輪改進建議。',
      inputs: { reason, master_review: true },
    });
    log.info({ reason }, 'master-review task created');
  } catch (err) {
    log.error({ err: String(err), reason }, 'master-review creation failed');
  }
}

export function stopScheduler(): void {
  for (const job of jobs) {
    if (job.kind === 'daily' && job.timer) clearTimeout(job.timer);
    if (job.kind === 'interval' && job.timer) clearInterval(job.timer);
    job.timer = undefined;
  }
  jobs.length = 0;
  log.info('scheduler stopped');
}

// Phase 5.1 (2026-04-30): default paused on boot per cheyu's request — prevents
// accidental auto-spawn on backend restart (e.g. mid-config / mid-deploy). UI
// must explicitly POST /api/control/resume to start timers.
let _paused = true;
export function pauseScheduler(): void {
  if (_paused) return;
  stopScheduler();
  _paused = true;
}
export function resumeScheduler(): void {
  if (!_paused) return;
  startScheduler();
  _paused = false;
}
export function isPaused(): boolean {
  return _paused;
}
