/**
 * Slide-over drawer showing full task details + actions (cancel, dry-spawn).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/solid-query';
import { For, Show, createSignal } from 'solid-js';
import { api } from '~/lib/api';
import {
  formatDateTime,
  priorityBadgeClass,
  relativeTime,
  statusBadgeClass,
  typeEmoji,
} from '~/lib/format';

export default function TaskDetailDrawer(props: {
  taskId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery(() => ({
    queryKey: ['task', props.taskId],
    queryFn: () => api.getTask(props.taskId!),
    enabled: !!props.taskId,
    refetchInterval: 5_000,
  }));

  const [spawnPreview, setSpawnPreview] = createSignal<unknown>(null);

  const cancelMut = useMutation(() => ({
    mutationFn: () => api.cancelTask(props.taskId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['task', props.taskId] });
    },
  }));

  const spawnMut = useMutation(() => ({
    mutationFn: () => api.spawnTask(props.taskId!, { dry: true }),
    onSuccess: (data) => setSpawnPreview(data),
  }));

  return (
    <Show when={props.taskId}>
      <div
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => props.onClose()}
      />
      <aside
        class="fixed inset-y-0 right-0 z-50 w-full max-w-xl
               bg-bg-surface border-l border-line shadow-2xl
               overflow-y-auto"
      >
        <div
          class="sticky top-0 z-10 flex items-center justify-between
                    px-4 py-3 border-b border-line bg-bg-surface"
        >
          <div class="text-sm text-text-secondary">task detail</div>
          <button class="btn" onClick={() => props.onClose()}>
            close
          </button>
        </div>

        <Show when={q.isPending}>
          <div class="p-6 space-y-3">
            <div class="skeleton h-4 w-1/3" />
            <div class="skeleton h-6 w-2/3" />
            <div class="skeleton h-32 w-full" />
          </div>
        </Show>

        <Show when={q.isError}>
          <div class="p-6 text-sm text-accent-red">
            載入失敗。
            <button class="btn ml-2" onClick={() => q.refetch()}>
              retry
            </button>
          </div>
        </Show>

        <Show when={q.data}>
          {(_) => {
            const t = q.data!;
            return (
              <div class="p-6 space-y-4">
                <div class="flex items-start gap-3">
                  <div class="text-3xl">{typeEmoji(t.type)}</div>
                  <div class="min-w-0 flex-1">
                    <h2 class="text-lg font-semibold text-text-primary break-words">
                      {t.title}
                    </h2>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <span class={`pill ${statusBadgeClass(t.status)}`}>
                        {t.status}
                      </span>
                      <span class={`pill ${priorityBadgeClass(t.priority)}`}>
                        {t.priority}
                      </span>
                      <span class="pill bg-bg-raised text-text-secondary border border-line">
                        {t.type}
                      </span>
                      <span class="pill bg-bg-raised text-text-secondary border border-line">
                        boot: {t.boot_profile}
                      </span>
                    </div>
                  </div>
                </div>

                <Field label="id">
                  <code class="text-xs">{t.id}</code>
                </Field>
                <Field label="folder">
                  <code class="text-xs break-all">{t.folder_path}</code>
                </Field>
                <Field label="created">
                  {formatDateTime(t.created_at)} · {relativeTime(t.created_at)}{' '}
                  · by {t.created_by}
                </Field>
                <Field label="updated">
                  {formatDateTime(t.updated_at)} · {relativeTime(t.updated_at)}
                </Field>
                <Field label="attempts">
                  {t.attempts} / {t.max_attempts}
                </Field>
                <Show when={t.deadline}>
                  <Field label="deadline">{t.deadline}</Field>
                </Show>
                <Show when={t.dependencies.length}>
                  <Field label="dependencies">
                    <ul class="text-xs space-y-0.5">
                      <For each={t.dependencies}>
                        {(d) => (
                          <li>
                            <code>{d}</code>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Field>
                </Show>
                <Show when={t.blockers.length}>
                  <Field label="blockers">
                    <ul class="text-xs space-y-0.5 text-accent-orange">
                      <For each={t.blockers}>{(b) => <li>{b}</li>}</For>
                    </ul>
                  </Field>
                </Show>
                <Show when={t.notes}>
                  <Field label="notes">
                    <pre class="text-xs whitespace-pre-wrap text-text-secondary">
                      {t.notes}
                    </pre>
                  </Field>
                </Show>
                <Show when={t.inputs && Object.keys(t.inputs).length}>
                  <Field label="inputs">
                    <pre class="text-xs whitespace-pre-wrap bg-bg-input rounded p-2 overflow-x-auto">
                      {JSON.stringify(t.inputs, null, 2)}
                    </pre>
                  </Field>
                </Show>

                <div>
                  <div class="section-title mb-2">
                    sessions ({t.sessions.length})
                  </div>
                  <Show
                    when={t.sessions.length}
                    fallback={
                      <div class="text-xs text-text-muted">無 session</div>
                    }
                  >
                    <ul class="space-y-2">
                      <For each={t.sessions}>
                        {(s) => (
                          <li class="card">
                            <div class="card-body text-xs space-y-1">
                              <div>
                                <span class="text-text-muted">id</span>{' '}
                                <code>{s.id.slice(0, 8)}…</code>
                              </div>
                              <div>
                                <span class="text-text-muted">spawned</span>{' '}
                                {formatDateTime(s.spawned_at)} ·{' '}
                                {relativeTime(s.spawned_at)}
                              </div>
                              <Show when={s.completed_at}>
                                <div>
                                  <span class="text-text-muted">completed</span>{' '}
                                  {formatDateTime(s.completed_at)}
                                </div>
                              </Show>
                              <Show when={s.exit_code !== undefined}>
                                <div>
                                  <span class="text-text-muted">exit</span>{' '}
                                  <code>{s.exit_code}</code>
                                </div>
                              </Show>
                              <Show when={s.log_path}>
                                <div>
                                  <span class="text-text-muted">log</span>{' '}
                                  <code class="break-all">{s.log_path}</code>
                                </div>
                              </Show>
                              <Show when={s.commits?.length}>
                                <div>
                                  <span class="text-text-muted">commits</span>{' '}
                                  <For each={s.commits ?? []}>
                                    {(c) => (
                                      <code class="ml-1">{c.slice(0, 8)}</code>
                                    )}
                                  </For>
                                </div>
                              </Show>
                            </div>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>

                <div class="flex flex-wrap gap-2 pt-3 border-t border-line">
                  <button
                    class="btn"
                    disabled={spawnMut.isPending}
                    onClick={() => spawnMut.mutate()}
                  >
                    {spawnMut.isPending
                      ? 'building…'
                      : 'preview spawn prompt (dry)'}
                  </button>
                  <button
                    class="btn btn-danger"
                    disabled={
                      cancelMut.isPending ||
                      !(t.status === 'pending' || t.status === 'blocked')
                    }
                    onClick={() => {
                      if (confirm(`Cancel task ${t.id}?`)) cancelMut.mutate();
                    }}
                  >
                    {cancelMut.isPending ? 'cancelling…' : 'cancel'}
                  </button>
                </div>

                <Show when={spawnPreview()}>
                  <Field label="dry-spawn output">
                    <pre class="text-xs whitespace-pre-wrap bg-bg-input rounded p-2 overflow-x-auto max-h-64">
                      {JSON.stringify(spawnPreview(), null, 2)}
                    </pre>
                  </Field>
                </Show>
              </div>
            );
          }}
        </Show>
      </aside>
    </Show>
  );
}

function Field(props: { label: string; children: any }) {
  return (
    <div>
      <div class="section-title mb-1">{props.label}</div>
      <div class="text-sm text-text-primary">{props.children}</div>
    </div>
  );
}
