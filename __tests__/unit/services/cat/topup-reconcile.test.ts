/**
 * Cat Credits top-up reconciliation — the backstop for money that already
 * arrived.
 *
 * The bug this closes: settlement was detected ONLY by the payer's open
 * TopUpDialog, so paying and closing the tab left the sats in the treasury and
 * the row `pending` forever — no credit, no ledger entry, nothing to notice.
 * Production held such a row for four days.
 *
 * These tests pin the properties that make the backstop trustworthy:
 *   - it credits a settled top-up with NO browser involved,
 *   - it credits the row's recorded OWNER,
 *   - it never writes the terminal `expired` while a payment could still land,
 *   - one unreachable/failing row does not abort the sweep,
 *   - it stays off entirely when no platform wallet is configured.
 */

import { runTopUpReconcileSweep } from '@/services/cat/topup-reconcile';
import { TOPUP_EXPIRY_GRACE_MS } from '@/services/cat/credit-topup';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const platformReceiveEnabled = vi.fn();
const getPlatformNwcClient = vi.fn();
vi.mock('@/lib/bitcoin/platform-wallet', () => ({
  platformReceiveEnabled: () => platformReceiveEnabled(),
  getPlatformNwcClient: () => getPlatformNwcClient(),
}));

const appendCreditEntry = vi.fn();
const getCreditBalance = vi.fn();
vi.mock('@/services/cat/credits', () => ({
  appendCreditEntry: (...a: unknown[]) => appendCreditEntry(...a),
  getCreditBalance: (...a: unknown[]) => getCreditBalance(...a),
}));

const adminFrom = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({ from: (...a: unknown[]) => adminFrom(...a) }),
}));

/** Records every `.update({...})` payload so we can assert what was persisted. */
const updates: Array<Record<string, unknown>> = [];

function qb(awaitResult: unknown) {
  const builder: Record<string, unknown> = {
    select: () => builder,
    update: (payload: Record<string, unknown>) => {
      updates.push(payload);
      return builder;
    },
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve: (v: unknown) => unknown) => resolve(awaitResult),
  };
  return builder;
}

const HOUR = 60 * 60 * 1000;

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tu_1',
    user_id: 'owner_1',
    amount_btc: 0.0001,
    payment_hash: 'ph_1',
    status: 'pending',
    expires_at: new Date(Date.now() + HOUR).toISOString(),
    ...over,
  };
}

function nwcClient(over: Record<string, unknown> = {}) {
  return {
    lookupInvoice: vi.fn().mockResolvedValue({ settled_at: null }),
    disconnect: vi.fn(),
    ...over,
  };
}

/** Rows come back from the select; every later await resolves to the same stub. */
function withRows(rows: unknown[]) {
  adminFrom.mockReturnValue(qb({ data: rows, error: null }));
}

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
  platformReceiveEnabled.mockReturnValue(true);
  appendCreditEntry.mockResolvedValue(0.0001);
  getCreditBalance.mockResolvedValue(0.0001);
});

describe('runTopUpReconcileSweep', () => {
  it('does nothing — and opens no connection — when no platform wallet is configured', async () => {
    platformReceiveEnabled.mockReturnValue(false);

    const result = await runTopUpReconcileSweep();

    expect(result).toMatchObject({ scanned: 0, settled: 0, expired: 0 });
    expect(getPlatformNwcClient).not.toHaveBeenCalled();
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it('credits a settled top-up nobody was watching, to the row OWNER', async () => {
    withRows([row()]);
    const client = nwcClient({
      lookupInvoice: vi.fn().mockResolvedValue({ settled_at: 1_700_000_000 }),
    });
    getPlatformNwcClient.mockResolvedValue(client);

    const result = await runTopUpReconcileSweep();

    expect(result).toMatchObject({ scanned: 1, settled: 1, expired: 0 });
    expect(appendCreditEntry).toHaveBeenCalledWith(
      expect.anything(),
      'owner_1', // the recorded owner — never "whoever asked"
      expect.objectContaining({ kind: 'topup', amountBtc: 0.0001, ref: 'ph_1' })
    );
    expect(updates).toContainEqual(expect.objectContaining({ status: 'paid' }));
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('does not mark paid when crediting fails — the row stays pending for the next tick', async () => {
    withRows([row()]);
    appendCreditEntry.mockResolvedValue(null);
    getPlatformNwcClient.mockResolvedValue(
      nwcClient({ lookupInvoice: vi.fn().mockResolvedValue({ settled_at: 1_700_000_000 }) })
    );

    const result = await runTopUpReconcileSweep();

    expect(result).toMatchObject({ scanned: 1, settled: 0 });
    expect(updates).toHaveLength(0);
  });

  it('leaves an unsettled invoice inside its window pending', async () => {
    withRows([row()]);
    getPlatformNwcClient.mockResolvedValue(nwcClient());

    const result = await runTopUpReconcileSweep();

    expect(result).toMatchObject({ scanned: 1, settled: 0, expired: 0 });
    expect(updates).toHaveLength(0);
  });

  it('NEVER writes expired while a payment could still land (past window, inside grace)', async () => {
    // The money-loss trap: `expired` is terminal — the row is never looked up
    // again — so writing it on our own locally-computed timestamp would strand
    // any payment still in flight.
    withRows([row({ expires_at: new Date(Date.now() - HOUR).toISOString() })]);
    getPlatformNwcClient.mockResolvedValue(nwcClient());

    const result = await runTopUpReconcileSweep();

    expect(updates).toHaveLength(0);
    expect(result.expired).toBe(0); // not retired, so not counted as retired
  });

  it('retires a row only once no payment can still arrive (past grace)', async () => {
    withRows([
      row({ expires_at: new Date(Date.now() - TOPUP_EXPIRY_GRACE_MS - HOUR).toISOString() }),
    ]);
    getPlatformNwcClient.mockResolvedValue(nwcClient());

    const result = await runTopUpReconcileSweep();

    expect(updates).toContainEqual({ status: 'expired' });
    expect(result).toMatchObject({ scanned: 1, expired: 1 });
  });

  it('still checks a settled invoice that is past its window — payment wins over expiry', async () => {
    withRows([row({ expires_at: new Date(Date.now() - HOUR).toISOString() })]);
    getPlatformNwcClient.mockResolvedValue(
      nwcClient({ lookupInvoice: vi.fn().mockResolvedValue({ settled_at: 1_700_000_000 }) })
    );

    const result = await runTopUpReconcileSweep();

    expect(result.settled).toBe(1);
    expect(updates).toContainEqual(expect.objectContaining({ status: 'paid' }));
  });

  it('one failing row does not abort the sweep', async () => {
    withRows([row({ id: 'tu_bad' }), row({ id: 'tu_good', payment_hash: 'ph_2' })]);
    const lookupInvoice = vi
      .fn()
      .mockRejectedValueOnce(new Error('relay down'))
      .mockResolvedValueOnce({ settled_at: 1_700_000_000 });
    getPlatformNwcClient.mockResolvedValue(nwcClient({ lookupInvoice }));

    const result = await runTopUpReconcileSweep();

    expect(result).toMatchObject({ scanned: 2, settled: 1 });
  });

  it('reports zero and connects to nothing when there are no pending rows', async () => {
    withRows([]);

    const result = await runTopUpReconcileSweep();

    expect(result).toMatchObject({ scanned: 0, settled: 0, expired: 0 });
    expect(getPlatformNwcClient).not.toHaveBeenCalled();
  });
});
