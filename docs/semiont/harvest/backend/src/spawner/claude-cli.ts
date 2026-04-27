/**
 * Claude CLI spawner.
 *
 * Spawns the `claude` CLI as a child process with the prompt piped on stdin.
 * Streams stdout/stderr to a per-session log file under
 * `.harvest/tasks/{id}/sessions/{session-id}.log` and to pino.
 *
 * Hard timeout per session: config.sessionTimeoutMs (default 90 min).
 *
 * NOTE for MVP: we do NOT actually run `claude` from automated cron yet
 * (cheyu's verification doesn't require it). The prompt-building path is
 * tested via `bun run build-prompt`; this file is the runtime path that
 * cheyu can wire up once he's ready to live-fire.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.ts';
import { getDb } from '../db/client.ts';
import { child as childLogger } from '../logger.ts';
import { saveTask } from '../tasks/manager.ts';
import type { Task, TaskSession } from '../tasks/types.ts';
import { buildSpawnPrompt } from './prompt-builder.ts';
import {
  register as registerActive,
  setPhase as setActivePhase,
  unregister as unregisterActive,
} from './concurrency.ts';

const log = childLogger({ module: 'spawner/claude-cli' });

export interface SpawnResult {
  sessionId: string;
  exitCode: number;
  durationMs: number;
  logPath: string;
  promptPath: string;
  /** Commits this session produced (best-effort, parsed from git log diff). */
  commits: string[];
  /** True when the hard timeout fired and we killed the process. */
  timedOut: boolean;
}

export interface SpawnOptions {
  /** Skip actually running claude — only build the prompt and persist it. */
  dryRun?: boolean;
}

/**
 * Spawn a `claude` process for a given Task. Returns once the child exits or
 * the hard timeout fires. The Task is updated in-place: a new entry is
 * appended to `task.sessions` regardless of success/failure.
 */
