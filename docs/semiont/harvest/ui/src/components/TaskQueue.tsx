/**
 * Section 3: 任務佇列 — main work surface.
 * All tasks, filterable by status / priority / type. Sorted P0→P3 then created desc.
 */
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/solid-query';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { ApiError, api } from '~/lib/api';
import { getQueryClient } from '~/lib/query-client';
import {
  elapsedSince,
  priorityBadgeClass,
  priorityRank,
  relativeTime,
  statusBadgeClass,
  typeEmoji,
} from '~/lib/format';
import TaskDetailDrawer from './TaskDetailDrawer';
import type {
  ActiveSession,
  Task,
  TaskPriority,
  TaskStatus,
} from '~/lib/types';

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

const STATUS_FILTERS: Array<TaskStatus | 'all'> = [
  'all',
  'pending',
  'in-progress',
  'spawning',
  'blocked',
  'awaiting-cheyu',
  'done',
  'failed',
  'retired',
];
const PRIORITY_FILTERS: Array<TaskPriority | 'all'> = [
  'all',
  'P0',
  'P1',
  'P2',
  'P3',
];

function Inner() {
  const [statusF, setStatusF] = createSignal<TaskStatus | 'all'>('all');
  const [priorityF, setPriorityF] = createSignal<TaskPriority | 'all'>('all');
  const [typeF, setTypeF] = createSignal<string>('');
  const [openId, setOpenId] = createSignal<string | null>(null);

  const q = useQuery(() => ({
    queryKey: ['tasks', 'queue'],
    queryFn: () => api.listTasks({ limit: 500 }),
    refetchInterval: 5_000,
  }));

  const sessionsQ = useQuery(() => ({
    queryKey: ['sessions', 'active'],
    queryFn: () => api.activeSessions(),
    refetchInterval: 2_000,
    retry: 0,
  }));

  const activeByTask = createMemo<Map<string, ActiveSession>>(() => {
    const m = new Map<string, ActiveSession>();
    for (const s of sessionsQ.data?.sessions ?? []) m.set(s.taskId, s);
    return m;
  });

  const atCapacity = createMemo<boolean>(() => {
    const d = sessionsQ.data;
    if (!d) return false;
    return d.count >= d.max;
  });

  const filtered = createMemo<Task[]>(() => {
    const tasks = q.data?.tasks ?? [];
    const sf = statusF();
    return tasks
      .filter((t) => {
        // Skip in-progress / spawning by default — they live in 今日任務 above.
        // User can still see them by selecting status filter explicitly.
        if (
          sf === 'all' &&
          (t.status === 'in-progress' || t.status === 'spawning')
        )
          return false;
        if (sf !== 'all' && t.status !== sf) return false;
        if (priorityF() !== 'all' && t.priority !== priorityF()) return false;
        if (
          typeF() &&
          !String(t.type).toLowerCase().includes(typeF().toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        return b.created_at.localeCompare(a.created_at);
      });
  });

  return (
    <>
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <FilterChips
          label="status"
          value={statusF()}
          options={STATUS_FILTERS}
          onChange={(v) => setStatusF(v as TaskStatus | 'all')}
        />
        <FilterChips
          label="priority"
          value={priorityF()}
          options={PRIORITY_FILTERS}
          onChange={(v) => setPriorityF(v as TaskPriority | 'all')}
        />
        <input
          class="input max-w-[200px]"
          placeholder="filter type…"
          value={typeF()}
          onInput={(e) => setTypeF(e.currentTarget.value)}
        />
        <div class="ml-auto text-xs text-text-muted">
          {filtered().length} / {q.data?.count ?? 0}
        </div>
      </div>

      <Show when={q.isPending}>
        <div class="space-y-2">
          <For each={Array.from({ length: 5 })}>
            {() => <div class="skeleton h-10" />}
          </For>
        </div>
      </Show>

      <Show when={q.isError}>
        <div class="text-sm text-accent-red">
          載入失敗 ·{' '}
          <button class="btn ml-2" onClick={() => q.refetch()}>
            retry
          </button>
        </div>
      </Show>

      <Show when={!q.isPending && !q.isError}>
        <ul class="space-y-1.5">
          <For each={filtered()}>
            {(t) => (
              <SpawnRow
                task={t}
                active={activeByTask().get(t.id)}
                atCapacity={atCapacity()}
                maxConcurrent={sessionsQ.data?.max ?? 3}
                onOpen={() => setOpenId(t.id)}
              />
            )}
          </For>
          <Show when={filtered().length === 0}>
            <li class="py-6 text-center text-text-muted text-sm">
              沒有符合條件的任務
            </li>
          </Show>
        </ul>
      </Show>

      <TaskDetailDrawer taskId={openId()} onClose={() => setOpenId(null)} />
    </>
  );
}

function FilterChips(props: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div class="flex items-center gap-1 flex-wrap">
      <span class="text-xs text-text-muted mr-1">{props.label}:</span>
      <For each={props.options}>
        {(opt) => (
          <button
            type="button"
            class={`pill ${
              props.value === opt
                ? 'bg-accent-green/20 text-accent-green-soft border border-accent-green/40'
                : 'bg-bg-raised text-text-secondary border border-line hover:bg-bg-input'
            }`}
            onClick={() => props.onChange(opt)}
          >
            {opt}
          </button>
        )}
      </For>
    </div>
  );
}

/**
 * One table row with its own spawn mutation. Optimistic + 409-aware.
 */
function SpawnRow(props: {
  task: Task;
  active: ActiveSession | undefined;
  atCapacity: boolean;
  maxConcurrent: number;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
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
      api.spawnTask(props.task.id, { dry: isDryDispatch() ? true : false }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['sessions', 'active'] });
      const prev = qc.getQueryData<{
        count: number;
        max: number;
        sessions: ActiveSession[];
      }>(['sessions', 'active']);
      if (prev) {
        const optimistic: ActiveSession = {
          sessionId: `optimistic-${props.task.id}`,
          taskId: props.task.id,
          taskTitle: props.task.title,
          taskType: props.task.type,
          bootProfile: props.task.boot_profile,
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
        flashError('spawn 失敗 · 網路');
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['sessions', 'active'] });
    },
  }));

  const eligible = (): boolean => SPAWN_ELIGIBLE.has(props.task.status);
  const disabled = (): boolean =>
    spawnMut.isPending || props.atCapacity || !eligible();
  const tooltip = (): string => {
    if (!eligible()) return `task in ${props.task.status} state, 不能 spawn`;
    if (props.atCapacity) return `已達 max concurrent (${props.maxConcurrent})`;
    return isDryDispatch() ? '▶️ dry-dispatch' : '▶️ 執行';
  };

  const onSpawnClick = (e: MouseEvent): void => {
    e.stopPropagation();
    if (disabled()) return;
    spawnMut.mutate();
  };

  return (
    <li
      class={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer transition-colors ${
        props.active
          ? 'border-accent-amber/40 bg-accent-amber/5'
          : 'border-transparent hover:border-line hover:bg-bg-raised'
      }`}
      onClick={() => props.onOpen()}
    >
      <Show when={props.active}>
        <span
          class={`inline-block w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${
            props.active!.phase === 'spawning'
              ? 'bg-accent-amber'
              : 'bg-accent-green'
          }`}
          aria-hidden="true"
        />
      </Show>
      <span class="text-base shrink-0" title={props.task.type}>
        {typeEmoji(props.task.type)}
      </span>
      <span class={`pill shrink-0 ${priorityBadgeClass(props.task.priority)}`}>
        {props.task.priority}
      </span>
      <span class={`pill shrink-0 ${statusBadgeClass(props.task.status)}`}>
        {props.task.status}
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm text-text-primary truncate">{props.task.title}</div>
        <div class="text-[11px] text-text-muted truncate">
          {props.task.type} · {relativeTime(props.task.created_at)}
          <Show when={props.active}>
            {' · '}
            <span class="text-accent-amber">
              ✦ {props.active!.phase} · {elapsedSince(props.active!.spawnedAt)}
            </span>
          </Show>
        </div>
      </div>
      <div class="shrink-0">
        <Show when={props.active}>
          <span class="pill bg-accent-amber/15 text-accent-amber border border-accent-amber/40 text-[11px]">
            ⏳ 進行中
          </span>
        </Show>
        <Show when={!props.active && eligible()}>
          <button
            type="button"
            class={`btn ${disabled() ? '' : 'btn-primary'} text-xs px-2 py-1`}
            disabled={disabled()}
            title={tooltip()}
            onClick={onSpawnClick}
          >
            <Show when={!spawnMut.isPending} fallback={<span>…</span>}>
              <span>▶️</span>
            </Show>
          </button>
        </Show>
        <Show when={errMsg()}>
          <div class="text-[11px] text-accent-red mt-0.5">{errMsg()}</div>
        </Show>
      </div>
    </li>
  );
}

export default function TaskQueue() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <Inner />
    </QueryClientProvider>
  );
}
