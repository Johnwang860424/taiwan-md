/**
 * Unit tests for commands/mailmap.js — identity collection.
 *
 * Integration test: runs against actual repo git log. Only checks invariants
 * that hold regardless of commit history (structure, ordering, consolidation).
 *
 * Run with: cd cli && npx vitest run
 */

import { describe, it, expect } from 'vitest';
import { collectIdentities } from '../src/commands/mailmap.js';

describe('collectIdentities', () => {
  const identities = collectIdentities();

  it('returns non-empty list of identity objects', () => {
    expect(Array.isArray(identities)).toBe(true);
    expect(identities.length).toBeGreaterThan(0);
  });

  it('each entry has name/email/count/canonicalName/canonicalEmail', () => {
    for (const id of identities.slice(0, 5)) {
      expect(typeof id.name).toBe('string');
      expect(typeof id.email).toBe('string');
      expect(typeof id.count).toBe('number');
      expect(typeof id.canonicalName).toBe('string');
      expect(typeof id.canonicalEmail).toBe('string');
      expect(id.count).toBeGreaterThan(0);
    }
  });

  it('sorted by count descending', () => {
    for (let i = 1; i < identities.length; i++) {
      expect(identities[i - 1].count).toBeGreaterThanOrEqual(
        identities[i].count,
      );
    }
  });

  it('consolidates CheYu aliases via .mailmap (canonical = Che-Yu Wu)', () => {
    // Any identity matching cheyu|frank keywords should resolve to canonical
    const cheyuVariants = identities.filter(
      (id) =>
        /frank890417|wu che yu/i.test(id.name) || /frank890417/i.test(id.email),
    );
    if (cheyuVariants.length === 0) return; // repo may not have these yet in fresh clone
    for (const id of cheyuVariants) {
      expect(id.canonicalName).toBe('Che-Yu Wu');
      expect(id.canonicalEmail).toBe('cheyu.wu@monoame.com');
    }
  });
});
