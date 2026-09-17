/**
 * Integration-keys service — branch tests for the two hottest paths.
 *
 * verifyIntegrationKey is called on every authenticated public-API
 * request — getting any branch wrong silently affects every customer.
 * rotateIntegrationKey is the leak-response path — silent failures
 * leave the old key live when the user thinks they've burnt it.
 *
 * Created: 2026-06-04
 */

import { verifyIntegrationKey, rotateIntegrationKey } from '@/services/auth/integrationKeys';

// =============================================================================
// Controllable admin-client mock
// =============================================================================

interface MockState {
  selectRow: Record<string, unknown> | null;
  selectError: { message?: string } | null;
}

const state: MockState = {
  selectRow: null,
  selectError: null,
};

function resetState() {
  state.selectRow = null;
  state.selectError = null;
}

function makeBuilder() {
  // Both verify (.select().eq().is().maybeSingle()) and rotate's source
  // fetch (.select().eq().eq().is().maybeSingle()) go through the same
  // chain. The mock's .eq()/.is() are no-ops; tests control the
  // returned row + error.
  const selectChain = {
    eq() {
      return selectChain;
    },
    is() {
      return selectChain;
    },
    async maybeSingle() {
      return { data: state.selectRow, error: state.selectError };
    },
  };

  const updateChain = {
    eq() {
      return updateChain;
    },
    // verifyIntegrationKey's fire-and-forget last_used_at touch uses
    // a thenable: `.update().eq().then(...)`. We resolve a clean
    // outcome so the touch is a no-op.
    then(resolve: (v: { error: null }) => unknown) {
      return Promise.resolve({ error: null }).then(resolve);
    },
  };

  return {
    select() {
      return selectChain;
    },
    update() {
      return updateChain;
    },
  };
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => makeBuilder(),
  }),
}));

// resolveCreationActor is exercised inside createIntegrationKey, which
// rotateIntegrationKey calls. We only test rotate's "key not found"
// path here so resolveCreationActor never runs; mock as a thrower to
// make accidental coverage shake loose.
vi.mock('@/services/actors/resolveCreationActor', () => ({
  resolveCreationActor: vi.fn(() => {
    throw new Error('resolveCreationActor should not be called in these tests');
  }),
  ActorNotPermittedError: class ActorNotPermittedError extends Error {},
}));

// =============================================================================
// verifyIntegrationKey
// =============================================================================

const liveRow = {
  id: 'k-1',
  user_id: 'u-1',
  actor_id: 'a-1',
  scopes: ['products.write'],
  is_test: false,
  expires_at: null,
  revoked_at: null,
};

describe('verifyIntegrationKey', () => {
  beforeEach(resetState);

  describe('cheap startsWith short-circuit', () => {
    it.each([null, undefined, ''])('rejects falsy plaintext (%p)', async value => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(await verifyIntegrationKey(value as any)).toBeNull();
    });

    it('rejects plaintext without an ock_ prefix', async () => {
      // A Supabase access token (sbp_) mis-routed here should bail
      // before the DB roundtrip.
      state.selectRow = liveRow; // would succeed if reached
      expect(await verifyIntegrationKey('sbp_abc123')).toBeNull();
    });

    it('accepts the live prefix', async () => {
      state.selectRow = liveRow;
      const result = await verifyIntegrationKey('ock_abcdef0123');
      expect(result).not.toBeNull();
    });

    it('accepts the sandbox prefix', async () => {
      state.selectRow = { ...liveRow, is_test: true };
      const result = await verifyIntegrationKey('ock_test_abcdef');
      expect(result).not.toBeNull();
      expect(result?.isTest).toBe(true);
    });
  });

  describe('DB outcomes', () => {
    it('returns null when the DB errors (no auth detail leaked)', async () => {
      state.selectError = { message: 'connection_reset' };
      expect(await verifyIntegrationKey('ock_xxxxxxxxxx')).toBeNull();
    });

    it('returns null when no row matches the hash', async () => {
      state.selectRow = null;
      expect(await verifyIntegrationKey('ock_xxxxxxxxxx')).toBeNull();
    });

    it('returns null when the row is expired', async () => {
      // expires_at strictly in the past
      state.selectRow = {
        ...liveRow,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      };
      expect(await verifyIntegrationKey('ock_xxxxxxxxxx')).toBeNull();
    });

    it('returns success with all fields when the row is fresh', async () => {
      state.selectRow = liveRow;
      const result = await verifyIntegrationKey('ock_xxxxxxxxxx');
      expect(result).toEqual({
        userId: 'u-1',
        actorId: 'a-1',
        keyId: 'k-1',
        scopes: ['products.write'],
        isTest: false,
      });
    });

    it('defaults scopes to ["*"] when the column is null (back-compat)', async () => {
      state.selectRow = { ...liveRow, scopes: null };
      const result = await verifyIntegrationKey('ock_xxxxxxxxxx');
      expect(result?.scopes).toEqual(['*']);
    });

    it('defaults isTest to false when the column is null (pre-migration rows)', async () => {
      state.selectRow = { ...liveRow, is_test: null };
      const result = await verifyIntegrationKey('ock_xxxxxxxxxx');
      expect(result?.isTest).toBe(false);
    });

    it('accepts a row with future expiry', async () => {
      state.selectRow = {
        ...liveRow,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      };
      expect(await verifyIntegrationKey('ock_xxxxxxxxxx')).not.toBeNull();
    });
  });
});

// =============================================================================
// rotateIntegrationKey — narrow tests on the source-fetch path
// =============================================================================

describe('rotateIntegrationKey', () => {
  beforeEach(resetState);

  it('throws "Key not found" when the source row is missing', async () => {
    state.selectRow = null;
    await expect(rotateIntegrationKey('k-1', 'u-1')).rejects.toThrow('Key not found');
  });

  it('throws "Key not found" when the row was revoked (filter excludes)', async () => {
    // The .is('revoked_at', null) filter excludes revoked rows — the
    // mock's no-op .is() means we simulate this by returning null here.
    state.selectRow = null;
    await expect(rotateIntegrationKey('k-1', 'u-1')).rejects.toThrow('Key not found');
  });

  it('re-throws DB errors on the source fetch (no silent rotate)', async () => {
    state.selectError = { message: 'connection_reset' };
    await expect(rotateIntegrationKey('k-1', 'u-1')).rejects.toBeDefined();
  });
});
