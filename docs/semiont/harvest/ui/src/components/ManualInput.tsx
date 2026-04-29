/**
 * Section 6: 手動操作 — drop a topic + scheduler controls.
 */
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/solid-query';
import { For, Show, createMemo, createSignal } from 'solid-js';
import { api } from '~/lib/api';
import { getQueryClient } from '~/lib/query-client';
import type {
  BootProfile,
  NewTaskBody,
  TaskPriority,
  TaskType,
} from '~/lib/types';

const TASK_TYPES: TaskType[] = [
  'article-rewrite',
  'article-new',
  'article-evolve',
  'spore-publish',
  'spore-harvest',
  'pr-review',
  'issue-handle',
  'data-refresh',
  'status-report',
  'self-diagnose',
  'heartbeat',
];

const BOOT_PROFILES: BootProfile[] = [
  'minimal',
  'content-writing',
  'spore-publishing',
  'maintainer',
  'full-awakening',
];

const PRIORITIES: TaskPriority[] = ['P0', 'P1', 'P2', 'P3'];

const TYPE_TO_PROFILE: Record<string, BootProfile> = {
  'article-rewrite': 'content-writing',
  'article-new': 'content-writing',
  'article-evolve': 'content-writing',
  'spore-publish': 'spore-publishing',
  'spore-harvest': 'spore-publishing',
  'pr-review': 'maintainer',
  'issue-handle': 'maintainer',
  'data-refresh': 'minimal',
  'status-report': 'minimal',
  'self-diagnose': 'full-awakening',
  heartbeat: 'full-awakening',
};

function Inner() {
  const qc = useQueryClient();

  const [type, setType] = createSignal<TaskType>('article-rewrite');
  const [profile, setProfile] = createSignal<BootProfile>('content-writing');
  const [profileTouched, setProfileTouched] = createSignal(false);
  const [priority, setPriority] = createSignal<TaskPriority>('P2');
  const [title, setTitle] = createSignal('');
  const [notes, setNotes] = createSignal('');
  const [errMsg, setErrMsg] = createSignal('');

  // Auto-suggest profile when type changes (unless user manually picked one)
  const effectiveProfile = createMemo<BootProfile>(() => {
    if (profileTouched()) return profile();
    return TYPE_TO_PROFILE[type()] ?? profile();
  });

  const create = useMutation(() => ({
    mutationFn: (body: NewTaskBody) => api.createTask(body),
    onSuccess: () => {
      setTitle('');
      setNotes('');
      setErrMsg('');
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => setErrMsg(String(e)),
  }));

  const submit = (e: Event): void => {
    e.preventDefault();
    if (!title().trim()) {
      setErrMsg('title 必填');
      return;
    }
    create.mutate({
      type: type(),
      boot_profile: effectiveProfile(),
      priority: priority(),
      title: title().trim(),
      notes: notes().trim() || undefined,
      created_by: 'cheyu-ui',
    });
  };

  // Health for scheduler-state-aware buttons
  const health = useQuery(() => ({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 5_000,
  }));

  const pauseMut = useMutation(() => ({
    mutationFn: () => api.pause(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['health'] }),
  }));
  const resumeMut = useMutation(() => ({
    mutationFn: () => api.resume(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['health'] }),
  }));
  const scanMut = useMutation(() => ({
    mutationFn: () => api.intakeScan(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  }));

  return (
    <div class="space-y-3">
      <form class="space-y-3" onSubmit={submit}>
        <div>
          <label class="section-title block mb-1">title *</label>
          <input
            class="input"
            placeholder="例：寫一篇關於沈伯洋的文章"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            required
          />
        </div>
        <div>
          <label class="section-title block mb-1">type</label>
          <select
            class="select w-full"
            value={type()}
            onChange={(e) => {
              setType(e.currentTarget.value as TaskType);
              setProfileTouched(false);
            }}
          >
            <For each={TASK_TYPES}>{(t) => <option value={t}>{t}</option>}</For>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="section-title block mb-1">
              boot profile
              <Show when={!profileTouched()}>
                <span class="ml-1 text-[10px] text-text-muted">(auto)</span>
              </Show>
            </label>
            <select
              class="select w-full"
              value={effectiveProfile()}
              onChange={(e) => {
                setProfile(e.currentTarget.value as BootProfile);
                setProfileTouched(true);
              }}
            >
              <For each={BOOT_PROFILES}>
                {(p) => <option value={p}>{p}</option>}
              </For>
            </select>
          </div>
          <div>
            <label class="section-title block mb-1">priority</label>
            <select
              class="select w-full"
              value={priority()}
              onChange={(e) =>
                setPriority(e.currentTarget.value as TaskPriority)
              }
            >
              <For each={PRIORITIES}>
                {(p) => <option value={p}>{p}</option>}
              </For>
            </select>
          </div>
        </div>
        <div>
          <label class="section-title block mb-1">notes</label>
          <textarea
            class="textarea h-24"
            placeholder="可選 — 來源連結 / 觀察者素材 / 額外指示"
            value={notes()}
            onInput={(e) => setNotes(e.currentTarget.value)}
          />
        </div>

        <Show when={errMsg()}>
          <div class="text-xs text-accent-red">{errMsg()}</div>
        </Show>
        <Show when={create.isSuccess}>
          <div class="text-xs text-accent-green-soft">
            ok · created task <code>{create.data?.id}</code>
          </div>
        </Show>

        <div class="flex items-center gap-2">
          <button
            type="submit"
            class="btn btn-primary"
            disabled={create.isPending}
          >
            {create.isPending ? 'submitting…' : 'submit topic'}
          </button>
          <button
            type="button"
            class="btn"
            onClick={() => {
              setTitle('');
              setNotes('');
              setErrMsg('');
            }}
          >
            clear
          </button>
        </div>
      </form>

      {/* Scheduler control moved to right-column SchedulerControl panel */}
    </div>
  );
}

export default function ManualInput() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <Inner />
    </QueryClientProvider>
  );
}
