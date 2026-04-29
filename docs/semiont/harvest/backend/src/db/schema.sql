-- Harvest Engine SQLite schema (v1).
--
-- Source of truth for task content is the on-disk task folder (.harvest/tasks/{id}/task.yml).
-- This database is a query index over those folders + a session/commit log.
-- If the DB is wiped, manager.ts can rebuild it by walking task folders.

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  boot_profile TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  deadline TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL,
  depends_on_id TEXT NOT NULL,
  PRIMARY KEY (task_id, depends_on_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  pid INTEGER,
  spawned_at TEXT NOT NULL,
  completed_at TEXT,
  exit_code INTEGER,
  log_path TEXT,
  prompt_path TEXT,
  spawn_start_iso TEXT,
  cancelled INTEGER NOT NULL DEFAULT 0,
  killed_reason TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_spawned ON sessions(spawned_at);

CREATE TABLE IF NOT EXISTS session_commits (
  session_id TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  PRIMARY KEY (session_id, commit_hash),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Tracks which ARTICLE-INBOX entries we've already converted to tasks so we
-- don't double-spawn when the file changes for unrelated reasons. The hash
-- is sha256 of the entry's normalised body.
CREATE TABLE IF NOT EXISTS inbox_entries (
  entry_hash TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  task_id TEXT,
  detected_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS daily_reports (
  date TEXT PRIMARY KEY,
  report_path TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  tasks_failed INTEGER NOT NULL DEFAULT 0,
  tasks_blocked INTEGER NOT NULL DEFAULT 0,
  tasks_awaiting_cheyu INTEGER NOT NULL DEFAULT 0,
  committed_at TEXT
);

-- Phase 4: track which GitHub PRs/Issues we've spawned tasks for to dedupe.
CREATE TABLE IF NOT EXISTS processed_prs (
  pr_number INTEGER PRIMARY KEY,
  task_id TEXT,
  processed_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS processed_issues (
  issue_number INTEGER PRIMARY KEY,
  task_id TEXT,
  processed_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Phase 4: organ drift tracker — records last time each article was checked.
CREATE TABLE IF NOT EXISTS organ_drift (
  slug TEXT PRIMARY KEY,
  last_verified TEXT,
  drift_score INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT NOT NULL,
  spawned_task_id TEXT
);

-- Phase 5 (2026-04-29): per-task-type auto-spawn allow/deny list.
-- Default policy seeded on first boot via migrations.ts.
CREATE TABLE IF NOT EXISTS scheduler_type_policy (
  task_type TEXT PRIMARY KEY,
  auto_spawn_enabled INTEGER NOT NULL DEFAULT 1,  -- 1 = allow auto, 0 = manual only
  updated_at TEXT NOT NULL
);
