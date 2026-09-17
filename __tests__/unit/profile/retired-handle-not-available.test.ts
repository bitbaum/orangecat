/**
 * A handle nobody uses any more is not a free handle.
 *
 * A retired handle still resolves: /profiles/<old> 301s to its owner's current
 * handle, and <old>@orangecat.ch still reaches them through
 * profile_username_history. Both lookups consult the LIVE profiles table first
 * and only fall back to history on a miss — so if a retired handle were handed
 * to somebody else, that person would silently intercept everything still
 * pointing at its previous owner, including payments to a Lightning address
 * they had published.
 *
 * 20260826160000 named this risk in a comment and nothing enforced it:
 * availability was checked against profiles alone, so every retired handle read
 * as available.
 */

import { ProfileServerService } from '@/services/profile/server';
import { resolveHistoricalUsername } from '@/domain/lightning-address/username-history';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/domain/lightning-address/username-history', () => ({
  resolveHistoricalUsername: vi.fn(),
}));

const resolveHistoricalUsernameMock = resolveHistoricalUsername as Mock;

const OWNER = 'cec88bc9-0000-0000-0000-000000000001';
const SOMEONE_ELSE = 'cec88bc9-0000-0000-0000-000000000002';

/** Supabase stub whose profiles lookup always reports "no live row". */
function makeSupabase() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self,
    eq: self,
    neq: self,
    single: () => Promise.resolve({ data: null }),
  });
  return { from: () => chain } as never;
}

describe('checkUsernameAvailability', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses a handle another account retired', async () => {
    resolveHistoricalUsernameMock.mockResolvedValue(SOMEONE_ELSE);

    const available = await ProfileServerService.checkUsernameAvailability(
      makeSupabase(),
      'their_old_handle',
      OWNER
    );

    expect(available).toBe(false);
  });

  it('lets an account take back a handle it retired itself', async () => {
    // Not merely permissive: the profile page and LNURL both resolve live
    // profiles first, so reclaiming your own handle points it back at exactly
    // the account it already pointed at. Nothing is intercepted.
    resolveHistoricalUsernameMock.mockResolvedValue(OWNER);

    const available = await ProfileServerService.checkUsernameAvailability(
      makeSupabase(),
      'my_old_handle',
      OWNER
    );

    expect(available).toBe(true);
  });

  it('still allows a handle nobody has ever held', async () => {
    resolveHistoricalUsernameMock.mockResolvedValue(null);

    const available = await ProfileServerService.checkUsernameAvailability(
      makeSupabase(),
      'catomean',
      OWNER
    );

    expect(available).toBe(true);
  });
});
