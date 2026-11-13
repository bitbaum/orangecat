/**
 * The dashboard's setup checklist for a brand-new account (auth-firstrun #6):
 * three rows opened the same profile form, and the Cat's row — the one that
 * does the most setup per tap — sorted last, below the two that were shown.
 */
import { describe, expect, it } from 'vitest';
import { getRecommendedTasks } from '@/services/recommendations';
import { ROUTES } from '@/config/routes';
import type { UserContext } from '@/services/recommendations/types';

function ctx(profile: Partial<UserContext['profile']>, entities = 0): UserContext {
  return {
    profile: { id: 'u1', ...profile },
    entityCounts: entities ? { project: entities } : {},
    hasWallet: false,
    profileCompletion: 10,
    daysSinceLastActivity: null,
    hasPublishedEntities: false,
    wishlistItemCount: 0,
  } as UserContext;
}

const setupRows = (c: UserContext) =>
  getRecommendedTasks(c).filter(t => t.priority === 'critical' || t.priority === 'high');

describe('setup checklist', () => {
  it('leads with the Cat for a person with nothing yet', () => {
    const rows = setupRows(ctx({ username: 'user_a3eaa53c23cd', display_name: null }));
    expect(rows[0].id).toBe('chat-with-cat');
  });

  it('offers the profile form once, not once per field', () => {
    const named = setupRows(ctx({ username: 'adelina', display_name: 'Adelina' }));
    const toForm = named.filter(t => t.action.href === ROUTES.DASHBOARD.INFO_EDIT);
    expect(toForm.map(t => t.id)).toEqual(['complete-profile']);

    const nameless = setupRows(ctx({ username: 'user_a3eaa53c23cd', display_name: null }));
    expect(nameless.filter(t => t.action.href === ROUTES.DASHBOARD.INFO_EDIT)).toHaveLength(1);
  });

  it('says its rows in sentence case', () => {
    for (const row of getRecommendedTasks(ctx({ username: 'adelina' }))) {
      const rest = row.title.split(' ').slice(1);
      expect(rest.filter(w => /^[A-Z][a-z]/.test(w) && !['Bitcoin', 'Cat'].includes(w))).toEqual(
        []
      );
    }
  });
});
