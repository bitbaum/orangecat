/**
 * Webhook delivery service — contract tests.
 *
 * The deliveryService shipped to customers (Loki) across the
 * 211188a3 → bfd39b6d webhook thread. truncateResponseBody +
 * computeNextAttempt are pure functions; the rest poke the admin DB
 * client via a controllable mock. None of them had direct tests until
 * now, and any silent regression on the backoff schedule or the
 * replay semantics would surprise customers.
 *
 * Created: 2026-06-04
 */

import {
  computeNextAttempt,
  truncateResponseBody,
  enqueueDeliveryReplay,
  deliveryBelongsToEndpoint,
  pruneDeliveredWebhookDeliveries,
} from '@/services/webhooks/deliveryService';

// =============================================================================
// Pure-function tests — no mocks
// =============================================================================

describe('truncateResponseBody', () => {
  it('passes null through as null', () => {
    expect(truncateResponseBody(null)).toBeNull();
  });

  it('passes undefined through as null', () => {
    expect(truncateResponseBody(undefined)).toBeNull();
  });

  it('returns short bodies unchanged', () => {
    expect(truncateResponseBody('ok')).toBe('ok');
    expect(truncateResponseBody('')).toBe('');
  });

  it('returns a body at exactly the cap unchanged', () => {
    const at = 'a'.repeat(4 * 1024);
    expect(truncateResponseBody(at)).toBe(at);
  });

  it('truncates a body over the 4KB cap and appends a marker', () => {
    const over = 'a'.repeat(4 * 1024 + 100);
    const result = truncateResponseBody(over);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(4 * 1024 + 20);
    expect(result!.endsWith('…[truncated]')).toBe(true);
  });
});

describe('computeNextAttempt', () => {
  // The published schedule from docs and the service docstring:
  // 1 → 1m, 2 → 5m, 3 → 25m, 4 → 2h, 5 → 12h, 6 → 24h, then fail.
  const NOW = new Date(1_700_000_000_000);

  it.each([
    [1, 1 * 60_000],
    [2, 5 * 60_000],
    [3, 25 * 60_000],
    [4, 120 * 60_000],
    [5, 720 * 60_000],
    [6, 1440 * 60_000],
  ])('attempt %i schedules %i ms in the future', (attempt, expectedMs) => {
    const result = computeNextAttempt(attempt, NOW);
    expect(result.shouldFail).toBe(false);
    expect(result.nextAttemptAt).not.toBeNull();
    expect(result.nextAttemptAt!.getTime() - NOW.getTime()).toBe(expectedMs);
  });

  it('after 6 attempts (== MAX_ATTEMPTS+1) flips to shouldFail with no nextAttempt', () => {
    // claimDelivery bumps attempt_count BEFORE calling here, so when the
    // worker fails attempt 6 the value passed in is 6, and the schedule
    // above runs. When it fails attempt 7 the next call sees 7 ≥ MAX.
    const result = computeNextAttempt(7, NOW);
    expect(result.shouldFail).toBe(true);
    expect(result.nextAttemptAt).toBeNull();
  });

  it('uses the wall clock when no `now` is passed', () => {
    const before = Date.now();
    const result = computeNextAttempt(1);
    const after = Date.now();
    expect(result.nextAttemptAt).not.toBeNull();
    const t = result.nextAttemptAt!.getTime();
    expect(t).toBeGreaterThanOrEqual(before + 60_000);
    expect(t).toBeLessThanOrEqual(after + 60_000);
  });
});

// =============================================================================
// DB-touching tests — controllable admin client mock
// =============================================================================

interface MockState {
  updateError: { message?: string } | null;
  updateReturnsRow: boolean;
  selectError: { message?: string } | null;
  selectRow: { id: string } | null;
  deleteCount: number | null;
  deleteError: { message?: string } | null;
  /** Captured insert/update payload for assertions. */
  lastUpdatePayload: Record<string, unknown> | null;
}

