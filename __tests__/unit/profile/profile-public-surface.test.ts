/**
 * The public profile's three "what is shown" rules, each of which had drifted:
 *
 * - The Wallets badge added legacy addresses on top of wallet rows, while the
 *   tab only renders legacy addresses when there are no rows ("Wallets 3" over
 *   two cards).
 * - The listing, the tab badges and the profile's project list each carried
 *   their own `.neq('status', 'draft')`, so cancelled test loans were public.
 * - The header line shortens a geocoder path and a website URL.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countShownReceiveMethods, showsLegacyReceive } from '@/lib/wallets/shownReceiveMethods';
import {
  PROFILE_HIDDEN_STATUSES,
  PROFILE_HIDDEN_STATUS_FILTER,
} from '@/config/profile-listing-visibility';
import { shortLocationLabel, websiteHostLabel } from '@/components/profile/ProfileIdentityMeta';

describe('countShownReceiveMethods', () => {
  it('counts wallet rows only when there are any — legacy fields are not rendered then', () => {
    expect(countShownReceiveMethods(2, { lightning_address: 'x@y.z' })).toBe(2);
    expect(showsLegacyReceive(2)).toBe(false);
  });

  it('counts the legacy addresses when there are no wallet rows', () => {
    expect(countShownReceiveMethods(0, { bitcoin_address: 'bc1q', lightning_address: 'x@y' })).toBe(
      2
    );
    expect(countShownReceiveMethods(0, {})).toBe(0);
    expect(showsLegacyReceive(0)).toBe(true);
  });
});

describe('profile listing visibility', () => {
  it('hides drafts, cancelled and archived — and keeps paused visible', () => {
    expect(PROFILE_HIDDEN_STATUSES).toEqual(['draft', 'cancelled', 'archived']);
    expect(PROFILE_HIDDEN_STATUS_FILTER).toBe('(draft,cancelled,archived)');
    expect(PROFILE_HIDDEN_STATUSES).not.toContain('paused');
  });

  it.each([
    'src/app/api/profiles/[userId]/entities/[entityType]/route.ts',
    'src/services/profile/listingCounts.ts',
    'src/app/profiles/[username]/page.tsx',
  ])('%s filters with the shared constant, not its own status list', file => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    expect(source).toContain('PROFILE_HIDDEN_STATUS_FILTER');
    expect(source).not.toMatch(/\.neq\(\s*'status',\s*['A-Z]/);
    expect(source).not.toMatch(/ENTITY_STATUS\.DRAFT/);
  });
});

describe('header labels', () => {
  it('keeps the place and the country of a geocoder path', () => {
    expect(shortLocationLabel('Zurich, District Zurich, Zurich, Switzerland')).toBe(
      'Zurich, Switzerland'
    );
    expect(shortLocationLabel('Basel, Switzerland')).toBe('Basel, Switzerland');
    expect(shortLocationLabel('Bern')).toBe('Bern');
  });

  it('shows a website as its host', () => {
    expect(websiteHostLabel('https://www.orangecat.ch/')).toBe('orangecat.ch');
    expect(websiteHostLabel('https://orangecat.ch/profiles/cato')).toBe('orangecat.ch');
    expect(websiteHostLabel('not a url/')).toBe('not a url');
  });
});
