/**
 * orangecat.ch (2026-11-12):
 * - The "Assets" breadcrumb on a public asset page led strangers to a sign-in
 *   wall and signed-in visitors to their own empty "My Assets"; every sibling
 *   kind opens its public Discover list.
 * - A wishlist's phone button said "Gift an item" but opened a plain money
 *   form where no item can be chosen.
 */
import { ROUTES } from '@/config/routes';
import { ENTITY_PRIMARY_CTA } from '@/config/entity-cta';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));

import AssetsPage from '@/app/(authenticated)/assets/page';
import LoansPage from '@/app/loans/page';

describe('public list routes', () => {
  it('/assets opens the public assets list, as /loans opens loans', () => {
    AssetsPage();
    LoansPage();
    expect(redirect.mock.calls.map(c => c[0])).toEqual([
      ROUTES.DISCOVER_TYPE('assets'),
      ROUTES.DISCOVER_TYPE('loans'),
    ]);
  });
});

describe('a wishlist’s primary button', () => {
  it('does not promise an item it cannot let you choose', () => {
    expect(ENTITY_PRIMARY_CTA.wishlist).not.toMatch(/item/i);
  });
});
