/**
 * QuickActionBar — preset task buttons for the captain's bridge.
 *
 * Click → POST /api/tasks with predefined config. Optional inline ad-hoc
 * input for task types that need a path (e.g., lang-sync-refresh wants
 * a specific zh path).
 *
 * Phase 5 (2026-04-29).
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

function Inner() {
  const qc = useQueryClient();
  const [busy, setBusy] = createSignal<string | null>(null);
  const [flash, setFlash] = createSignal<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const fire = useMutation(() => ({
    mutationFn: (preset: QuickPreset) =>
      api.createQuickTask({
        type: preset.taskType,
        boot_profile: preset.bootProfile,
        priority: preset.priority,
        title: preset.title,
        inputs: preset.defaultInputs,
      }),
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
            const badge = modelBadgeForTask(p.taskType, p.defaultInputs);
            return (
              <button
                type="button"
                title={p.description}
                disabled={busy() === p.id}
                onClick={() => {
                  setBusy(p.id);
                  fire.mutate(p);
                }}
                class="text-left text-sm px-3 py-2 rounded-md border border-line
                     bg-bg-raised hover:bg-bg-input hover:border-accent-green/40
                     disabled:opacity-60 transition-colors"
              >
                <div class="flex items-center gap-2">
                  <span class="text-base">{p.emoji}</span>
                  <span class="font-medium text-text-primary truncate flex-1">
                    {p.label}
                  </span>
                  <Show when={badge}>
                    {(b) => (
                      <span
                        class={`text-[10px] px-1.5 py-0.5 rounded border ${modelBadgeClass(b().tone)}`}
                        title={b().full}
                      >
                        {b().icon} {b().label}
                      </span>
                    )}
                  </Show>
                </div>
                <div class="text-xs text-text-muted mt-0.5 truncate">
                  {p.priority} · {p.taskType}
                </div>
              </button>
            );
          }}
        </For>
      </div>
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
