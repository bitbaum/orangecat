// @vitest-environment jsdom
/**
 * The navigation generator is the ONLY door from the entity registry into the
 * sidebar. These tests enforce that: if someone adds an entity type and forgets
 * to place it in a group, the suite fails here rather than the entity quietly
 * vanishing from navigation — or, worse, getting hand-placed into the primary
 * section (which is exactly how Documents ended up ranked above Home).
 */

import { generateEntityNavigation, GROUPED_ENTITY_TYPES } from '@/config/navigation-generator';
import { ENTITY_TYPES, ENTITY_REGISTRY } from '@/config/entity-registry';

describe('generateEntityNavigation', () => {
  it('places every registered entity type in exactly one group', () => {
    const missing = ENTITY_TYPES.filter(t => !GROUPED_ENTITY_TYPES.includes(t));
    expect(missing).toEqual([]);

    const seen = new Set<string>();
    const duplicated = GROUPED_ENTITY_TYPES.filter(t => {
      if (seen.has(t)) {
        return true;
      }
      seen.add(t);
      return false;
    });
    expect(duplicated).toEqual([]);
  });

  it('claims no entity type that the registry does not define', () => {
    const unknown = GROUPED_ENTITY_TYPES.filter(t => !ENTITY_TYPES.includes(t));
    expect(unknown).toEqual([]);
  });

  it('renders every generated item from registry metadata, never a literal', () => {
    for (const section of generateEntityNavigation()) {
      for (const item of section.items) {
        const match = ENTITY_TYPES.find(t => ENTITY_REGISTRY[t].basePath === item.href);
        expect(match).toBeDefined();
        expect(item.name).toBe(ENTITY_REGISTRY[match!].namePlural);
        expect(item.requiresAuth).toBe(true);
      }
    }
  });

  it('keeps every entity group collapsed so the sidebar opens short', () => {
    for (const section of generateEntityNavigation()) {
      expect(section.defaultExpanded).toBe(false);
      expect(section.collapsible).toBe(true);
    }
  });

  it('returns groups in ascending priority order', () => {
    const priorities = generateEntityNavigation().map(s => s.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it('routes Documents through the generator rather than the primary section', () => {
    const create = generateEntityNavigation().find(s => s.id === 'create');
    expect(create?.items.map(i => i.href)).toContain(ENTITY_REGISTRY.document.basePath);
  });
});
