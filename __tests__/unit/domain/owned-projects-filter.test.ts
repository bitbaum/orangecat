/**
 * A profile's projects are the ones its ACTOR owns. Two surfaces filtered by
 * the creating account and showed a freshly claimed owner "Projects 0"
 * (walked live 2026-09-11, ADR-0005).
 */

import { ownedProjectsFilter } from '@/domain/projects/service';

describe('ownedProjectsFilter', () => {
  it('matches the owning actor, or a pre-actor row created by the account', () => {
    expect(ownedProjectsFilter('actor-1', 'user-1')).toBe(
      'actor_id.eq.actor-1,and(actor_id.is.null,user_id.eq.user-1)'
    );
  });
});
