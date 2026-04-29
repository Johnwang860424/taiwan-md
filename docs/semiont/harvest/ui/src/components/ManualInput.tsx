/**
 * Section 6: 手動建立 — custom task / topic with full advanced options.
 *
 * Phase 5.1 (2026-04-30): added engine / model / allow_self_commit / dry_run
 * + lang-sync-specific zh_path + mode. Cheyu callout: "要不要 commit 的選項
 * 還有其他可以指定的選項也放進來".
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
  'lang-sync-refresh',
  'lang-sync-translate',
];

const BOOT_PROFILES: BootProfile[] = [
  'minimal',
  'translation-refresh',
  'spore-publishing',
  'content-writing',
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
  'lang-sync-refresh': 'translation-refresh',
  'lang-sync-translate': 'translation-refresh',
};

type Engine = 'claude' | 'codex' | 'ollama';

const ENGINES: Engine[] = ['claude', 'codex', 'ollama'];

/**
 * Per-engine model dropdown options. Empty string = let engine pick default.
 * Heavy task types (article-* / pr-review / etc) ignore non-claude engine
 * server-side, so this list is just suggestion not constraint.
 */
const MODELS_BY_ENGINE: Record<Engine, { value: string; label: string }[]> = {
  claude: [
    { value: '', label: '(default by type)' },
    { value: 'claude-sonnet-4-6', label: 'sonnet 4.6 (cheap)' },
    { value: 'claude-opus-4-6', label: 'opus 4.6 (heavy)' },
    { value: 'claude-haiku-4-5', label: 'haiku 4.5 (faster)' },
  ],
  codex: [
    { value: '', label: 'auto (subscription default)' },
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'o3', label: 'o3' },
  ],
  ollama: [
    { value: 'qwen3.5:35b-a3b-coding-nvfp4', label: 'qwen3.5 35b coding' },
    { value: 'qwen3.5:35b-a3b', label: 'qwen3.5 35b' },
    { value: 'gemma3:12b', label: 'gemma3 12b' },
    { value: 'gpt-oss:20b', label: 'gpt-oss 20b' },
    { value: 'gpt-oss:120b', label: 'gpt-oss 120b' },
  ],
};

/**
 * Task types that accept non-claude engine override (mirrors backend
 * ENGINE_ELIGIBLE_TIER in spawner/claude-cli.ts). Heavy tasks force claude.
 */
const ENGINE_OVERRIDE_OK = new Set([
  'data-refresh',
  'format-check',
  'status-report',
  'lang-sync-refresh',
  'lang-sync-translate',
]);

