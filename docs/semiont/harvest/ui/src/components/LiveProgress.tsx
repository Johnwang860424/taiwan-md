/**
 * LiveProgress — inline last-event tail for an active session.
 *
 * Polls /api/sessions/:sid/log every 2s, parses last meaningful stream-json
 * envelope (claude OR codex format), and renders a single line summary
 * (Read/Edit/Write/Bash/agent_message/...). Renders nothing when no useful
 * line yet.
 *
 * Used by ActiveSessionsList AND TaskRow (when row has an active session).
 */
import { useQuery } from '@tanstack/solid-query';
import { api } from '~/lib/api';

export default function LiveProgress(props: {
  sid: string;
  classExtra?: string;
}) {
  const q = useQuery(() => ({
    queryKey: ['session-log', props.sid],
    queryFn: () => api.pollSessionLog(props.sid, 0),
    refetchInterval: 2_000,
    retry: 0,
  }));

  const summarize = (line: string): string | null => {
    if (!line) return null;
    try {
      const obj = JSON.parse(line);

      // ── claude format ──
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

      // ── codex format ──
      if (obj.type === 'thread.started') return `🧵 thread started`;
      if (obj.type === 'turn.started') return `▶️  turn started`;
      if (obj.type === 'turn.completed') {
        const u = obj.usage ?? {};
        return `✅ turn done · in=${u.input_tokens ?? '?'} out=${u.output_tokens ?? '?'}`;
      }
      if (obj.type === 'turn.failed') {
        return `❌ ${(obj.error?.message ?? '').slice(0, 80)}`;
      }
      if (obj.type === 'item.completed' && obj.item) {
        const item = obj.item;
        if (item.type === 'agent_message')
          return `💭 ${(item.text ?? '').slice(0, 100)}`;
        if (item.type === 'reasoning')
          return `🧠 ${(item.text ?? '').slice(0, 100)}`;
        if (item.type === 'command_execution' || item.type === 'shell_call')
          return `🔧 Bash: ${(item.command ?? '').slice(0, 80)}`;
        if (item.type === 'file_change') return `✏️  ${item.path ?? ''}`;
        return `🛠  ${item.type}`;
      }
      if (obj.type === 'error') {
        return `❌ ${(obj.message ?? '').slice(0, 80)}`;
      }
    } catch {
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
    return q.isPending ? '…' : '(thinking)';
  };

  return (
    <div
      class={`text-xs text-accent-green-soft truncate font-mono ${props.classExtra ?? ''}`}
    >
      {lastSummary()}
    </div>
  );
}
