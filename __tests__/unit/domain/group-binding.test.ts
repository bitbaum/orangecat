import { toBinding } from '@/domain/groups/binding.server';

/**
 * The binding answer is what Solon checks before founding an organization
 * that IS one of our groups. It must name the owner's ACTOR (never a user id)
 * and carry a place only when all three levels are there.
 */
describe('toBinding', () => {
  const row = {
    id: 'g1',
    slug: 'witikon-fund',
    name: 'Witikon Fund',
    label: 'local_fund',
    is_public: true,
    country_code: 'CH',
    region: 'Zürich',
    locality: 'Witikon',
    created_by: 'user-1',
  };

  it('names the owner actor and never the user id', () => {
    const b = toBinding(row, 'actor-1');
    expect(b.owner_actor_id).toBe('actor-1');
    expect(JSON.stringify(b)).not.toContain('user-1');
  });

  it('carries a complete place or none', () => {
    expect(toBinding(row, 'a').place).toEqual({
      country_code: 'CH',
      region: 'Zürich',
      locality: 'Witikon',
    });
    expect(toBinding({ ...row, region: null }, 'a').place).toBeNull();
  });
});
