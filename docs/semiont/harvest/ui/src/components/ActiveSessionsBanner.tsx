/**
 * Phase 2.5 — full-width banner shown above 即時運作 when count > 0.
 * Compact summary: header line + one row per session. Each row is a
 * link to /sessions for the deep-dive panel.
 *
 * Hidden when count = 0 (no visual noise on idle).
 */
import { QueryClientProvider, useQuery } from '@tanstack/solid-query';
import { For, Show } from 'solid-js';
import { api } from '~/lib/api';
import { getQueryClient } from '~/lib/query-client';
import { elapsedSince, typeEmoji } from '~/lib/format';
import type { ActiveSession } from '~/lib/types';

function phasePill(phase: ActiveSession['phase']): string {
  if (phase === 'spawning')
    return 'bg-accent-amber/20 text-accent-amber border border-accent-amber/40';
  return 'bg-accent-green/15 text-accent-green-soft border border-accent-green/40';
}

function phaseLabel(phase: ActiveSession['phase']): string {
  return phase === 'spawning' ? '▶️ spawning' : '⚙️ in-progress';
}

function Inner() {
  const q = useQuery(() => ({
    queryKey: ['sessions', 'active'],
    queryFn: () => api.activeSessions(),
    refetchInterval: 2_000,
    retry: 0,
  }));

  const count = (): number => q.data?.count ?? 0;
  const max = (): number => q.data?.max ?? 3;
  const sessions = (): ActiveSession[] => q.data?.sessions ?? [];
  const full = (): boolean => count() > 0 && count() >= max();

  return (
    <Show when={count() > 0}>
      <section
        class={`card ${
          full() ? 'border-accent-red/40' : 'border-accent-amber/40'
        }`}
      >
        <div class="card-body">
          <div class="flex items-center gap-2 mb-3">
            <span
              class={`inline-block w-2 h-2 rounded-full animate-pulse ${
                full() ? 'bg-accent-red' : 'bg-accent-amber'
              }`}
            />
            <h2 class="text-sm font-semibold text-text-primary">
              🏃 {count()} session{count() > 1 ? 's' : ''} running · max {max()}
              <Show when={full()}>
                <span class="ml-2 text-accent-red text-xs font-medium">
                  (full capacity)
                </span>
              </Show>
            </h2>
            <a
              href="/sessions"
              class="ml-auto text-xs text-accent-green-soft hover:underline"
            >
              deep dive →
            </a>
          </div>
          <ul class="space-y-1.5">
            <For each={sessions()}>
              {(s) => (
                <li>
                  <a
                    href="/sessions"
                    class="flex items-center gap-3 px-3 py-2 rounded-md
                           border border-line bg-bg-raised hover:bg-bg-input
                           transition-colors no-underline"
                  >
                    <span class={`pill ${phasePill(s.phase)}`}>
                      {phaseLabel(s.phase)}
                    </span>
                    <span class="text-base">{typeEmoji(s.taskType)}</span>
                    <span class="text-sm text-text-primary truncate flex-1">
                      {s.taskTitle}
                    </span>
                    <span class="text-xs text-text-muted whitespace-nowrap">
                      {elapsedSince(s.spawnedAt)} elapsed
                    </span>
                    <Show when={s.pid}>
                      <span class="text-xs text-text-muted whitespace-nowrap">
                        · pid {s.pid}
                      </span>
                    </Show>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </div>
      </section>
    </Show>
  );
}

export default function ActiveSessionsBanner() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <Inner />
    </QueryClientProvider>
  );
}