export async function spawnClaudeForTask(
  task: Task,
  options: SpawnOptions = {},
): Promise<SpawnResult> {
  const sessionId = randomUUID();
  const sessionsDir = join(task.folder_path, 'sessions');
  mkdirSync(sessionsDir, { recursive: true });
  const logPath = join(sessionsDir, `${sessionId}.log`);
  const promptPath = join(sessionsDir, `${sessionId}.prompt.md`);

  const prompt = buildSpawnPrompt(task);
  writeFileSync(promptPath, prompt, 'utf8');

  const spawnedAt = new Date();
  const sessionRecord: TaskSession = {
    id: sessionId,
    spawned_at: spawnedAt.toISOString(),
    log_path: logPath,
    prompt_path: promptPath,
  };
  task.sessions.push(sessionRecord);
  task.attempts += 1;
  task.status = 'spawning';
  saveTask(task, `spawn attempt ${task.attempts} session=${sessionId}`);

  // Register in concurrency manager — picks up immediately so /api/sessions/active
  // shows the spawning row even before the child process is up.
  registerActive({
    sessionId,
    taskId: task.id,
    taskTitle: task.title,
    taskType: task.type,
    bootProfile: task.boot_profile,
    pid: undefined,
    spawnedAt: sessionRecord.spawned_at,
    phase: 'spawning',
  });

  // Pre-record session in DB.
  const db = getDb();
  db.run(
    `INSERT INTO sessions (id, task_id, pid, spawned_at, log_path, prompt_path)
     VALUES (?, ?, NULL, ?, ?, ?)`,
    [sessionId, task.id, sessionRecord.spawned_at, logPath, promptPath],
  );

  if (options.dryRun) {
    log.info(
      { taskId: task.id, sessionId, logPath },
      'dryRun=true — skipping claude exec',
    );
    sessionRecord.completed_at = new Date().toISOString();
    sessionRecord.exit_code = 0;
    task.status = 'pending'; // dry-run doesn't change real status
    saveTask(task, 'dry-run complete (no claude exec)');
    unregisterActive(sessionId);
    return {
      sessionId,
      exitCode: 0,
      durationMs: 0,
      logPath,
      promptPath,
      commits: [],
      timedOut: false,
    };
  }

  // Capture HEAD before spawn so we can diff afterwards to find new commits.
  const headBefore = await currentHead();

  task.status = 'in-progress';
  saveTask(task, `claude session ${sessionId} starting`);

  const logStream = createWriteStream(logPath, { flags: 'a' });
  logStream.write(
    `# session ${sessionId}\n# task ${task.id}\n# started ${sessionRecord.spawned_at}\n# claude bin: ${config.claudeBin}\n\n`,
  );

  // Pass the prompt via stdin so it's not visible in `ps` output.
  const cliArgs = ['--print', '--dangerously-skip-permissions'];
  const child = spawn(config.claudeBin, cliArgs, {
    cwd: config.repoRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HARVEST_TASK_ID: task.id,
      HARVEST_SESSION_ID: sessionId,
    },
  });

  db.run('UPDATE sessions SET pid = ? WHERE id = ?', [
    child.pid ?? null,
    sessionId,
  ]);
  setActivePhase(sessionId, 'in-progress', child.pid);
  log.info({ taskId: task.id, sessionId, pid: child.pid }, 'spawned claude');

  child.stdin.write(prompt);
  child.stdin.end();
  child.stdout.on('data', (chunk: Buffer) => logStream.write(chunk));
  child.stderr.on('data', (chunk: Buffer) => logStream.write(chunk));

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    log.warn(
      { taskId: task.id, sessionId, timeoutMs: config.sessionTimeoutMs },
      'hard timeout — killing claude',
    );
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 5_000);
  }, config.sessionTimeoutMs);

  const exitCode: number = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? -1));
    child.on('error', (err) => {
      logStream.write(`\n[spawner] error: ${String(err)}\n`);
      resolve(-1);
    });
  });
  clearTimeout(timeout);
  logStream.end();

  const completedAt = new Date();
  sessionRecord.completed_at = completedAt.toISOString();
  sessionRecord.exit_code = exitCode;
  const headAfter = await currentHead();
  const commits = await commitsBetween(headBefore, headAfter);
  if (commits.length) sessionRecord.commits = commits;

  db.run('UPDATE sessions SET completed_at = ?, exit_code = ? WHERE id = ?', [
    sessionRecord.completed_at,
    exitCode,
    sessionId,
  ]);
  if (commits.length) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO session_commits (session_id, commit_hash) VALUES (?, ?)',
    );
    for (const c of commits) stmt.run(sessionId, c);
  }

  // Decide final task status. The spawned session is supposed to write its
  // own status to status.log; we read it back here. If absent, we infer.
  task.status = inferStatusFromExit(exitCode, timedOut);
  saveTask(
    task,
    `claude session ${sessionId} exited code=${exitCode} timedOut=${timedOut}`,
  );

  unregisterActive(sessionId);

  log.info(
    { taskId: task.id, sessionId, exitCode, timedOut, commits: commits.length },
    'claude session ended',
  );

  return {
    sessionId,
    exitCode,
    durationMs: completedAt.getTime() - spawnedAt.getTime(),
    logPath,
    promptPath,
    commits,
    timedOut,
  };
}

function inferStatusFromExit(
  exitCode: number,
  timedOut: boolean,
): Task['status'] {
  if (timedOut) return 'failed';
  if (exitCode === 0) return 'done';
  return 'failed';
}

async function currentHead(): Promise<string> {
  return runGit(['rev-parse', 'HEAD']).catch(() => '');
}

async function commitsBetween(from: string, to: string): Promise<string[]> {
  if (!from || !to || from === to) return [];
  try {
    const out = await runGit(['log', '--pretty=%H', `${from}..${to}`]);
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function runGit(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: config.repoRoot });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`git ${args.join(' ')} exit ${code}: ${stderr}`));
    });
  });
}