function Inner() {
  const qc = useQueryClient();

  const [type, setType] = createSignal<TaskType>('article-rewrite');
  const [profile, setProfile] = createSignal<BootProfile>('content-writing');
  const [profileTouched, setProfileTouched] = createSignal(false);
  const [priority, setPriority] = createSignal<TaskPriority>('P2');
  const [title, setTitle] = createSignal('');
  const [notes, setNotes] = createSignal('');

  // Phase 5.1 advanced options
  const [engine, setEngine] = createSignal<Engine>('claude');
  const [model, setModel] = createSignal<string>(''); // empty = engine default
  const [allowCommit, setAllowCommit] = createSignal(true);
  const [dryRun, setDryRun] = createSignal(false);
  const [showAdvanced, setShowAdvanced] = createSignal(false);

  // lang-sync specific
  const [zhPath, setZhPath] = createSignal('');
  const [langTarget, setLangTarget] = createSignal('en');
  const [mode, setMode] = createSignal<'auto' | 'stale' | 'missing'>('auto');

  const [errMsg, setErrMsg] = createSignal('');

  // Auto-suggest profile when type changes (unless user manually picked one)
  const effectiveProfile = createMemo<BootProfile>(() => {
    if (profileTouched()) return profile();
    return TYPE_TO_PROFILE[type()] ?? profile();
  });

  const isLangSync = createMemo<boolean>(() => type().startsWith('lang-sync'));
  const engineOverrideAllowed = createMemo<boolean>(() =>
    ENGINE_OVERRIDE_OK.has(type()),
  );

  // Reset model when engine changes (to its default)
  const onEngineChange = (e: Event): void => {
    const v = (e.currentTarget as HTMLSelectElement).value as Engine;
    setEngine(v);
    setModel(''); // reset to engine default
  };

  const create = useMutation(() => ({
    mutationFn: (body: NewTaskBody) => api.createTask(body),
    onSuccess: () => {
      setTitle('');
      setNotes('');
      setZhPath('');
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
    if (isLangSync() && !zhPath().trim()) {
      setErrMsg('lang-sync 任務必須指定 zh path');
      return;
    }

    // Build inputs from advanced options
    const inputs: Record<string, unknown> = {};
    // Engine override only applied when allowed by backend tier
    if (engineOverrideAllowed() && engine() !== 'claude') {
      inputs.engine = engine();
    }
    if (model()) inputs.model = model();
    if (!allowCommit()) inputs.allow_self_commit = false;
    if (dryRun()) inputs.dry_run = true;
    if (isLangSync()) {
      inputs.zh_path = zhPath().trim();
      inputs.lang = langTarget();
      inputs.mode = mode();
    }

    create.mutate({
      type: type(),
      boot_profile: effectiveProfile(),
      priority: priority(),
      title: title().trim(),
      notes: notes().trim() || undefined,
      created_by: 'cheyu-ui',
      inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
    });
  };

  // Health for scheduler-state-aware buttons
  const _health = useQuery(() => ({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 5_000,
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
              // reset engine to claude if new type doesn't allow override
              if (!ENGINE_OVERRIDE_OK.has(e.currentTarget.value)) {
                setEngine('claude');
                setModel('');
              }
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

        {/* Lang-sync conditional fields */}
        <Show when={isLangSync()}>
          <div class="border border-line/50 rounded-md p-2 space-y-2 bg-bg-raised/30">
            <div class="text-[11px] text-text-muted">
              lang-sync inputs (required)
            </div>
            <div>
              <label class="section-title block mb-1">zh_path *</label>
              <input
                class="input"
                placeholder="例：People/朱經武.md"
                value={zhPath()}
                onInput={(e) => setZhPath(e.currentTarget.value)}
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="section-title block mb-1">lang target</label>
                <select
                  class="select w-full"
                  value={langTarget()}
                  onChange={(e) => setLangTarget(e.currentTarget.value)}
                >
                  <option value="en">en</option>
                  <option value="ja">ja</option>
                  <option value="ko">ko</option>
                  <option value="fr">fr</option>
                  <option value="es">es</option>
                </select>
              </div>
              <div>
                <label class="section-title block mb-1">mode</label>
                <select
                  class="select w-full"
                  value={mode()}
                  onChange={(e) =>
                    setMode(
                      e.currentTarget.value as 'auto' | 'stale' | 'missing',
                    )
                  }
                >
                  <option value="auto">auto (resolve)</option>
                  <option value="stale">stale (refresh existing)</option>
                  <option value="missing">missing (translate fresh)</option>
                </select>
              </div>
            </div>
          </div>
        </Show>

        {/* Advanced options accordion */}
        <div>
          <button
            type="button"
            class="text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1"
            onClick={() => setShowAdvanced(!showAdvanced())}
          >
            <span>{showAdvanced() ? '▼' : '▶'}</span>
            <span>advanced — engine / model / commit / dry-run</span>
          </button>
        </div>
        <Show when={showAdvanced()}>
          <div class="border border-line/50 rounded-md p-2 space-y-2 bg-bg-raised/30">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="section-title block mb-1">
                  engine
                  <Show when={!engineOverrideAllowed()}>
                    <span class="ml-1 text-[10px] text-accent-amber">
                      (heavy task — claude only)
                    </span>
                  </Show>
                </label>
                <select
                  class="select w-full"
                  value={engine()}
                  disabled={!engineOverrideAllowed()}
                  onChange={onEngineChange}
                >
                  <For each={ENGINES}>
                    {(e) => <option value={e}>{e}</option>}
                  </For>
                </select>
              </div>
              <div>
                <label class="section-title block mb-1">model</label>
                <select
                  class="select w-full"
                  value={model()}
                  onChange={(e) => setModel(e.currentTarget.value)}
                >
                  <For each={MODELS_BY_ENGINE[engine()]}>
                    {(opt) => <option value={opt.value}>{opt.label}</option>}
                  </For>
                </select>
              </div>
            </div>
            <div class="flex items-center gap-4 pt-1">
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  class="cursor-pointer accent-accent-green"
                  checked={allowCommit()}
                  onChange={(e) => setAllowCommit(e.currentTarget.checked)}
                />
                <span>
                  allow self-commit
                  <span class="ml-1 text-[10px] text-text-muted">
                    (uncheck → parent squash)
                  </span>
                </span>
              </label>
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  class="cursor-pointer accent-accent-amber"
                  checked={dryRun()}
                  onChange={(e) => setDryRun(e.currentTarget.checked)}
                />
                <span>
                  dry run
                  <span class="ml-1 text-[10px] text-text-muted">
                    (build prompt only, no spawn)
                  </span>
                </span>
              </label>
            </div>
          </div>
        </Show>

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
              setZhPath('');
              setErrMsg('');
            }}
          >
            clear
          </button>
        </div>
      </form>
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
