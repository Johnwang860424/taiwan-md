/**
 * Phase 2.5 — Session deep-dive list. Each item expandable to show full
 * UUID / pid / phase / elapsed / boot profile / task type / task title.
 * Phase 3 will stream log content here.
 */
import { QueryClientProvider, useQuery } from '@tanstack/solid-query';
import { For, Show, createSignal } from 'solid-js';
import { api } from '~/lib/api';
import { getQueryClient } from '~/lib/query-client';
import { elapsedSince, formatDateTime, typeEmoji } from '~/lib/format';
import type { ActiveSession } from '~/lib/types';

function Inner() {
  const q = useQuery(() => ({
    queryKey: ['sessions', 'active'],
    queryFn: () => api.activeSessions(),
    refetchInterval: 2_000,
    retry: 0,
  }));

  const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
  const toggle = (id: string): void => {
    const next = new Set(expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const sessions = (): ActiveSession[] => q.data?.sessions ?? [];

  return (
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-sm">
        <Show when={q.isError}>
          <span class="text-accent-red">無法連線 backend</span>
        </Show>
        <Show when={!q.isError}>
          <span class="text-text-secondary">
            {q.data?.count ?? 0} / {q.data?.max ?? 3} active
          </span>
          <span class="text-text-muted text-xs">· refresh 2s</span>
        </Show>
      </div>

      <Show when={q.isPending}>
        <div class="space-y-2">
          <For each={Array.from({ length: 2 })}>
            {() => <div class="skeleton h-16" />}
          </For>
        </div>
      </Show>

      <Show when={!q.isPending && sessions().length === 0}>
        <div class="text-sm text-text-muted py-6 text-center">
          沒有 active session · 等 spawner fire 後會出現在這裡
        </div>
      </Show>

      <ul class="space-y-2">
        <For each={sessions()}>
          {(s) => {
            const isOpen = (): boolean => expanded().has(s.sessionId);
            const phaseColor =
              s.phase === 'spawning'
                ? 'bg-accent-amber/15 text-accent-amber border-accent-amber/40'
                : 'bg-accent-green/15 text-accent-green-soft border-accent-green/40';
            return (
              <li class="card">
                <button
                  type="button"
                  class="w-full text-left card-body hover:bg-bg-raised/60 transition-colors"
                  onClick={() => toggle(s.sessionId)}
                >
                  <div class="flex items-center gap-3">
                    <span
                      class={`inline-block w-2 h-2 rounded-full animate-pulse ${
                        s.phase === 'spawning'
                          ? 'bg-accent-amber'
                          : 'bg-accent-green'
                      }`}
                    />
                    <span class="text-xl">{typeEmoji(s.taskType)}</span>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class={`pill border ${phaseColor}`}>
                          {s.phase}
                        </span>
                        <span class="text-xs text-text-muted">
                          {s.taskType}
                        </span>
                        <span class="text-xs text-text-muted">
                          · boot {s.bootProfile}
                        </span>
                      </div>
                      <div class="text-sm text-text-primary truncate mt-0.5">
                        {s.taskTitle}
                      </div>
                    </div>
                    <div class="text-right text-xs text-text-muted whitespace-nowrap">
                      <div>{elapsedSince(s.spawnedAt)}</div>
                      <Show when={s.pid}>
                        <div>pid {s.pid}</div>
                      </Show>
                    </div>
                    <span class="text-text-muted text-xs ml-1">
                      {isOpen() ? '▾' : '▸'}
                    </span>
                  </div>
                </button>

                <Show when={isOpen()}>
                  <div class="border-t border-line px-4 py-3 text-xs space-y-1.5">
                    <Field label="session id">
                      <code class="break-all">{s.sessionId}</code>
                    </Field>
                    <Field label="task id">
                      <code class="break-all">{s.taskId}</code>
                    </Field>
                    <Field label="spawned at">
                      {formatDateTime(s.spawnedAt)}
                    </Field>
                    <Field label="phase">{s.phase}</Field>
                    <Field label="boot profile">{s.bootProfile}</Field>
                    <Show when={s.pid}>
                      <Field label="pid">
                        <code>{s.pid}</code>
                      </Field>
                    </Show>
                    <div class="text-text-muted pt-2 italic">
                      log streaming · Phase 3 (TODO)
                    </div>
                  </div>
                </Show>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
}

function Field(props: { label: string; children: any }) {
  return (
    <div class="flex gap-2">
      <span class="text-text-muted w-28 shrink-0">{props.label}</span>
      <span class="text-text-primary min-w-0 flex-1">{props.children}</span>
    </div>
  );
}

export default function ActiveSessionsList() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <Inner />
    </QueryClientProvider>
  );
}