const state: MockState = {
  updateError: null,
  updateReturnsRow: true,
  selectError: null,
  selectRow: null,
  deleteCount: 0,
  deleteError: null,
  lastUpdatePayload: null,
};

function resetState() {
  state.updateError = null;
  state.updateReturnsRow = true;
  state.selectError = null;
  state.selectRow = null;
  state.deleteCount = 0;
  state.deleteError = null;
  state.lastUpdatePayload = null;
}

function makeBuilder() {
  const updateChain = {
    eq() {
      return updateChain;
    },
    select() {
      return updateChain;
    },
    async maybeSingle() {
      return {
        data: state.updateReturnsRow ? { id: 'd-1' } : null,
        error: state.updateError,
      };
    },
  };

  const selectChain = {
    eq() {
      return selectChain;
    },
    async maybeSingle() {
      return { data: state.selectRow, error: state.selectError };
    },
  };

  const deleteChain = {
    eq() {
      return deleteChain;
    },
    lt() {
      return deleteChain;
    },
    // The service awaits the chain directly to read count/error.
    then(resolve: (v: { count: number | null; error: { message?: string } | null }) => unknown) {
      return Promise.resolve({ count: state.deleteCount, error: state.deleteError }).then(resolve);
    },
  };

  return {
    update(payload: Record<string, unknown>) {
      state.lastUpdatePayload = payload;
      return updateChain;
    },
    select() {
      return selectChain;
    },
    delete() {
      return deleteChain;
    },
  };
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => makeBuilder(),
  }),
}));

describe('enqueueDeliveryReplay', () => {
  beforeEach(resetState);

  it('resets attempt_count, status, response fields, and schedules now', async () => {
    const before = Date.now();
    const result = await enqueueDeliveryReplay('d-1');
    const after = Date.now();
    expect(result).toBe(true);

    const payload = state.lastUpdatePayload!;
    expect(payload.status).toBe('pending');
    expect(payload.attempt_count).toBe(0);
    expect(payload.response_status).toBeNull();
    expect(payload.response_body).toBeNull();
    expect(payload.last_attempt_at).toBeNull();

    // next_attempt_at is now-ish
    const next = new Date(payload.next_attempt_at as string).getTime();
    expect(next).toBeGreaterThanOrEqual(before - 5);
    expect(next).toBeLessThanOrEqual(after + 5);
  });

  it('returns false on DB error', async () => {
    state.updateError = { message: 'boom' };
    expect(await enqueueDeliveryReplay('d-1')).toBe(false);
  });

  it('returns false when the row does not exist (no row returned)', async () => {
    state.updateReturnsRow = false;
    expect(await enqueueDeliveryReplay('d-1')).toBe(false);
  });
});

describe('deliveryBelongsToEndpoint', () => {
  beforeEach(resetState);

  it('returns true when the row exists for the (delivery, endpoint) pair', async () => {
    state.selectRow = { id: 'd-1' };
    expect(await deliveryBelongsToEndpoint('d-1', 'e-1')).toBe(true);
  });

  it('returns false when no row matches', async () => {
    state.selectRow = null;
    expect(await deliveryBelongsToEndpoint('d-1', 'e-1')).toBe(false);
  });

  it('returns false on query error (fail-closed)', async () => {
    state.selectError = { message: 'boom' };
    expect(await deliveryBelongsToEndpoint('d-1', 'e-1')).toBe(false);
  });
});

describe('pruneDeliveredWebhookDeliveries', () => {
  beforeEach(resetState);

  it('returns the deleted count on success', async () => {
    state.deleteCount = 7;
    expect(await pruneDeliveredWebhookDeliveries()).toBe(7);
  });

  it('returns 0 on DB error (cron task contract: log + swallow)', async () => {
    state.deleteError = { message: 'boom' };
    expect(await pruneDeliveredWebhookDeliveries()).toBe(0);
  });

  it('returns 0 when the count is null', async () => {
    state.deleteCount = null;
    expect(await pruneDeliveredWebhookDeliveries()).toBe(0);
  });
});
