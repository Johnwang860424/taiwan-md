/**
 * SchedulerControl — checkbox per task type to enable/disable auto-spawn.
 *
 * Per cheyu's 駕駛艙 spec: PR-touching types stay manual (default OFF);
 * article-* / lang-sync-* / data-refresh default ON. Manual spawn always
 * works regardless of this policy.
 *
 * Phase 5 (2026-04-29).
 */
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/solid-query';
import { For, Show } from 'solid-js';
import { api } from '~/lib/api';
import { getQueryClient } from '~/lib/query-client';

function emojiForType(t: string): string {
  if (t.startsWith('article-')) return '📝';
  if (t.startsWith('lang-sync')) return '🌐';
  if (t === 'pr-review') return '🔍';
  if (t === 'issue-handle') return '📨';
  if (t === 'data-refresh') return '📊';
  if (t === 'spore-publish') return '🌱';
  if (t === 'self-diagnose') return '🩺';
  if (t === 'status-report') return '📋';
  if (t === 'contributor-thank-you') return '🙏';
  if (t === 'format-check') return '✅';
  return '🛠️';
}

function fmtTickCountdown(s: number | null): string {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function Inner() {
  const qc = useQueryClient();
  const q = useQuery(() => ({
    queryKey: ['scheduler', 'types'],
    queryFn: () => api.schedulerTypes(),
    refetchInterval: 10_000,
    retry: 0,
  }));

  const cfgQ = useQuery(() => ({
    queryKey: ['scheduler', 'config'],
    queryFn: () => api.schedulerConfig(),
    refetchInterval: 5_000,
    retry: 0,
  }));

  const toggle = useMutation(() => ({
    mutationFn: (vars: { type: string; enabled: boolean }) =>
      api.setSchedulerType(vars.type, vars.enabled),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['scheduler', 'types'] });
    },
  }));

  const intervalMut = useMutation(() => ({
    mutationFn: (sec: number) => api.setSchedulerInterval(sec),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['scheduler', 'config'] });
    },
  }));

  const maxConcurrentMut = useMutation(() => ({
    mutationFn: (n: number) => api.setMaxConcurrent(n),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['scheduler', 'config'] });
      void qc.invalidateQueries({ queryKey: ['sessions', 'active'] });
    },
  }));

  const pauseMut = useMutation(() => ({
    mutationFn: () => api.pause(),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['scheduler', 'config'] });
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  }));
  const resumeMut = useMutation(() => ({
    mutationFn: () => api.resume(),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['scheduler', 'config'] });
      void qc.invalidateQueries({ queryKey: ['health'] });
    },
  }));
  const scanMut = useMutation(() => ({
    mutationFn: () => api.intakeScan(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  }));

  const intervalChoices: { label: string; sec: number }[] = [
    { label: '1m', sec: 60 },
    { label: '5m', sec: 300 },
    { label: '15m', sec: 900 },
    { label: '30m', sec: 1800 },
    { label: '60m', sec: 3600 },
  ];

  const concurrencyChoices: number[] = [1, 2, 3, 5, 8, 10];

  const types = (): typeof q.data extends undefined
    ? []
    : NonNullable<typeof q.data>['types'] => (q.data?.types ?? []) as never;

  const enabledCount = (): number =>
    (types() as { auto_spawn_enabled: boolean }[]).filter(
      (t) => t.auto_spawn_enabled,
    ).length;

  return (
    <div class="space-y-2">
      <Show when={q.isError}>
        <div class="text-xs text-accent-red">無法連線 backend</div>
      </Show>
      <Show when={cfgQ.data}>
        <div class="border border-line rounded-md p-2 mb-3 bg-bg-raised/40 space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-text-secondary">
              ⏱ next check in{' '}
              <strong class="text-accent-green-soft">
                {fmtTickCountdown(cfgQ.data?.nextTickInSec ?? null)}
              </strong>
            </span>
            <span class="text-text-muted">
              every {Math.floor((cfgQ.data?.intervalSec ?? 0) / 60)}m
            </span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-text-muted">interval:</span>
            <For each={intervalChoices}>
              {(c) => (
                <button
                  type="button"
                  class={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                    cfgQ.data?.intervalSec === c.sec
                      ? 'border-accent-green text-accent-green bg-accent-green/10'
                      : 'border-line text-text-muted hover:border-accent-green/40'
                  }`}
                  disabled={intervalMut.isPending}
                  onClick={() => intervalMut.mutate(c.sec)}
                >
                  {c.label}
                </button>
              )}
            </For>
          </div>
          <Show when={cfgQ.data?.paused}>
            <div class="text-xs text-accent-amber">
              ⚠️ scheduler paused — 暫停期間不會 auto-spawn
            </div>
          </Show>
          {/* Max concurrent agents */}
          <div class="flex items-center gap-1 pt-1 border-t border-line/40">
            <span class="text-xs text-text-muted">max agents:</span>
            <For each={concurrencyChoices}>
              {(n) => (
                <button
                  type="button"
                  class={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                    cfgQ.data?.maxConcurrent === n
                      ? 'border-accent-green text-accent-green bg-accent-green/10'
                      : 'border-line text-text-muted hover:border-accent-green/40'
                  }`}
                  disabled={maxConcurrentMut.isPending}
                  onClick={() => maxConcurrentMut.mutate(n)}
                >
                  {n}
                </button>
              )}
            </For>
            <span class="ml-auto text-xs text-text-muted">
              {cfgQ.data?.activeCount ?? 0}/{cfgQ.data?.maxConcurrent ?? 0}{' '}
              active
            </span>
          </div>
          {/* Pause / resume / scan inbox */}
          <div class="flex items-center gap-1 pt-1 border-t border-line/40 flex-wrap">
            <span class="text-xs text-text-muted mr-1">control:</span>
            <Show
              when={!cfgQ.data?.paused}
              fallback={
                <button
                  type="button"
                  class="text-xs px-2 py-0.5 rounded border border-line hover:border-accent-green text-accent-green-soft"
                  disabled={resumeMut.isPending}
                  onClick={() => resumeMut.mutate()}
                >
                  ▶ resume
                </button>
              }
            >
              <button
                type="button"
                class="text-xs px-2 py-0.5 rounded border border-line hover:border-accent-red text-text-muted hover:text-accent-red"
                disabled={pauseMut.isPending}
                onClick={() => pauseMut.mutate()}
              >
                ⏸ pause
              </button>
            </Show>
            <button
              type="button"
              class="text-xs px-2 py-0.5 rounded border border-line hover:border-accent-blue text-text-muted hover:text-accent-blue"
              disabled={scanMut.isPending}
              onClick={() => scanMut.mutate()}
              title="scan ARTICLE-INBOX"
            >
              🔄 scan inbox
            </button>
            <Show when={scanMut.isSuccess}>
              <span class="text-xs text-text-muted">
                · {scanMut.data?.detected ?? 0} new
              </span>
            </Show>
          </div>
        </div>
      </Show>
      <Show when={!q.isPending && q.data}>
        <div class="text-xs text-text-muted mb-2">
          Auto-spawn allow-list · {enabledCount()} / {types().length} enabled
          <span class="ml-2 text-accent-amber">(manual 不受影響)</span>
        </div>
        <ul class="space-y-1.5">
          <For
            each={
              types() as { task_type: string; auto_spawn_enabled: boolean }[]
            }
          >
            {(t) => (
              <li class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  id={`sched-${t.task_type}`}
                  checked={t.auto_spawn_enabled}
                  disabled={toggle.isPending}
                  onChange={(e) => {
                    toggle.mutate({
                      type: t.task_type,
                      enabled: e.currentTarget.checked,
                    });
                  }}
                  class="cursor-pointer accent-accent-green"
                />
                <label
                  for={`sched-${t.task_type}`}
                  class="cursor-pointer flex items-center gap-2 flex-1"
                >
                  <span class="text-base">{emojiForType(t.task_type)}</span>
                  <code class="text-xs text-text-primary">{t.task_type}</code>
                </label>
                <span
                  class={`text-xs ${
                    t.auto_spawn_enabled
                      ? 'text-accent-green-soft'
                      : 'text-text-muted'
                  }`}
                >
                  {t.auto_spawn_enabled ? 'auto' : 'manual'}
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

export default function SchedulerControl() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <Inner />
    </QueryClientProvider>
  );
}
