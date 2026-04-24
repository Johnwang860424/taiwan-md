/**
 * Unit tests for commands/profile.js — YAML round-trip.
 *
 * Run with: cd cli && npx vitest run
 */

import { describe, it, expect } from 'vitest';
import { parseProfile, toYaml } from '../src/commands/profile.js';

describe('parseProfile', () => {
  it('parses scalar fields', () => {
    const yaml = `github_handle: link1515
name: Terry
language: zh-TW
style: casual
timezone: Asia/Taipei
`;
    const p = parseProfile(yaml);
    expect(p.github_handle).toBe('link1515');
    expect(p.name).toBe('Terry');
    expect(p.language).toBe('zh-TW');
    expect(p.style).toBe('casual');
    expect(p.timezone).toBe('Asia/Taipei');
  });

  it('parses nested git block with aliases list', () => {
    const yaml = `git:
  canonical: Che-Yu Wu <cheyu.wu@monoame.com>
  aliases:
    - Wu Che Yu <frank890417@gmail.com>
    - frank890417 <cheyu.wu@monoame.com>
`;
    const p = parseProfile(yaml);
    expect(p.git).toBeDefined();
    expect(p.git.canonical).toBe('Che-Yu Wu <cheyu.wu@monoame.com>');
    expect(p.git.aliases).toEqual([
      'Wu Che Yu <frank890417@gmail.com>',
      'frank890417 <cheyu.wu@monoame.com>',
    ]);
  });

  it('parses focus / skip lists', () => {
    const yaml = `focus:
  - pr-review
  - japanese-translation
skip:
  - political-topics
`;
    const p = parseProfile(yaml);
    expect(p.focus).toEqual(['pr-review', 'japanese-translation']);
    expect(p.skip).toEqual(['political-topics']);
  });

  it('parses empty list syntax `[]`', () => {
    const yaml = `skip: []\n`;
    const p = parseProfile(yaml);
    expect(p.skip).toEqual([]);
  });

  it('parses block scalar notes', () => {
    const yaml = `notes: |
  First line.
  Second line with spaces.
  Third line.
`;
    const p = parseProfile(yaml);
    expect(p.notes).toBe('First line.\nSecond line with spaces.\nThird line.');
  });

  it('strips inline comments from list items', () => {
    const yaml = `focus:
  - pr-review          # PR 審核
  - japanese-translation  # 日文翻譯
`;
    const p = parseProfile(yaml);
    expect(p.focus).toEqual(['pr-review', 'japanese-translation']);
  });

  it('skips pure comment lines', () => {
    const yaml = `# this is a comment
github_handle: link1515
# another comment
name: Terry
`;
    const p = parseProfile(yaml);
    expect(p.github_handle).toBe('link1515');
    expect(p.name).toBe('Terry');
  });
});

describe('toYaml', () => {
  it('emits a profile that parses back to the same fields', () => {
    const input = {
      github_handle: 'link1515',
      name: 'Terry',
      pronouns: 'he/him',
      language: 'zh-TW',
      style: 'technical',
      timezone: 'Asia/Taipei',
      focus: ['pr-review', 'japanese-translation'],
      skip: ['political-topics'],
      notes: 'Weekend only.\nLearning 繁體中文.',
      git: {
        canonical: 'Terry Lin <terry@example.com>',
        aliases: ['link1515 <terry@example.com>'],
      },
    };

    const yaml = toYaml(input);
    const parsed = parseProfile(yaml);

    expect(parsed.github_handle).toBe(input.github_handle);
    expect(parsed.name).toBe(input.name);
    expect(parsed.pronouns).toBe(input.pronouns);
    expect(parsed.language).toBe(input.language);
    expect(parsed.style).toBe(input.style);
    expect(parsed.timezone).toBe(input.timezone);
    expect(parsed.focus).toEqual(input.focus);
    expect(parsed.skip).toEqual(input.skip);
    expect(parsed.notes).toBe(input.notes);
    expect(parsed.git.canonical).toBe(input.git.canonical);
    expect(parsed.git.aliases).toEqual(input.git.aliases);
  });

  it('handles empty focus / skip as `[]`', () => {
    const yaml = toYaml({
      github_handle: 'x',
      name: 'X',
      language: 'en',
      style: 'concise',
      timezone: 'UTC',
      focus: [],
      skip: [],
      notes: '',
    });
    expect(yaml).toMatch(/^focus: \[\]$/m);
    expect(yaml).toMatch(/^skip: \[\]$/m);
  });

  it('omits the git block when neither canonical nor aliases set', () => {
    const yaml = toYaml({
      github_handle: 'x',
      name: 'X',
      language: 'en',
      style: 'concise',
      timezone: 'UTC',
      focus: [],
      skip: [],
      notes: '',
    });
    expect(yaml).not.toMatch(/^git:/m);
  });
});
