/**
 * Typed fetch wrappers for the harvest backend.
 * Single base URL; configurable via PUBLIC_HARVEST_API but defaults to
 * http://localhost:4319 (the launchd-managed dev backend).
 */

import type {
  ActiveSessionsResponse,
  HealthResponse,
  NewTaskBody,
  SpawnAcceptedResponse,
  Task,
  TaskListResponse,
  VitalsResponse,
} from './types';

const ENV_BASE =
  typeof import.meta !== 'undefined'
    ? (import.meta as ImportMeta).env?.PUBLIC_HARVEST_API
    : undefined;

export const API_BASE = ENV_BASE ?? 'http://localhost:4319';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { asText?: boolean },
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const txt = await res.text();
      detail = txt;
    } catch {
      // ignore
    }
    throw new ApiError(
      `${init?.method ?? 'GET'} ${path} failed: ${res.status} ${detail.slice(0, 200)}`,
      res.status,
    );
  }
  if (init?.asText) return (await res.text()) as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  vitals: () => request<VitalsResponse>('/api/vitals'),

  listTasks: (q?: { status?: string; priority?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (q?.status) params.set('status', q.status);
    if (q?.priority) params.set('priority', q.priority);
    if (q?.limit !== undefined) params.set('limit', String(q.limit));
    const qs = params.toString();
    return request<TaskListResponse>(`/api/tasks${qs ? `?${qs}` : ''}`);
  },

  getTask: (id: string) =>
    request<Task>(`/api/tasks/${encodeURIComponent(id)}`),

  createTask: (body: NewTaskBody) =>
    request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  cancelTask: (id: string) =>
    request<Task>(`/api/tasks/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  /**
   * Spawn a task. dry=true returns synchronous prompt preview; dry=false
   * returns 202 Accepted (fire-and-forget) and the spawn happens in the
   * background. 409 = task in wrong state OR concurrent limit reached.
   *
   * Task IDs may contain `#`, CJK, parens — encode aggressively.
   */
  spawnTask: (id: string, opts: { dry?: boolean } = {}) => {
    const dry = opts.dry ?? false;
    return request<SpawnAcceptedResponse | unknown>(
      `/api/tasks/${encodeURIComponent(id)}/spawn?dry=${dry ? 'true' : 'false'}`,
      { method: 'POST' },
    );
  },

  activeSessions: () => request<ActiveSessionsResponse>('/api/sessions/active'),

  reportToday: () =>
    request<string>('/api/reports/today', { asText: true }).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return '';
      throw err;
    }),

  reportByDate: (date: string) =>
    request<string>(`/api/reports/${date}`, { asText: true }).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return '';
      throw err;
    }),

  generateReport: (date?: string) =>
    request<{ ok?: boolean; path?: string; error?: string }>(
      `/api/reports/generate${date ? `?date=${date}` : ''}`,
      { method: 'POST' },
    ),

  pause: () =>
    request<{ paused: boolean }>('/api/control/pause', { method: 'POST' }),
  resume: () =>
    request<{ paused: boolean }>('/api/control/resume', { method: 'POST' }),

  intakeScan: () =>
    request<{ detected: number; entries: unknown[] }>('/api/intake/scan', {
      method: 'POST',
    }),
};

export { ApiError };
