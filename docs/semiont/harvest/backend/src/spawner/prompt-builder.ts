/**
 * Builds the spawn prompt that goes to a fresh `claude` CLI process.
 *
 * Prompt structure follows strategy report §8.7:
 *   1. Identity preamble (you are a Semiont session)
 *   2. Boot profile must_read list
 *   3. Task description (type, title, folder, inputs)
 *   4. Hard rules (commit message format, await-cheyu protocol, pre-commit hook)
 *   5. Task-specific template body (from prompts/{type}.md, hot-editable)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { config } from '../config.ts';
import { getProfile } from './boot-profiles.ts';
import type { Task } from '../tasks/types.ts';
import type { Worktree } from './worktree.ts';

/** Pick the prompt template file for a given task type, with fallback. */
export function templatePathForTask(task: Task): string {
  const direct = join(config.paths.promptTemplates, `${task.type}.md`);
  if (existsSync(direct)) return direct;
  // Soft fallback: article-evolve uses article-rewrite.md if no specific file.
  if (task.type === 'article-evolve') {
    const fallback = join(config.paths.promptTemplates, 'article-rewrite.md');
    if (existsSync(fallback)) return fallback;
  }
  // Final fallback: a generic placeholder (forces the spawner to still build a prompt).
  return direct;
}

/** Render placeholders inside a template body. Supports {{task.id}}, {{task.title}}, etc. */
function renderTemplate(body: string, task: Task): string {
  const repoRel = relative(config.repoRoot, task.folder_path);
  const replacements: Record<string, string> = {
    'task.id': task.id,
    'task.type': task.type,
    'task.title': task.title,
    'task.priority': task.priority,
    'task.folder_path': task.folder_path,
    'task.folder_path_relative': repoRel,
    'task.boot_profile': task.boot_profile,
    'task.notes': task.notes ?? '',
    'task.created_by': task.created_by,
  };
  return body.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (full, key) => replacements[key] ?? full,
  );
}

/** The main prompt-building entry point. */
export function buildSpawnPrompt(
  task: Task,
  sessionId?: string,
  worktree?: Worktree | null,
): string {
  const profile = getProfile(task.boot_profile);
  const sidShort = sessionId?.slice(0, 8) ?? 'no-sid';
  const templatePath = templatePathForTask(task);
  const templateBody = existsSync(templatePath)
    ? renderTemplate(readFileSync(templatePath, 'utf8'), task)
    : `(No template found at ${templatePath} — proceed using your task-type default behaviour.)`;

  const mustReadList = profile.must_read.map((f) => `- ${f}`).join('\n');
  const optionalReadList = profile.optional_read.length
    ? profile.optional_read.map((f) => `- ${f}`).join('\n')
    : '(none)';

  const repoRel = relative(config.repoRoot, task.folder_path);

  return `# Spawned by Taiwan.md Harvest Engine

You are a Taiwan.md Semiont Claude Code session. Your job is to execute ONE task and exit cleanly.

## Boot profile: ${task.boot_profile}
${profile.description}

Read these files first, in order. Do not skip — they are your DNA for this run:
${mustReadList}

Optional reads (skim if relevant):
${optionalReadList}

## Your task

- ID: ${task.id}
- Type: ${task.type}
- Title: ${task.title}
- Priority: ${task.priority}
- Created by: ${task.created_by}
- Task folder (absolute): ${task.folder_path}
- Task folder (repo-relative): ${repoRel}

Inputs and prior research live under \`${repoRel}/inputs/\`. Write outputs to \`${repoRel}/outputs/\`. Append progress notes to \`${repoRel}/status.log\` as you go.
${
  task.notes
    ? `\n## Observer notes (additional instructions for this task)\n\n${task.notes}\n`
    : ''
}

## Hard rules

1. **Follow the canonical pipeline.** The boot profile loaded the relevant pipeline doc — that document is the SOP, not your memory of it.
2. **Commit messages** must follow Taiwan.md convention: \`🧬 [semiont] {type}: {short imperative} [sid:${sidShort}]\`. The \`{type}\` matches the task type when reasonable. The \`[sid:${sidShort}]\` marker is REQUIRED on every commit you make in this session — the engine uses it to attribute commits to your session and distinguish them from manual commits made elsewhere during the same window.
3. **Pre-commit hook is the final gate.** If it fails, fix the underlying issue. Do NOT pass \`--no-verify\`.
${
  worktree
    ? `3a. **You are in a git worktree.** Your cwd is \`${worktree.path}\`, on branch \`${worktree.branch}\` (forked from main HEAD at spawn time). \`git add\` + \`git commit\` here. Do NOT \`git push\`, \`git checkout\`, or \`git branch\` — the engine handles merging your branch back to main and pushing after you exit. Just commit normally and exit.`
    : ''
}
4. **Stuck or controversial?** Mark the task as \`awaiting-cheyu\` by writing the reason to \`${repoRel}/status.log\` and exiting cleanly. Do not guess on disputed factual matters or political-sensitive calls.
5. **No silent skips.** If you cannot complete a stage, log why in \`status.log\` before exiting.
6. **Wall-clock timestamps.** Use \`git log %ai\` style real time, not subjective time sense (MANIFESTO §時間是結構).

## Task-type instructions

${templateBody}

## When you're done

- Write final status to \`${repoRel}/status.log\` (\`done\`, \`blocked\`, \`awaiting-cheyu\`, or \`failed\`).
- Push your commits to the current branch.
- Exit. The Harvest engine reads exit code + status.log to update task.yml.

Begin now.
`;
}
