/**
 * Idempotency-Key claim — branch tests.
 *
 * 0700c423 introduced the optimistic-claim pattern that closes the
 * parallel-retry race the 2026-06-03 audit flagged. There are five
 * paths through claimIdempotencyKey() and so far zero coverage on
 * any of them. This file locks each branch down with a mocked admin
 * client that returns controllable insert + lookup results.
 *
 * Created: 2026-06-03
 */

import { claimIdempotencyKey } from '@/services/idempotency/idempotencyResults';

// Per-test controllable mock state for the admin Supabase client.
interface MockState {
  insertError: { code?: string; message?: string } | null;
  lookupRow: {
    body_hash: string;
    status: string;
    response_status: number | null;
    response_body: unknown;
    expires_at: string;
  } | null;
  lookupError: { message: string } | null;
}

const state: MockState = {
  insertError: null,
  lookupRow: null,
  lookupError: null,
};

function resetState() {
  state.insertError = null;
  state.lookupRow = null;
  state.lookupError = null;
}

// Builder factory: insert() resolves to `{ error }`, the select chain
// `.select().eq().eq().eq().gt().maybeSingle()` resolves to
// `{ data, error }`. We return a single proxy that supports both shapes
// so the same `from()` call works whether the caller is inserting or
// selecting.
function makeBuilder() {
  const selectChain = {
    eq() {
      return selectChain;
    },
    gt() {
      return selectChain;
    },
    async maybeSingle() {
      return { data: state.lookupRow, error: state.lookupError };
    },
  };

  return {
    async insert() {
      return { error: state.insertError };
    },
    select() {
      return selectChain;
    },
  };
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => makeBuilder(),
  }),
}));

const params = {
  userId: 'user-1',
  key: 'idem-key-1',
  method: 'POST',
  path: '/api/v1/products',
  bodyHash: 'hash-abc',
};

describe('claimIdempotencyKey', () => {
  beforeEach(resetState);

  it("returns 'won' on a clean insert", async () => {
    state.insertError = null;
    const result = await claimIdempotencyKey(params);
    expect(result).toEqual({ kind: 'won' });
  });

  it("returns 'won' when insert fails with a non-unique-violation error (degrades to no-cache)", async () => {
    // The contract: any unhealthy DB outcome falls back to 'won' so
    // the request still serves the user — just without dedup.
    state.insertError = { code: '23503', message: 'foreign_key_violation' };
    const result = await claimIdempotencyKey(params);
    expect(result).toEqual({ kind: 'won' });
  });

  it("returns 'replay' on unique-violation + existing complete row with matching body_hash", async () => {
    state.insertError = { code: '23505', message: 'unique_violation' };
    state.lookupRow = {
      body_hash: 'hash-abc',
      status: 'complete',
      response_status: 201,
      response_body: { id: 'prod-1' },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const result = await claimIdempotencyKey(params);
    expect(result.kind).toBe('replay');
    if (result.kind === 'replay') {
      expect(result.hit.responseStatus).toBe(201);
      expect(result.hit.responseBody).toEqual({ id: 'prod-1' });
      expect(result.hit.bodyHash).toBe('hash-abc');
    }
  });

  it("returns 'body_mismatch' on unique-violation + existing row with different body_hash", async () => {
    state.insertError = { code: '23505', message: 'unique_violation' };
    state.lookupRow = {
      body_hash: 'hash-xyz', // different from params.bodyHash
      status: 'complete',
      response_status: 201,
      response_body: { id: 'prod-1' },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const result = await claimIdempotencyKey(params);
    expect(result).toEqual({ kind: 'body_mismatch' });
  });

  it("returns 'wait' on unique-violation + existing pending row with matching body_hash", async () => {
    state.insertError = { code: '23505', message: 'unique_violation' };
    state.lookupRow = {
      body_hash: 'hash-abc',
      status: 'pending',
      response_status: null,
      response_body: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const result = await claimIdempotencyKey(params);
    expect(result).toEqual({ kind: 'wait' });
  });

  it("returns 'won' (race-of-races) on unique-violation + lookup returns null", async () => {
    // The conflicting row was deleted between insert attempt and
    // lookup — treat as a fresh win.
    state.insertError = { code: '23505', message: 'unique_violation' };
    state.lookupRow = null;
    const result = await claimIdempotencyKey(params);
    expect(result).toEqual({ kind: 'won' });
  });

  it("returns 'won' when lookup itself errors (defensive fallback)", async () => {
    // Lookup-error path also routes back to 'won' to keep the request
    // serving the user.
    state.insertError = { code: '23505', message: 'unique_violation' };
    state.lookupRow = null;
    state.lookupError = { message: 'connection_reset' };
    const result = await claimIdempotencyKey(params);
    expect(result).toEqual({ kind: 'won' });
  });

  it("returns 'replay' even when the matching row has response_status 200 (not just 201)", async () => {
    // Reads/updates can replay too — the contract is "status set and
    // complete", not "newly-created".
    state.insertError = { code: '23505', message: 'unique_violation' };
    state.lookupRow = {
      body_hash: 'hash-abc',
      status: 'complete',
      response_status: 200,
      response_body: { updated: true },
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const result = await claimIdempotencyKey(params);
    expect(result.kind).toBe('replay');
  });

  it("returns 'wait' if the row is 'complete' but response_status is somehow null (defensive)", async () => {
    // Belt-and-braces: complete-with-no-response shouldn't exist given
    // the claim → complete state machine, but if it does we wait
    // rather than 'replay' a null payload.
    state.insertError = { code: '23505', message: 'unique_violation' };
    state.lookupRow = {
      body_hash: 'hash-abc',
      status: 'complete',
      response_status: null,
      response_body: null,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const result = await claimIdempotencyKey(params);
    expect(result).toEqual({ kind: 'wait' });
  });
});
