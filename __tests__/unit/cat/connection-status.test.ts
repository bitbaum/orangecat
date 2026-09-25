/**
 * Per-user connection status must never say "Connected" for a partial link.
 *
 * The founder saw "Connected · @catomean · public only" beside a "Connect your
 * GitHub account" button and could not tell whether GitHub was connected.
 * A profile handle alone is `limited`; only the account connection is
 * `connected`.
 */

vi.mock('@/domain/actors', () => ({ getUserActorId: vi.fn(async () => null) }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn(() => ({})) }));
vi.mock('@/services/ai/github-repos-fetcher', () => ({
  getGitHubHandleForUser: vi.fn(async () => 'catomean'),
}));
vi.mock('@/services/github/connection', () => ({
  githubConnectionConfigured: vi.fn(() => true),
  hasGitHubConnection: vi.fn(async () => null),
}));

import { getCatConnectionStatuses } from '@/services/cat/connections';
import { hasGitHubConnection } from '@/services/github/connection';
import type { MockedFunction } from 'vitest';

const noWallets = {
  from: () => {
    const q = {
      select: () => q,
      eq: () => q,
      limit: async () => ({ data: [], error: null }),
    };
    return q;
  },
} as never;

const github = async () =>
  (await getCatConnectionStatuses(noWallets, 'u1')).find(c => c.id === 'github')!;

describe('GitHub connection status', () => {
  it('is "limited", not "connected", when only a profile handle is known', async () => {
    const g = await github();
    expect(g.state).toBe('limited');
    expect(g.detail).toBe('@catomean');
    expect(g.offerConnect).toBe(true);
    expect(g.connect.kind).toBe('redirect');
    expect(g.disconnectEndpoint).toBeNull();
  });

  it('is "connected" only through the account, and then offers disconnect, not connect', async () => {
    (hasGitHubConnection as MockedFunction<typeof hasGitHubConnection>).mockResolvedValueOnce({
      login: 'catomean',
    });
    const g = await github();
    expect(g.state).toBe('connected');
    expect(g.offerConnect).toBe(false);
    expect(g.disconnectEndpoint).toBeTruthy();
  });
});
