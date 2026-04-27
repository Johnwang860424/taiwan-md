/**
 * Phase 2.5 — header-right badge that always shows current spawn capacity.
 * Polls /api/sessions/active every 2s. Click → /sessions deep-dive.
 *
 * Color states:
 *   green  · count = 0       (idle, capacity free)
 *   amber  · 0 < count < max (running)
 *   red    · count = max     (saturation, no spawns possible)
 */
import { QueryClientProvider, useQuery } from '@tanstack/solid-query';
import { Show } from 'solid-js';
import { api } from '~/lib/api';
import { getQueryClient } from '~/lib/query-client';

function Badge() {
  const q = useQuery(() => ({
    queryKey: ['sessions', 'active'],
    queryFn: () => api.activeSessions(),
    refetchInterval: 2_000,
    retry: 0,
  }));

  const count = (): number => q.data?.count ?? 0;
  const max = (): number => q.data?.max ?? 3;
  const offline = (): boolean => q.isError;

  const tone = (): 'green' | 'amber' | 'red' | 'muted' => {
    if (offline()) return 'muted';
    if (count() <= 0) return 'green';
    if (count() >= max()) return 'red';
    return 'amber';
  };

  const className = (): string => {
    const t = tone();
    if (t === 'green')
      return 'bg-accent-green/15 text-accent-green-soft border-accent-green/40';
    if (t === 'amber')
      return 'bg-accent-amber/15 text-accent-amber border-accent-amber/40';
    if (t === 'red')
      return 'bg-accent-red/15 text-accent-red border-accent-red/40';
    return 'bg-bg-raised text-text-muted border-line';
  };

  const label = (): string => {
    if (offline()) return 'badge offline';
    const c = count();
    const m = max();
    if (c <= 0) return `🏃 ${c}/${m} idle`;
    if (c >= m) return `🏃 ${c}/${m} ⚠ full`;
    return `🏃 ${c}/${m} running`;
  };

  return (
    <a
      href="/sessions"
      title="open Session deep-dive"
      class={`pill border ${className()} no-underline hover:opacity-90 transition-opacity`}
    >
      <Show when={count() > 0 && !offline()}>
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      </Show>
      <span class="font-medium">{label()}</span>
    </a>
  );
}

export default function HeaderBadge() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <Badge />
    </QueryClientProvider>
  );
}
