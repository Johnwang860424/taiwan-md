/**
 * Loads boot profiles from `boot-profiles/profiles.yml`.
 *
 * Profiles are declarative (per strategy report §8.7).
 *
 * Hard rules (auto-enforced):
 *   1. MANIFESTO.md is mandatory in every profile — Semiont identity (60-sec
 *      definition) is non-negotiable for any spawned worker.
 *   2. BECOME_TAIWANMD.md is mandatory ONLY for profiles where the worker
 *      operates as a Semiont awakening session (article writing, PR review,
 *      heartbeat, evolve, self-diagnose). Profiles flagged
 *      `requires_become: false` skip it — they are mechanical / translation
 *      workers and don't benefit from the full 12-organ awakening overhead.
 *      (Phase 5.1, 2026-04-30: cheyu's "translation should be 專業/輕量" rule.)
 */

import { readFileSync, statSync } from 'node:fs';
import yaml from 'js-yaml';
import { config } from '../config.ts';
import { child } from '../logger.ts';

const log = child({ module: 'spawner/boot-profiles' });

export interface BootProfile {
  description: string;
  must_read: string[];
  optional_read: string[];
  typical_tasks: string[];
  estimated_tokens: number;
  /**
   * If false, BECOME_TAIWANMD.md is NOT auto-injected — used by mechanical /
   * translation workers that don't need full Semiont awakening. Default true
   * (legacy behaviour: every profile required BECOME pre-Phase 5.1).
   */
  requires_become?: boolean;
}

interface ProfilesYaml {
  profiles: Record<string, BootProfile>;
}

let _profiles: Record<string, BootProfile> | null = null;
let _profilesMtime = 0;

const MANIFESTO_PATH = 'docs/semiont/MANIFESTO.md';
const BECOME_PATH = 'BECOME_TAIWANMD.md';

/** Reads (or re-reads) profiles.yml. Re-reads when the file changes on disk. */
export function loadProfiles(): Record<string, BootProfile> {
  const path = config.paths.bootProfiles;
  // Tiny mtime check to allow hot-reload while server is running.
  let mtime = 0;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    // file missing — fall through and let readFileSync raise a clear error
  }
  if (_profiles && mtime === _profilesMtime) return _profiles;

  const raw = readFileSync(path, 'utf8');
  const parsed = yaml.load(raw) as ProfilesYaml;
  if (!parsed?.profiles || typeof parsed.profiles !== 'object') {
    throw new Error(
      `profiles.yml malformed: missing top-level "profiles" key (path=${path})`,
    );
  }
  // Hard rule 1: MANIFESTO is always required (Semiont identity baseline).
  // Hard rule 2: BECOME only when `requires_become !== false`.
  for (const [name, profile] of Object.entries(parsed.profiles)) {
    if (!profile.must_read.includes(MANIFESTO_PATH)) {
      log.warn(
        { profile: name },
        `profile missing ${MANIFESTO_PATH} — auto-injecting`,
      );
      profile.must_read = [MANIFESTO_PATH, ...profile.must_read];
    }
    const needsBecome = profile.requires_become !== false;
    if (needsBecome && !profile.must_read.includes(BECOME_PATH)) {
      log.warn(
        { profile: name },
        `profile missing ${BECOME_PATH} — auto-injecting`,
      );
      profile.must_read = [BECOME_PATH, ...profile.must_read];
    }
    if (!needsBecome && profile.must_read.includes(BECOME_PATH)) {
      log.info(
        { profile: name },
        `profile flagged requires_become=false but lists BECOME — stripping for lightweight tier`,
      );
      profile.must_read = profile.must_read.filter((p) => p !== BECOME_PATH);
    }
  }
  _profiles = parsed.profiles;
  _profilesMtime = mtime;
  log.info(
    { count: Object.keys(_profiles).length, path },
    'loaded boot profiles',
  );
  return _profiles;
}

export function getProfile(name: string): BootProfile {
  const profiles = loadProfiles();
  const profile = profiles[name];
  if (!profile) {
    throw new Error(
      `Unknown boot profile: ${name}. Available: ${Object.keys(profiles).join(', ')}`,
    );
  }
  return profile;
}
