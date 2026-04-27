/**
 * Frontend mirror of harvest backend domain types.
 * Source of truth: docs/semiont/harvest/backend/src/tasks/types.ts
 */

export type TaskStatus =
  | 'pending'
  | 'spawning'
  | 'in-progress'
  | 'blocked'
  | 'done'
  | 'failed'
  | 'retired'
  | 'awaiting-cheyu';

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type TaskType =
  | 'article-rewrite'
  | 'article-new'
  | 'article-evolve'
  | 'spore-publish'
  | 'spore-harvest'
  | 'pr-review'
  | 'issue-handle'
  | 'data-refresh'
  | 'status-report'
  | 'self-diagnose'
  | 'heartbeat'
  // backend allows free-form `string`, so we accept unknown values too
  | (string & {});

export type BootProfile =
  | 'minimal'
  | 'content-writing'
  | 'spore-publishing'
  | 'maintainer'
  | 'full-awakening'
  | (string & {});

export interface TaskSession {
  id: string;
  spawned_at: string;
  completed_at?: string;
  exit_code?: number;
  log_path?: string;
  prompt_path?: string;
  commits?: string[];
  pid?: number;
}

export interface Task {
  schema_version: 1;
  id: string;
  type: TaskType;
  boot_profile: BootProfile;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  folder_path: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  dependencies: string[];
  blockers: string[];
  sessions: TaskSession[];
  attempts: number;
  max_attempts: number;
  deadline?: string;
  notes?: string;
  inputs?: Record<string, unknown>;
}

export interface HealthResponse {
  ok: boolean;
  uptime_s: number;
  db_ok: boolean;
  repo_root: string;
  scheduler_paused: boolean;
}

export interface VitalsOrgan {
  id: string;
  name: string;
  nameZh: string;
  metaphor?: string;
  emoji: string;
  score: number;
  trend?: 'up' | 'down' | 'flat' | string;
  metrics?: Record<string, unknown>;
}

export interface VitalsResponse {
  lastUpdated?: string;
  organs: VitalsOrgan[];
}

export interface NewTaskBody {
  type: string;
  boot_profile: string;
  priority: TaskPriority;
  title: string;
  notes?: string;
  dependencies?: string[];
  deadline?: string;
  inputs?: Record<string, unknown>;
  created_by?: string;
}

export interface TaskListResponse {
  count: number;
  tasks: Task[];
}

/**
 * Phase 2.5 — concurrent spawn lifecycle.
 * Source of truth: backend /api/sessions/active endpoint.
 */
export interface ActiveSession {
  sessionId: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  bootProfile: string;
  pid?: number;
  spawnedAt: string;
  phase: 'spawning' | 'in-progress';
}

export interface ActiveSessionsResponse {
  count: number;
  max: number;
  sessions: ActiveSession[];
}

export interface SpawnAcceptedResponse {
  task_id: string;
  status: 'spawning';
  active_now: number;
  max_concurrent: number;
  message?: string;
}
