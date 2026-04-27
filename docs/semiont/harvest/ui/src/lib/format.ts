/**
 * Pure formatting helpers — relative time, color tokens per status,
 * type emojis. No Solid/Astro imports so this stays unit-testable.
 */

import type { TaskPriority, TaskStatus, TaskType } from './types';

const TYPE_EMOJI: Record<string, string> = {
  'article-rewrite': '📝',
  'article-new': '✨',
  'article-evolve': '🌿',
  'spore-publish': '🌱',
  'spore-harvest': '🍂',
  'pr-review': '🔍',
  'issue-handle': '🐛',
  'data-refresh': '🔄',
  'status-report': '📊',
  'self-diagnose': '🩺',
  heartbeat: '💗',
};

export function typeEmoji(type: TaskType | string): string {
  return TYPE_EMOJI[type] ?? '📦';
}

const STATUS_CLASSES: Record<TaskStatus, string> = {
  pending: 'bg-accent-blue/15 text-accent-blue border border-accent-blue/30',
  spawning:
    'bg-accent-amber/15 text-accent-amber border border-accent-amber/30',
  'in-progress':
    'bg-accent-amber/15 text-accent-amber border border-accent-amber/30',
  blocked:
    'bg-accent-orange/15 text-accent-orange border border-accent-orange/30',
  done: 'bg-accent-green/15 text-accent-green-soft border border-accent-green/30',
  failed: 'bg-accent-red/15 text-accent-red border border-accent-red/30',
  retired: 'bg-bg-raised text-text-muted border border-line',
  'awaiting-cheyu':
    'bg-accent-purple/15 text-accent-purple border border-accent-purple/30',
};

export function statusBadgeClass(status: TaskStatus | string): string {
  return (
    STATUS_CLASSES[status as TaskStatus] ??
    'bg-bg-raised text-text-muted border border-line'
  );
}

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  P0: 'bg-accent-red/15 text-accent-red border border-accent-red/30',
  P1: 'bg-accent-orange/15 text-accent-orange border border-accent-orange/30',
  P2: 'bg-accent-amber/15 text-accent-amber border border-accent-amber/30',
  P3: 'bg-bg-raised text-text-secondary border border-line',
};

export function priorityBadgeClass(priority: TaskPriority | string): string {
  return (
    PRIORITY_CLASSES[priority as TaskPriority] ??
    'bg-bg-raised text-text-muted border border-line'
  );
}

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
export function priorityRank(p: string): number {
  return PRIORITY_RANK[p] ?? 99;
}

export function relativeTime(iso: string | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const future = diff < 0;
  const fmt = (n: number, unit: string): string =>
    future ? `in ${n}${unit}` : `${n}${unit} ago`;
  if (abs < minute) return future ? 'soon' : 'just now';
  if (abs < hour) return fmt(Math.round(abs / minute), 'm');
  if (abs < day) return fmt(Math.round(abs / hour), 'h');
  if (abs < 30 * day) return fmt(Math.round(abs / day), 'd');
  return new Date(iso).toLocaleDateString('zh-TW');
}

/** "12s" / "4m 12s" / "1h 04m" — elapsed since iso, compact. */
export function elapsedSince(iso: string | undefined): string {
  if (!iso) return '—';
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return '—';
  const ms = Math.max(0, Date.now() - start);
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60)
    return remSec > 0
      ? `${min}m ${remSec.toString().padStart(2, '0')}s`
      : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin.toString().padStart(2, '0')}m`;
}

export function formatLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-TW', { hour12: false });
  } catch {
    return iso;
  }
}

const TREND_ARROW: Record<string, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};
export function trendArrow(t: string | undefined): string {
  if (!t) return '—';
  return TREND_ARROW[t] ?? '→';
}

export function trendClass(t: string | undefined): string {
  if (t === 'up') return 'text-accent-green-soft';
  if (t === 'down') return 'text-accent-red';
  return 'text-text-secondary';
}

/** First metric value as a short label, e.g. {articlesLast7Days:110} → "110 / 7d". */
export function firstMetricSummary(
  metrics: Record<string, unknown> | undefined,
): string {
  if (!metrics) return '';
  const entries = Object.entries(metrics);
  if (entries.length === 0) return '';
  // Prefer the first scalar (number/string) entry. Skip nested objects so
  // organs whose first metric is a map (e.g. languageCoverage = {zh:588,en:407,…})
  // don't render as "[object Object]". If a scalar twin exists later (e.g.
  // translationPct), use that. Otherwise summarise the object inline.
  const scalar = entries.find(
    ([, v]) =>
      typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean',
  );
  const [k, v] = scalar ?? entries[0]!;
  let value: string;
  if (typeof v === 'number') value = v.toLocaleString();
  else if (typeof v === 'string') value = v;
  else if (typeof v === 'boolean') value = v ? 'true' : 'false';
  else if (v && typeof v === 'object') {
    // Inline-summarise small objects: take up to 3 numeric entries.
    const inner = Object.entries(v as Record<string, unknown>)
      .filter(([, iv]) => typeof iv === 'number')
      .slice(0, 3)
      .map(([ik, iv]) => `${ik} ${iv}`)
      .join(' · ');
    value = inner || '—';
  } else {
    value = String(v);
  }
  const label = k
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
  return `${value} · ${label}`;
}
