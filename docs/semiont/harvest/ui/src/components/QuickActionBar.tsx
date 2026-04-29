/**
 * QuickActionBar — preset task buttons for the captain's bridge.
 *
 * Click → POST /api/tasks with predefined config.
 *
 * Phase 5.1 (2026-04-30) revisions:
 *   - title now read via preset.title() lazy call (fresh timestamp per click)
 *   - per-preset model picker: ⚙️ icon next to model badge → click opens
 *     small popover with engine-eligible model options. Selected model
 *     overrides preset.defaultInputs.model and persists per-preset until
 *     reload.
 *   - notes (if defined on preset) injected into createQuickTask body so
 *     prompt-builder Phase 5.1 task.notes injection picks it up.
 */
import {
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from '@tanstack/solid-query';
import { For, Show, createSignal } from 'solid-js';
import { api } from '~/lib/api';
import { modelBadgeClass, modelBadgeForTask } from '~/lib/format';
import { getQueryClient } from '~/lib/query-client';
import { QUICK_PRESETS, type QuickPreset } from '~/lib/quick-presets';

/**
 * Per-engine model options (mirrors ManualInput MODELS_BY_ENGINE).
 * Keep in sync with backend DEFAULT_MODEL_BY_ENGINE_TYPE.
 */
const MODELS_BY_ENGINE: Record<string, { value: string; label: string }[]> = {
  claude: [
    { value: '', label: '(default by type)' },
    { value: 'claude-sonnet-4-6', label: '🤖 sonnet 4.6' },
    { value: 'claude-opus-4-6', label: '🧠 opus 4.6' },
    { value: 'claude-haiku-4-5', label: '🪶 haiku 4.5' },
  ],
  codex: [
    { value: '', label: 'auto (subscription default)' },
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5.5', label: 'gpt-5.5' },
    { value: 'gpt-5-mini', label: 'gpt-5-mini' },
    { value: 'o3', label: 'o3' },
  ],
  ollama: [
    { value: 'qwen3.5:35b-a3b-coding-nvfp4', label: 'qwen3.5 nvfp4' },
    { value: 'qwen3.6:35b-a3b-coding-nvfp4', label: 'qwen3.6 nvfp4' },
    { value: 'qwen3.6:35b-a3b-coding-mxfp8', label: 'qwen3.6 mxfp8' },
    { value: 'gemma3:12b', label: 'gemma3 12b' },
    { value: 'gpt-oss:20b', label: 'gpt-oss 20b' },
  ],
};

/**
 * Infer current engine from preset.defaultInputs.engine, default 'claude'.
 * Used to scope the model picker dropdown.
 */
function engineFor(p: QuickPreset): string {
  const e = p.defaultInputs?.engine;
  return typeof e === 'string' ? e : 'claude';
}

function Inner() {
  const qc = useQueryClient();
  const [busy, setBusy] = createSignal<string | null>(null);
  const [flash, setFlash] = createSignal<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);
  // Per-preset model overrides (preset.id → model id). Empty string = use default.
  const [modelOverrides, setModelOverrides] = createSignal<
    Record<string, string>
  >({});
  // Which preset's picker is open (null = none).
  const [pickerOpen, setPickerOpen] = createSignal<string | null>(null);

  const fire = useMutation(() => ({
    mutationFn: (preset: QuickPreset) => {
      const overrideModel = modelOverrides()[preset.id];
      const inputs = { ...(preset.defaultInputs ?? {}) };
      if (overrideModel) inputs.model = overrideModel;
      return api.createQuickTask({
        type: preset.taskType,
        boot_profile: preset.bootProfile,
        priority: preset.priority,
        title: preset.title(), // lazy — fresh timestamp per click
        ...(preset.notes ? { notes: preset.notes } : {}),
        inputs,
      });
    },
    onSuccess: (_, preset) => {
      setFlash({ type: 'ok', msg: `✅ Task created: ${preset.label}` });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      setTimeout(() => setFlash(null), 3000);
    },
    onError: (err) => {
      setFlash({ type: 'err', msg: `❌ ${(err as Error).message}` });
      setTimeout(() => setFlash(null), 5000);
    },
    onSettled: () => setBusy(null),
  }));

  const setModel = (presetId: string, model: string): void => {
    setModelOverrides({ ...modelOverrides(), [presetId]: model });
    setPickerOpen(null);
  };

  return (
    <div class="space-y-3">
      <Show when={flash()}>
        <div
          class={`text-xs rounded px-3 py-2 ${
            flash()!.type === 'ok'
              ? 'bg-accent-green/15 text-accent-green-soft border border-accent-green/40'
              : 'bg-accent-red/15 text-accent-red border border-accent-red/40'
          }`}
        >
          {flash()!.msg}
        </div>
      </Show>
      <div class="grid grid-cols-2 gap-2">
        <For each={QUICK_PRESETS}>
          {(p) => {
            // Effective inputs combining preset + override for badge derivation
            const effectiveInputs = (): Record<string, unknown> => {
              const ovr = modelOverrides()[p.id];
              if (!ovr) return p.defaultInputs ?? {};
              return { ...(p.defaultInputs ?? {}), model: ovr };
            };
            const badge = (): ReturnType<typeof modelBadgeForTask> =>
              modelBadgeForTask(p.taskType, effectiveInputs());
            const engine = engineFor(p);
            const modelOptions =
              MODELS_BY_ENGINE[engine] ?? MODELS_BY_ENGINE.claude!;

            return (
              <div
                class="relative text-left text-sm px-3 py-2 rounded-md border border-line
                     bg-bg-raised hover:bg-bg-input hover:border-accent-green/40
                     transition-colors"
              >
                <button
                  type="button"
                  title={p.description}
                  disabled={busy() === p.id}
                  onClick={() => {
                    setBusy(p.id);
                    fire.mutate(p);
                  }}
                  class="block w-full text-left disabled:opacity-60"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-base shrink-0">{p.emoji}</span>
                    <span class="font-medium text-text-primary truncate flex-1">
                      {p.label}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 mt-0.5 text-xs text-text-muted">
                    <span class="shrink-0">{p.priority}</span>
                    <span class="shrink-0">·</span>
                    <span class="truncate flex-1">{p.taskType}</span>
                  </div>
                </button>
                {/* Model picker — clickable badge that opens dropdown */}
                <div class="absolute top-1 right-1 flex items-center gap-1">
                  <Show when={badge()}>
                    {(b) => (
                      <button
                        type="button"
                        class={`text-[10px] px-1 py-px rounded border leading-tight cursor-pointer hover:opacity-80 ${modelBadgeClass(b().tone)}`}
                        title={`${b().full} — click to change model`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPickerOpen(pickerOpen() === p.id ? null : p.id);
                        }}
                      >
                        {b().icon}
                        {b().label}
                        <span class="ml-0.5 opacity-70">▾</span>
                      </button>
                    )}
                  </Show>
                </div>
                <Show when={pickerOpen() === p.id}>
                  <div
                    class="absolute top-7 right-1 z-10 min-w-[180px] py-1
                           border border-line rounded-md bg-bg-raised shadow-lg
                           text-xs"
                  >
                    <div class="px-2 py-1 text-text-muted text-[10px] uppercase tracking-wide">
                      {engine} · model
                    </div>
                    <For each={modelOptions}>
                      {(opt) => {
                        const current =
                          modelOverrides()[p.id] ??
                          (typeof p.defaultInputs?.model === 'string'
                            ? (p.defaultInputs.model as string)
                            : '');
                        const isSelected = current === opt.value;
                        return (
                          <button
                            type="button"
                            class={`block w-full text-left px-3 py-1 hover:bg-bg-input ${
                              isSelected
                                ? 'text-accent-green-soft font-medium'
                                : 'text-text-primary'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setModel(p.id, opt.value);
                            }}
                          >
                            {isSelected ? '✓ ' : '  '}
                            {opt.label}
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
      <Show when={pickerOpen()}>
        {/* Click outside to close picker */}
        <div
          class="fixed inset-0 z-0"
          onClick={() => setPickerOpen(null)}
          aria-hidden="true"
        />
      </Show>
    </div>
  );
}

export default function QuickActionBar() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <Inner />
    </QueryClientProvider>
  );
}
