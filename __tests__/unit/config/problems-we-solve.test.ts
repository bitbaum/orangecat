/**
 * The homepage's "What it solves" section links each problem to an entity
 * type. These checks keep that link real: every type is in the registry, ids
 * are unique, and each scale has something to show.
 */

import { describe, it, expect } from 'vitest';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { PROBLEM_SCALES } from '@/config/problems-we-solve';

const allItems = PROBLEM_SCALES.flatMap(scale => scale.items);

describe('problems we solve', () => {
  it('covers both a single person and society', () => {
    expect(PROBLEM_SCALES.map(s => s.id)).toEqual(['people', 'society']);
    for (const scale of PROBLEM_SCALES) {
      expect(scale.items.length).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = allItems.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(allItems.map(i => [i.id, i] as const))(
    '%s points at a registered entity with a create path',
    (_id, item) => {
      expect(ENTITY_TYPES).toContain(item.entityType);
      const meta = ENTITY_REGISTRY[item.entityType];
      expect(meta.createPath.startsWith('/')).toBe(true);
      expect(meta.plain.verb.length).toBeGreaterThan(0);
    }
  );

  it('does not claim roadmap features as live', () => {
    const text = allItems
      .map(i => `${i.problem} ${i.solution}`)
      .join(' ')
      .toLowerCase();
    for (const unshipped of ['encrypted', 'twint', 'paypal', 'venmo']) {
      expect(text).not.toContain(unshipped);
    }
  });
});
