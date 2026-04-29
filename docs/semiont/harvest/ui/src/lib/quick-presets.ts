/**
 * Quick-action presets for QuickActionBar.
 *
 * Each preset describes a task type cheyu fires often. Click → POST /api/tasks
 * with these defaults. Phase 5 (2026-04-29).
 *
 * Phase 5.1 (2026-04-30) revisions:
 *   - title is now a function (lazy timestamp — each click gets fresh `ts()`)
 *   - all presets explicit worktree: true (visibility — backend default also true)
 *   - all presets default to allow_self_commit=true (cheyu's rule after KTV
 *     translation evaporation: never silently stage without commit)
 *   - lang-sync preset gains default notes hardening "faithfulness over polish"
 *     (engine-comparison v3 showed Sonnet 1.47 / codex 2.53 / qwen 2.85;
 *     length cap reins in elaborate models)
 */

export interface QuickPreset {
  id: string; // unique button id
  emoji: string;
  label: string; // button text
  description: string; // tooltip
  taskType: string; // matches backend prompts/{type}.md
  bootProfile: string; // matches profiles.yml
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  /** Lazy title — call to get fresh timestamp every click. */
  title: () => string;
  /** Optional per-task notes (injected into prompt via prompt-builder Phase 5.1). */
  notes?: string;
  group: 'routine' | 'content' | 'manual'; // visual grouping
  needsInput?: { name: string; placeholder: string }[];
  defaultInputs?: Record<string, unknown>;
}

export const GROUP_META: Record<
  QuickPreset['group'],
  { label: string; color: string }
> = {
  routine: {
    label: '🟢 例行 (auto OK)',
    color: 'border-accent-green/30',
  },
  content: {
    label: '🔵 內容創作 (heavier)',
    color: 'border-accent-blue/30',
  },
  manual: {
    label: '🟠 對外操作 (人工最終確認)',
    color: 'border-accent-amber/30',
  },
};

const ts = (): string =>
  new Date().toISOString().slice(0, 16).replace('T', ' ');

const FAITHFULNESS_NOTES =
  'Faithfulness over polish: en chars MUST NOT exceed 1.3x zh chars. ' +
  'If approaching cap, condense in next sentence — drop prepositional fluff, ' +
  'merge connectives, prefer terse Taiwan English over elaborate explanation. ' +
  'Match zh prose density 1:1; do NOT add context paragraphs that explain ' +
  'what zh implies. The reader has access to zh-TW canonical; en is ' +
  'projection not encyclopedia entry.';

export const QUICK_PRESETS: QuickPreset[] = [
  // 🟢 routine (safe to auto)
  {
    id: 'data-refresh',
    emoji: '📊',
    label: 'Refresh dashboard',
    description: 'CF + GA + SC + prebuild + lang-sync status — 約 7 分鐘',
    taskType: 'data-refresh',
    bootProfile: 'minimal',
    priority: 'P1',
    title: () => `data-refresh: scheduled ${ts()}`,
    defaultInputs: {
      worktree: true,
    },
    group: 'routine',
  },
  {
    id: 'lang-sync-en-batch',
    emoji: '🌐',
    label: 'Lang-sync: 1 en article',
    description:
      '從 lang-sync queue 挑下一個最舊 stale → 翻譯。獨立 worktree + 自動 commit (KTV-loss prevention)',
    taskType: 'lang-sync-refresh',
    bootProfile: 'translation-refresh',
    priority: 'P1',
    title: () => `lang-sync: pick next stale en ${ts()}`,
    notes: FAITHFULNESS_NOTES,
    defaultInputs: {
      lang: 'en',
      mode: 'auto',
      worktree: true,
      // allow_self_commit unset → defaults true (cheyu's rule: never lose stage)
    },
    group: 'routine',
  },
  {
    id: 'self-diagnose',
    emoji: '🩺',
    label: 'Self-diagnose',
    description: '完整 BECOME 甦醒 + 4.5 拍診斷',
    taskType: 'self-diagnose',
    bootProfile: 'full-awakening',
    priority: 'P2',
    title: () => `self-diagnose: full check ${ts()}`,
    defaultInputs: {
      worktree: true,
    },
    group: 'routine',
  },
  {
    id: 'status-report',
    emoji: '📋',
    label: 'Status report',
    description: '今日心跳總結 → reports/harvest/',
    taskType: 'status-report',
    bootProfile: 'minimal',
    priority: 'P2',
    title: () => `status-report ${ts()}`,
    defaultInputs: {
      worktree: true,
    },
    group: 'routine',
  },

  // 🔵 content (heavier — Opus)
  {
    id: 'article-from-inbox',
    emoji: '📝',
    label: 'Write next article (inbox)',
    description: '從 ARTICLE-INBOX 挑 P0/P1 寫一篇',
    taskType: 'article-rewrite',
    bootProfile: 'content-writing',
    priority: 'P1',
    title: () => `article: pick from inbox ${ts()}`,
    defaultInputs: {
      worktree: true,
    },
    group: 'content',
  },

  // 🟠 manual (oversight required)
  {
    id: 'pr-review',
    emoji: '🔍',
    label: 'Review open PRs',
    description:
      '審所有 open PR — 預設關閉 auto-spawn，手動觸發。每 spawn 獨立 worktree (避免多 session 碰撞 main repo)',
    taskType: 'pr-review',
    bootProfile: 'maintainer',
    priority: 'P0',
    title: () => `pr-review: queue scan ${ts()}`,
    defaultInputs: {
      worktree: true, // explicit isolation — never share main repo for PR review
    },
    group: 'manual',
  },
  {
    id: 'issue-handle',
    emoji: '📨',
    label: 'Handle Issues',
    description: '掃 open Issues 分流。獨立 worktree (避免碰撞)',
    taskType: 'issue-handle',
    bootProfile: 'maintainer',
    priority: 'P1',
    title: () => `issue-handle: queue scan ${ts()}`,
    defaultInputs: {
      worktree: true,
    },
    group: 'manual',
  },
  {
    id: 'spore-publish',
    emoji: '🌱',
    label: 'Spore: prep blueprint',
    description: '準備一篇孢子 blueprint (NOT 直接發 — human post)',
    taskType: 'spore-publish',
    bootProfile: 'spore-publishing',
    priority: 'P1',
    title: () => `spore: blueprint prep ${ts()}`,
    defaultInputs: {
      worktree: true,
    },
    group: 'manual',
  },
];
