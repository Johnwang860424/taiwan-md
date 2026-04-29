/**
 * Phase 2.5 + Bug 3 + Phase 3.4 — active sessions list with live log drawer
 * and a working cancel button.
 */
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/solid-query';
import { For, Show, createSignal } from 'solid-js';
import { api, ApiError } from '~/lib/api';
import { getQueryClient } from '~/lib/query-client';
import { elapsedSince, formatDateTime, typeEmoji } from '~/lib/format';
import type { ActiveSession } from '~/lib/types';
import SessionLogDrawer from './SessionLogDrawer';

function Inner() {
  const qc = useQueryClient();
  const q = useQuery(() => ({
    queryKey: ['sessions', 'active'],
    queryFn: () => api.activeSessions(),
    refetchInterval: 2_000,
    retry: 0,
  }));

  const [expanded, setExpanded] = createSignal<Set<string>>(new Set());
  const [openLog, setOpenLog] = createSignal<{
    sid: string;
    title: string;
  } | null>(null);
  const toggle = (id: string): void => {
    const next = new Set(expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const cancelMut = useMutation(() => ({
    mutationFn: (sid: string) => api.cancelSession(sid),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['sessions', 'active'] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        // eslint-disable-next-line no-console
        console.warn('cancel failed', err.status);
      }
    },
  }));

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
                <div class="card-body hover:bg-bg-raised/60 transition-colors">
                  <div class="flex items-center gap-3">
                    <button
                      type="button"
                      class="flex items-center gap-3 min-w-0 flex-1 text-left"
                      onClick={() => toggle(s.sessionId)}
                    >
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
                        <LiveProgress sid={s.sessionId} />
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
                    </button>
                    <div class="flex flex-col items-end gap-1 ml-2">
                      <button
                        type="button"
                        class="text-xs px-2 py-1 rounded border border-line text-text-secondary hover:border-accent-amber hover:text-accent-amber"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenLog({
                            sid: s.sessionId,
                            title: s.taskTitle,
                          });
                        }}
                      >
                        📜 log
                      </button>
                      <button
                        type="button"
                        class="text-xs px-2 py-1 rounded border border-line text-text-muted hover:border-accent-red hover:text-accent-red disabled:opacity-50"
                        disabled={cancelMut.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            // eslint-disable-next-line no-alert
                            confirm(
                              `Cancel session ${s.sessionId.slice(0, 8)}?`,
                            )
                          ) {
                            cancelMut.mutate(s.sessionId);
                          }
                        }}
                      >
                        ✕ cancel
                      </button>
                    </div>
                  </div>
                </div>

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
                  </div>
                </Show>
              </li>
            );
          }}
        </For>
      </ul>

      <SessionLogDrawer
        sessionId={openLog()?.sid ?? null}
        taskTitle={openLog()?.title}
        onClose={() => setOpenLog(null)}
      />
    </div>
  );
}

/**
 * Inline live progress per active session — polls /api/sessions/:sid/log
 * every 2s, parses last meaningful line (tool_use / tool_result / message
 * delta / heartbeat marker) and shows it under the task title.
 *
 * stream-json output emits one JSON envelope per stdout line. We try to
 * extract a human-readable summary from each.
 */
function LiveProgress(props: { sid: string }) {
  const q = useQuery(() => ({
    queryKey: ['session-log', props.sid],
    queryFn: () => api.pollSessionLog(props.sid, 0),
    refetchInterval: 2_000,
    retry: 0,
  }));

  const summarize = (line: string): string | null => {
    if (!line) return null;
    // Try parse as stream-json envelope
    try {
      const obj = JSON.parse(line);
      // tool_use blocks
      if (obj.type === 'assistant' && obj.message?.content) {
        for (const block of obj.message.content) {
          if (block.type === 'tool_use') {
            const name = block.name;
            const input = block.input ?? {};
            if (name === 'Bash')
              return `🔧 Bash: ${(input.command ?? '').slice(0, 80)}`;
            if (name === 'Read') return `📖 Read ${input.file_path ?? ''}`;
            if (name === 'Edit') return `✏️  Edit ${input.file_path ?? ''}`;
            if (name === 'Write') return `📝 Write ${input.file_path ?? ''}`;
            if (name === 'Grep') return `🔍 Grep ${input.pattern ?? ''}`;
            if (name === 'Glob') return `🔍 Glob ${input.pattern ?? ''}`;
            return `🛠  ${name}`;
          }
          if (block.type === 'text' && block.text) {
            const t = block.text.replace(/\s+/g, ' ').trim();
            if (t) return `💭 ${t.slice(0, 100)}`;
          }
        }
      }
      if (obj.type === 'user' && obj.message?.content) {
        for (const block of obj.message.content) {
          if (
            block.type === 'tool_result' &&
            typeof block.content === 'string'
          ) {
            return `← ${block.content.slice(0, 80).replace(/\n/g, ' ')}`;
          }
        }
      }
      if (obj.type === 'stream_event' && obj.event?.delta?.text) {
        const t = obj.event.delta.text.replace(/\s+/g, ' ').trim();
        if (t) return `· ${t.slice(0, 80)}`;
      }
      if (obj.type === 'result') {
        return obj.is_error ? `❌ ${obj.subtype ?? 'error'}` : `✅ done`;
      }
    } catch {
      // Plain text line (header/footer/raw stderr)
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return null;
      if (trimmed.length < 200) return `· ${trimmed}`;
    }
    return null;
  };

  const lastSummary = (): string => {
    const lines = q.data?.lines ?? [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const s = summarize(lines[i]);
      if (s) return s;
    }
    return q.isPending ? '…' : '(waiting for first event)';
  };

  return (
    <div class="text-xs text-accent-green-soft truncate mt-0.5 font-mono">
      {lastSummary()}
    </div>
  );
}

function Field(props: { label: string; children: unknown }) {
  return (
    <div class="flex gap-2">
      <span class="text-text-muted w-28 shrink-0">{props.label}</span>
      <span class="text-text-primary min-w-0 flex-1">
        {props.children as never}
      </span>
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
