// @vitest-environment jsdom
/**
 * The dashboard's "Set up your profile" card must not claim progress nobody
 * made.
 *
 * Measured on production (2026-11-12) for an account that had just been
 * created and had done nothing: the card read "56% Setup — 4 tasks remaining"
 * with the bar half full, while Edit Profile (where every task button leads)
 * read "Profile Completion 9%". The 56 was 5 of 9 critical/high tasks whose
 * condition was false — but false meant "gated off" (no wallet yet, no project
 * yet), not "done". The stats route is run here for that same account and its
 * payload is fed through the real hook into the card.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { GET } from '@/app/api/users/me/stats/route';
import TasksSection from '@/components/dashboard/TasksSection';
import { ENTITY_TYPES } from '@/config/entity-registry';

import type { Mock } from 'vitest';

vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown) => Promise<unknown>) =>
    (req: unknown): Promise<unknown> =>
      handler(Object.assign(req as object, { user: { id: 'new-account' }, supabase: {} })),
}));
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({ status: 200, data })),
  apiUnauthorized: vi.fn(() => ({ status: 401 })),
  handleApiError: vi.fn((error: unknown) => {
    throw error;
  }),
}));
vi.mock('@/services/recommendations/fetchUserStats', () => ({
  fetchUserStats: vi.fn(async () => ({
    // What the server mints at sign-up, and nothing else.
    profile: {
      id: 'new-account',
      username: 'user_d35e21b04b6b',
      name: null,
      bio: null,
      avatar_url: null,
      bitcoin_address: null,
      lightning_address: null,
      website: null,
      location: null,
      preferred_currency: null,
    },
    entityCounts: Object.fromEntries(
      ENTITY_TYPES.filter(t => t !== 'wallet').map(t => [t, 0])
    ) as Record<string, number>,
    hasWallet: false,
    daysSinceLastActivity: null,
    hasPublishedEntities: false,
    wishlistItemCount: 0,
  })),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'new-account' }, profile: { username: 'user_d35e21b04b6b' } }),
}));

afterEach(cleanup);

async function statsPayload(): Promise<Record<string, unknown>> {
  const res = (await GET(new Request('https://orangecat.ch/api/users/me/stats') as never)) as {
    data: Record<string, unknown>;
  };
  return res.data;
}

it('serves no setup percentage for a brand-new account', async () => {
  expect(await statsPayload()).not.toHaveProperty('taskCompletion');
});

it('shows a brand-new account the tasks left, not a half-full setup bar', async () => {
  const payload = await statsPayload();
  (global.fetch as Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data: payload }),
  });

  // The dashboard's own props (DashboardJourney).
  const { container } = render(<TasksSection showQuestions maxTasks={2} quietWhenDone />);

  // Let the Cat set you up, and add a name. Bio and photo open the same form
  // as the name, so they are one row and wait until the name is there.
  expect(await screen.findByText('2 tasks remaining')).toBeVisible();
  expect(container.textContent).not.toMatch(/%/);
  expect(container.querySelector('[style*="width"]')).toBeNull();
});
