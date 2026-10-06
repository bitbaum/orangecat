/**
 * What a refresh does to the refresh token, by client type.
 *
 * Confidential clients (every first-party app) keep their token and have its
 * expiry slid forward; public clients get it rotated. Rotating confidential
 * clients signed Heidi users out about an hour after signing in: Auth.js
 * refreshes inside a page render, cannot write the cookie there, so the new
 * token was lost and the next refresh presented a revoked one. See
 * rotateRefreshToken in src/services/auth/oauthProvider.ts.
 */
import { createHash } from 'node:crypto';
import { exportPKCS8, generateKeyPair } from 'jose';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/oauth/keys', async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  await exportPKCS8(privateKey); // proves the key is usable as the real loader's
  return { getSigningKey: async () => ({ privateKey, kid: 'test-kid' }) };
});

/** The live row the token lookup returns; null = no such token. */
let row: Record<string, unknown> | null = null;
/** What a conditional update returns; null = the row was revoked meanwhile. */
let updateHit: Record<string, unknown> | null = { id: 'rt-row' };
const update = vi.fn();
const insert = vi.fn(async (_r: Record<string, unknown>) => ({ error: null }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    let updating = false;
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      is: self,
      insert,
      update: (patch: Record<string, unknown>) => {
        updating = true;
        update(patch);
        // The database remembers a revocation: the next lookup sees it.
        if (row && patch.revoked_at) {
          row = { ...row, revoked_at: patch.revoked_at };
        }
        return chain;
      },
      maybeSingle: async () => ({ data: updating ? updateHit : row }),
    });
    return { from: () => chain };
  }),
}));

import { OAUTH_TTL } from '@/lib/oauth/config';
import { rotateRefreshToken, type OAuthClient } from '@/services/auth/oauthProvider';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const confidential = { client_id: 'heidi', is_confidential: true } as OAuthClient;
const publicClient = { client_id: 'dcr_x', is_confidential: false } as OAuthClient;

function liveRow(client_id: string) {
  return {
    id: 'rt-row',
    client_id,
    actor_id: 'actor-1',
    user_id: 'user-1',
    scopes: ['openid'],
    resource: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: null,
  };
}

beforeEach(() => {
  update.mockClear();
  insert.mockClear();
  updateHit = { id: 'rt-row' };
});

describe('confidential client', () => {
  it('keeps the same refresh token and returns it', async () => {
    row = liveRow('heidi');
    const res = await rotateRefreshToken('rt-heidi', confidential);
    expect(res && typeof res === 'object' && res.refresh_token).toBe('rt-heidi');
    expect(insert).not.toHaveBeenCalled();
  });

  it('slides the expiry forward and never revokes', async () => {
    row = liveRow('heidi');
    const before = Date.now();
    await rotateRefreshToken('rt-heidi', confidential);
    const patch = update.mock.calls[0][0];
    expect(patch).not.toHaveProperty('revoked_at');
    const slid = new Date(patch.expires_at as string).getTime();
    expect(slid).toBeGreaterThanOrEqual(before + OAUTH_TTL.refreshToken * 1000 - 1000);
  });

  it('survives the same token being presented twice — the lost-cookie case', async () => {
    row = liveRow('heidi');
    const first = await rotateRefreshToken('rt-heidi', confidential);
    const second = await rotateRefreshToken('rt-heidi', confidential);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });

  it('is refused once revoked (Disconnect, Sign out everywhere)', async () => {
    row = { ...liveRow('heidi'), revoked_at: new Date().toISOString() };
    expect(await rotateRefreshToken('rt-heidi', confidential)).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('loses to a revocation that lands between lookup and update', async () => {
    row = liveRow('heidi');
    updateHit = null;
    expect(await rotateRefreshToken('rt-heidi', confidential)).toBeNull();
  });
});

describe('public client', () => {
  it('rotates: revokes the presented token and issues a new one', async () => {
    row = liveRow('dcr_x');
    const res = await rotateRefreshToken('rt-public', publicClient);
    expect(update.mock.calls[0][0]).toHaveProperty('revoked_at');
    const issued = res && typeof res === 'object' ? res.refresh_token : undefined;
    expect(issued).toBeTruthy();
    expect(issued).not.toBe('rt-public');
    expect(insert.mock.calls[0][0]).toMatchObject({ token_hash: sha256(issued as string) });
  });

  it('refuses the old token once it has been rotated', async () => {
    row = liveRow('dcr_x');
    updateHit = null; // the conditional revoke found it already revoked
    expect(await rotateRefreshToken('rt-public', publicClient)).toBeNull();
  });
});
