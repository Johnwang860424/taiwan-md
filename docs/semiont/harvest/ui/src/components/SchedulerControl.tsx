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

  const setInterval = useMutation(() => ({
    mutationFn: (sec: number) => api.setSchedulerInterval(sec),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['scheduler', 'config'] });
    },
  }));

  const intervalChoices: { label: string; sec: number }[] = [
    { label: '1m', sec: 60 },
    { label: '5m', sec: 300 },
    { label: '15m', sec: 900 },
    { label: '30m', sec: 1800 },
    { label: '60m', sec: 3600 },
  ];

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
        {(() => {
          const cfg = cfgQ.data!;
          const fmt = (s: number | null): string =>
            s == null
              ? '—'
              : s < 60
                ? `${s}s`
                : `${Math.floor(s / 60)}m ${s % 60}s`;
          return (
            <div class="border border-line rounded-md p-2 mb-3 bg-bg-raised/40 space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-text-secondary">
                  ⏱ next check in{' '}
                  <strong class="text-accent-green-soft">
                    {fmt(cfg.nextTickInSec)}
                  </strong>
                </span>
                <span class="text-text-muted">
                  every {Math.floor(cfg.intervalSec / 60)}m
                </span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-xs text-text-muted">interval:</span>
                <For each={intervalChoices}>
                  {(c) => (
                    <button
                      type="button"
                      class={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                        cfg.intervalSec === c.sec
                          ? 'border-accent-green text-accent-green bg-accent-green/10'
                          : 'border-line text-text-muted hover:border-accent-green/40'
                      }`}
                      disabled={setInterval.isPending}
                      onClick={() => setInterval.mutate(c.sec)}
                    >
                      {c.label}
                    </button>
                  )}
                </For>
              </div>
              <Show when={cfg.paused}>
                <div class="text-xs text-accent-amber">
                  ⚠️ scheduler paused — 暫停期間不會 auto-spawn
                </div>
              </Show>
            </div>
          );
        })()}
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
