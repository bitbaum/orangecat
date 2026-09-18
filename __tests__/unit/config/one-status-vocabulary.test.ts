import { describe, it, expect } from 'vitest';
import { getStatusInfo, STATUS_CONFIG } from '@/config/status-config';
import { getStatusBadge, ENTITY_STATUS_BADGES } from '@/config/entity-status';
import { BADGE_VARIANT_CLASSES } from '@/config/badge-colors';
import { PROJECT_STATUSES, VALID_PROJECT_STATUSES } from '@/config/project-statuses';
import type { EntityType } from '@/config/entity-registry';

/**
 * One status, one answer.
 *
 * Four tables decided what a status looks like, and they disagreed. The one
 * that shipped: a COMPLETED PROJECT rendered green on the dashboard list (which
 * reads the per-entity table) and blue on its own card, its header and its
 * profile card (which read the entity-agnostic table). Same project, same word,
 * two colours, and nothing anywhere could notice.
 *
 * `getStatusInfo(status, entityType)` now resolves through the per-entity table
 * whenever it has an entry, so every surface asks the same question and gets
 * the same answer. These tests are the thing that keeps it that way — a fifth
 * table, or a colour edited in one place, fails here.
 */

describe('every surface agrees about an entity status', () => {
  const entries = Object.entries(ENTITY_STATUS_BADGES) as Array<
    [EntityType, Record<string, { label: string; variant: keyof typeof BADGE_VARIANT_CLASSES }>]
  >;

  it('covers a real set of entities rather than silently nothing', () => {
    // A table that became empty would make every assertion below vacuous.
    expect(entries.length).toBeGreaterThan(5);
    const statuses = entries.flatMap(([, byStatus]) => Object.keys(byStatus));
    expect(statuses.length).toBeGreaterThan(20);
  });

  for (const [entityType, byStatus] of entries) {
    for (const [status, badge] of Object.entries(byStatus)) {
      it(`${entityType}/${status} reads the same through both doors`, () => {
        const info = getStatusInfo(status, entityType);
        const viaBadge = getStatusBadge(entityType, status);

        expect(viaBadge, 'the entity table must still have this entry').toBeDefined();
        expect(info.label, `${entityType}/${status} label`).toBe(badge.label);
        expect(info.className, `${entityType}/${status} colour`).toBe(
          BADGE_VARIANT_CLASSES[badge.variant]
        );
      });
    }
  }
});

describe('the entity-agnostic table is a fallback, not a competitor', () => {
  it('answers when no entity type is given', () => {
    const info = getStatusInfo('active');
    expect(info.label).toBe(STATUS_CONFIG.active.label);
    expect(info.className).toBe(STATUS_CONFIG.active.className);
  });

  it('answers when the entity has no opinion about that status', () => {
    // 'archived' is in the agnostic table; the project table does not list it.
    expect(getStatusBadge('project', 'archived')).toBeUndefined();
    expect(getStatusInfo('archived', 'project').className).toBe(STATUS_CONFIG.archived.className);
  });

  it('still names an unknown status rather than calling it Unknown', () => {
    expect(getStatusInfo('marinated').label).toBe('Marinated');
  });

  it('calls a missing status Unknown', () => {
    expect(getStatusInfo(null).label).toBe('Unknown');
    expect(getStatusInfo(undefined).label).toBe('Unknown');
    expect(getStatusInfo('').label).toBe('Unknown');
  });
});

describe('PROJECT_STATUSES is derived, so it cannot drift again', () => {
  /**
   * This table used to declare its own colours while its docblock claimed to be
   * the single source of truth. It is now computed from the same resolver, and
   * this test is what makes that claim checkable rather than aspirational.
   */
  for (const status of VALID_PROJECT_STATUSES) {
    it(`project/${status} matches the shared answer`, () => {
      const info = getStatusInfo(status, 'project');
      expect(PROJECT_STATUSES[status].label).toBe(info.label);
      expect(PROJECT_STATUSES[status].className).toBe(`border ${info.className}`);
    });
  }

  it('offers every valid project status and no others', () => {
    expect(Object.keys(PROJECT_STATUSES).sort()).toEqual([...VALID_PROJECT_STATUSES].sort());
  });
});
