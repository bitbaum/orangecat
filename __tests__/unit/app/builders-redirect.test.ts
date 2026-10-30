/**
 * Builders live on bitbaum — one directory, where people apply and the studio
 * approves who is listed. OrangeCat's /builders, and /partners (the old word
 * and address), hand over to that directory instead of keeping a second
 * definition.
 */

import BuildersPage from '@/app/(public)/builders/page';
import PartnersPage from '@/app/(public)/partners/page';
import { ECOSYSTEM } from '@/config/ecosystem';
import { permanentRedirect } from 'next/navigation';

import type { Mock } from 'vitest';

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('/builders and /partners', () => {
  it.each([
    ['/builders', BuildersPage],
    ['/partners', PartnersPage],
  ])('%s redirects permanently to the bitbaum builder directory', (_path, Page) => {
    expect(() => Page()).toThrow('NEXT_REDIRECT');
    expect(permanentRedirect as Mock).toHaveBeenCalledWith(ECOSYSTEM.studio.buildersUrl);
  });

  it('points at bitbaum, under the studio it belongs to', () => {
    expect(ECOSYSTEM.studio.buildersUrl.startsWith(ECOSYSTEM.studio.siteUrl)).toBe(true);
    expect(ECOSYSTEM.studio.buildersUrl).toMatch(/\/builders\/$/);
  });
});
