// @vitest-environment jsdom
/**
 * A new owner's profile is not a blank panel.
 *
 * The owner's support card was always pushed into the Overview list, and an
 * element is truthy, so the empty state never rendered while the card itself
 * rendered nothing until a wallet could receive. And the only filled button
 * on the page published an empty offerings card.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const receive = vi.hoisted(() => ({ can: false as boolean | null }));
vi.mock('@/components/profile/useCanReceive', () => ({ useCanReceive: () => receive.can }));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: (n: number) => `${n} BTC` }),
}));

import ProfileOverviewTab from '@/components/profile/ProfileOverviewTab';
import OwnerProfileOfferings from '@/components/profile/OwnerProfileOfferings';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import type { ScalableProfile } from '@/services/profile/types';

const profile = { id: 'p1', username: 'ana', name: 'Ana' } as ScalableProfile;

afterEach(() => vi.unstubAllGlobals());

describe('own profile Overview on first run', () => {
  it('offers three first steps when nothing can be shown', () => {
    receive.can = false;
    render(<ProfileOverviewTab profile={profile} isOwnProfile />);
    const links = screen.getAllByRole('link').map(a => a.getAttribute('href'));
    expect(links).toEqual([
      ROUTES.DASHBOARD.WALLETS,
      ROUTES.DASHBOARD.INFO_EDIT,
      ENTITY_REGISTRY.project.createPath,
    ]);
  });

  it('tells a visitor there is nothing more, without the owner steps', () => {
    receive.can = false;
    render(<ProfileOverviewTab profile={profile} />);
    expect(screen.getByText('Nothing more to show yet.')).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('own offerings with nothing in them', () => {
  it('shows the empty card and its way to fill it, not a publish button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            enabled: false,
            offerings: { skills: [], assets: [], askedFor: [], notAvailableFor: [] },
          },
        }),
      })
    );
    render(<OwnerProfileOfferings />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Ask Cat to help me figure this out/ })).toBeTruthy()
    );
    expect(screen.queryByRole('button', { name: 'Make offerings public' })).toBeNull();
  });
});
