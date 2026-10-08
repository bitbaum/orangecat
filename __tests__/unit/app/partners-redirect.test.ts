/**
 * Partners live on bitbaum — one directory, where people apply and the studio
 * approves who is listed. OrangeCat's /partners keeps its address working and
 * hands over to that directory instead of keeping a second definition.
 */

import PartnersPage from '@/app/(public)/partners/page';
import { ECOSYSTEM } from '@/config/ecosystem';
import { permanentRedirect } from 'next/navigation';

import type { Mock } from 'vitest';

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('/partners', () => {
  it('redirects permanently to the bitbaum partner directory', () => {
    expect(() => PartnersPage()).toThrow('NEXT_REDIRECT');
    expect(permanentRedirect as Mock).toHaveBeenCalledWith(ECOSYSTEM.studio.partnersUrl);
  });

  it('points at bitbaum, under the studio it belongs to', () => {
    expect(ECOSYSTEM.studio.partnersUrl.startsWith(ECOSYSTEM.studio.siteUrl)).toBe(true);
    expect(ECOSYSTEM.studio.partnersUrl).toMatch(/\/partners\/$/);
  });
});
