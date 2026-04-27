/**
 * Phase 2.5 — TaskRow with per-card spawn button + live status indicator.
 *
 * Layout: [emoji] [pills + title + meta] [optional active marker] [▶️ button]
 *
 * Spawn button visibility:
 *   - shown only if status ∈ {pending, failed, awaiting-cheyu}
 *     AND no active session for this task
 *   - disabled with tooltip when:
 *       · max concurrent reached → "已達 max concurrent (N)"
 *       · status not eligible    → "task in {status} state, 不能 spawn"
 *
 * Active state: cross-references /api/sessions/active by taskId.
 *   When a session for this task is active, swap button for a disabled
 *   "⏳ 進行中" pill and show a pulsing dot + "✦ {phase} · {elapsed}".
 *
 * dryDispatch: when ?dryDispatch=true is set on the URL we send dry=true so
 *   cheyu can verify the wiring without burning Claude tokens.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/solid-query';
import { Show, createMemo, createSignal } from 'solid-js';
import { api, ApiError } from '~/lib/api';
import {
  elapsedSince,
  priorityBadgeClass,
  relativeTime,
  statusBadgeClass,
  typeEmoji,
} from '~/lib/format';
import type { ActiveSession, Task } from '~/lib/types';

const SPAWN_ELIGIBLE = new Set(['pending', 'failed', 'awaiting-cheyu']);

function isDryDispatch(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      new URLSearchParams(window.location.search).get('dryDispatch') === 'true'
    );
  } catch {
    return false;
  }
}

export default function TaskRow(props: {
  task: Task;
  onClick?: (task: Task) => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const t = (): Task => props.task;

  // Subscribe to the shared active-sessions query so this row pulses live.
  const sessionsQ = useQuery(() => ({
    queryKey: ['sessions', 'active'],
    queryFn: () => api.activeSessions(),
    refetchInterval: 2_000,
    retry: 0,
  }));

  const myActive = createMemo<ActiveSession | undefined>(() =>
    sessionsQ.data?.sessions.find((s) => s.taskId === t().id),
  );

  const atCapacity = createMemo<boolean>(() => {
    const d = sessionsQ.data;
    if (!d) return false;
    return d.count >= d.max;
  });

  const [errMsg, setErrMsg] = createSignal<string | null>(null);
  let errTimer: number | undefined;
  const flashError = (m: string): void => {
    setErrMsg(m);
    if (typeof window !== 'undefined') {
      if (errTimer) window.clearTimeout(errTimer);
      errTimer = window.setTimeout(() => setErrMsg(null), 3000);
    }
  };

  const spawnMut = useMutation(() => ({
    mutationFn: () =>
      api.spawnTask(t().id, { dry: isDryDispatch() ? true : false }),
    // Optimistic: set local sessionsQ cache to insert a fake "spawning" entry.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['sessions', 'active'] });
      const prev = qc.getQueryData<{
        count: number;
        max: number;
        sessions: ActiveSession[];
      }>(['sessions', 'active']);
      if (prev) {
        const optimistic: ActiveSession = {
          sessionId: `optimistic-${t().id}`,
          taskId: t().id,
          taskTitle: t().title,
          taskType: t().type,
          bootProfile: t().boot_profile,
          spawnedAt: new Date().toISOString(),
          phase: 'spawning',
        };
        qc.setQueryData(['sessions', 'active'], {
          count: prev.count + 1,
          max: prev.max,
          sessions: [...prev.sessions, optimistic],
        });
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['sessions', 'active'], ctx.prev);
      if (err instanceof ApiError) {
        if (err.status === 409) {
          flashError('409 · 已達 max concurrent 或 task 狀態不允許');
        } else {
          flashError(`spawn 失敗 (${err.status})`);
        }
      } else {
        flashError('spawn 失敗 · 網路錯誤');
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['sessions', 'active'] });
    },
  }));

  const eligible = (): boolean => SPAWN_ELIGIBLE.has(t().status);
  const spawnDisabled = (): boolean =>
    spawnMut.isPending || atCapacity() || !eligible();

  const spawnTooltip = (): string => {
    if (spawnMut.isPending) return 'spawning…';
    if (!eligible()) return `task in ${t().status} state, 不能 spawn`;
    if (atCapacity())
      return `已達 max concurrent (${sessionsQ.data?.max ?? '?'})`;
    return isDryDispatch() ? '▶️ dry-dispatch (no real claude)' : '▶️ 執行';
  };

  const onSpawnClick = (e: MouseEvent): void => {
    e.stopPropagation();
    if (spawnDisabled()) return;
    spawnMut.mutate();
  };

  const onRowClick = (): void => {
    props.onClick?.(t());
  };

  return (
    <div
      class={`relative w-full flex items-center gap-3 px-3 py-2 rounded-md
              border transition-colors
              ${
                myActive()
                  ? 'border-accent-amber/40 bg-accent-amber/5'
                  : 'border-transparent hover:border-line hover:bg-bg-raised'
              }`}
    >
      <Show when={myActive()}>
        <span
          class={`absolute left-1 top-1/2 -translate-y-1/2 inline-block w-1.5 h-1.5 rounded-full animate-pulse ${
            myActive()!.phase === 'spawning'
              ? 'bg-accent-amber'
              : 'bg-accent-green'
          }`}
          aria-hidden="true"
        />
      </Show>

      <button
        type="button"
        onClick={onRowClick}
        class="flex items-center gap-3 min-w-0 flex-1 text-left
               focus:outline-none"
      >
        <div class="text-xl shrink-0">{typeEmoji(t().type)}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-0.5">
            <span class={`pill ${statusBadgeClass(t().status)}`}>
              {t().status}
            </span>
            <span class={`pill ${priorityBadgeClass(t().priority)}`}>
              {t().priority}
            </span>
            <Show when={!props.compact}>
              <span class="text-xs text-text-muted truncate">{t().type}</span>
            </Show>
          </div>
          <div class="text-sm text-text-primary truncate">{t().title}</div>
          <Show when={myActive()}>
            <div class="text-xs text-accent-amber">
              ✦ {myActive()!.phase} · {elapsedSince(myActive()!.spawnedAt)}
            </div>
          </Show>
          <Show when={!props.compact && !myActive()}>
            <div class="text-xs text-text-muted truncate">
              {relativeTime(t().created_at)} · by {t().created_by}
              {t().sessions.length > 0
                ? ` · ${t().sessions.length} session(s)`
                : ''}
            </div>
          </Show>
        </div>
      </button>

      <div class="shrink-0 flex flex-col items-end gap-1">
        <Show when={myActive()}>
          <span
            class="pill bg-accent-amber/15 text-accent-amber border border-accent-amber/40 cursor-not-allowed"
            title="cancel coming in Phase 3"
          >
            ⏳ 進行中
          </span>
        </Show>
        <Show when={!myActive() && eligible()}>
          <button
            type="button"
            class={`btn ${spawnDisabled() ? '' : 'btn-primary'}`}
            disabled={spawnDisabled()}
            title={spawnTooltip()}
            onClick={onSpawnClick}
          >
            <Show when={!spawnMut.isPending} fallback={<span>spawning…</span>}>
              <span>▶️</span>
              <span>執行</span>
              <Show when={isDryDispatch()}>
                <span class="text-[10px] opacity-70">(dry)</span>
              </Show>
            </Show>
          </button>
        </Show>
        <Show when={errMsg()}>
          <span class="text-[11px] text-accent-red max-w-[180px] text-right">
            {errMsg()}
          </span>
        </Show>
      </div>
    </div>
  );
}
