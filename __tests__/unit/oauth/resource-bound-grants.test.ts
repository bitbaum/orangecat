/**
 * A grant is bound to the resource it was consented for (RFC 8707). At the
 * token endpoint a client may repeat that resource or omit it — anything else
 * is `invalid_target`, answered BEFORE the code is burned or the refresh token
 * revoked, so a client that sent the wrong value can retry.
 */
import { createHash } from 'node:crypto';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

let row: Record<string, unknown> | null = null;
const update = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      is: self,
      update: (...args: unknown[]) => {
        update(...args);
        return chain;
      },
      maybeSingle: async () => ({ data: row }),
    });
    return { from: () => chain };
  }),
}));

import { OAUTH_RESOURCES } from '@/lib/oauth/config';
import {
  INVALID_TARGET,
  consumeAuthCode,
  rotateRefreshToken,
  type OAuthClient,
} from '@/services/auth/oauthProvider';

const VERIFIER = 'v'.repeat(50);
const LOKI = OAUTH_RESOURCES.loki.uri;
const OC = OAUTH_RESOURCES.orangecat.uri;

beforeEach(() => {
  update.mockClear();
});

describe('consumeAuthCode', () => {
  beforeEach(() => {
    row = {
      id: 'code-row',
      client_id: 'dcr_x',
      redirect_uri: 'https://app.example/cb',
      code_challenge: createHash('sha256').update(VERIFIER).digest('base64url'),
      code_challenge_method: 'S256',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: null,
      resource: LOKI,
    };
  });
  const redeem = (resource?: string) =>
    consumeAuthCode('code', {
      clientId: 'dcr_x',
      redirectUri: 'https://app.example/cb',
      codeVerifier: VERIFIER,
      resource,
    });

  it('refuses another resource without burning the code', async () => {
    expect(await redeem(OC)).toBe(INVALID_TARGET);
    expect(update).not.toHaveBeenCalled();
  });

  it('only says invalid_target to a caller who already proved the code', async () => {
    const wrongVerifier = await consumeAuthCode('code', {
      clientId: 'dcr_x',
      redirectUri: 'https://app.example/cb',
      codeVerifier: 'x'.repeat(50),
      resource: OC,
    });
    expect(wrongVerifier).toBeNull();
  });

  it('carries the bound resource when repeated or omitted', async () => {
    expect(await redeem(LOKI)).toMatchObject({ resource: LOKI });
    expect(await redeem()).toMatchObject({ resource: LOKI });
  });
});

describe('rotateRefreshToken', () => {
  it('refuses another resource without revoking the token', async () => {
    row = {
      id: 'rt-row',
      client_id: 'dcr_x',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      resource: LOKI,
    };
    const client = { client_id: 'dcr_x' } as OAuthClient;
    expect(await rotateRefreshToken('rt', client, { resource: OC })).toBe(INVALID_TARGET);
    expect(update).not.toHaveBeenCalled();
  });
});
