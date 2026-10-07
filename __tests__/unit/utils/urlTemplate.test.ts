import { describe, expect, it } from 'vitest';
import { fillUrlTemplate } from '@/utils/urlTemplate';

describe('fillUrlTemplate', () => {
  it('fills every placeholder, not just id', () => {
    // A new group linked to the literal /groups/[slug].
    expect(fillUrlTemplate('/groups/[slug]', { id: 'g1', slug: 'bike-club' })).toBe(
      '/groups/bike-club'
    );
    expect(fillUrlTemplate('/loans/:id/edit', { id: 'l1' })).toBe('/loans/l1/edit');
  });

  it('leaves no placeholder behind when a field is missing', () => {
    expect(fillUrlTemplate('/x/[slug]', {})).toBe('/x/');
  });
});
