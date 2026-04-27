/**
 * Harvest backend runtime configuration.
 *
 * Loads from process.env (which Bun auto-populates from a sibling .env file
 * if present). Falls back to sensible defaults so the server can boot in a
 * fresh checkout without a .env.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the repository root by walking up from the backend folder. */
function findRepoRoot(): string {
  // src/config.ts -> src/ -> backend/ -> harvest/ -> semiont/ -> docs/ -> repo root
  let cur = resolve(__dirname, '..', '..', '..', '..', '..');
  // Guard: keep walking up until we see a `.git` folder or hit /
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(cur, '.git'))) return cur;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return resolve(__dirname, '..', '..', '..', '..', '..');
}

const repoRootEnv = process.env.HARVEST_REPO_ROOT?.trim();
const repoRoot =
  repoRootEnv && repoRootEnv.length > 0 ? resolve(repoRootEnv) : findRepoRoot();

const backendRoot = resolve(__dirname, '..');

function bool(envVar: string | undefined, fallback: boolean): boolean {
  if (envVar === undefined) return fallback;
  return envVar.toLowerCase() === 'true' || envVar === '1';
}

function num(envVar: string | undefined, fallback: number): number {
  if (envVar === undefined) return fallback;
  const n = Number(envVar);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  repoRoot,
  backendRoot,
  port: num(process.env.HARVEST_PORT, 4319),
  dbPath:
    process.env.HARVEST_DB_PATH?.trim() &&
    process.env.HARVEST_DB_PATH.trim().length > 0
      ? resolve(process.env.HARVEST_DB_PATH.trim())
      : join(backendRoot, 'harvest.db'),
  logLevel: process.env.HARVEST_LOG_LEVEL ?? 'info',
  logPretty: bool(process.env.HARVEST_LOG_PRETTY, true),
  claudeBin: process.env.HARVEST_CLAUDE_BIN?.trim() || 'claude',
  sessionTimeoutMs: num(process.env.HARVEST_SESSION_TIMEOUT_MIN, 90) * 60_000,
  disableCron: bool(process.env.HARVEST_DISABLE_CRON, false),
  disableWatch: bool(process.env.HARVEST_DISABLE_WATCH, false),
  autoCommitReport: bool(process.env.HARVEST_AUTO_COMMIT_REPORT, true),
  // Derived paths (always relative to repoRoot).
  paths: {
    articleInbox: join(repoRoot, 'docs', 'semiont', 'ARTICLE-INBOX.md'),
    bootProfiles: join(backendRoot, 'boot-profiles', 'profiles.yml'),
    promptTemplates: join(backendRoot, 'prompts'),
    harvestRoot: join(repoRoot, '.harvest'),
    tasksRoot: join(repoRoot, '.harvest', 'tasks'),
    reportsRoot: join(repoRoot, 'reports', 'harvest'),
    sessionsLogRoot: join(repoRoot, '.harvest', 'sessions'),
  },
} as const;

export type HarvestConfig = typeof config;
