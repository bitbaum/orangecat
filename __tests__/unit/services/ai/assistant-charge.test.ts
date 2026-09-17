/**
 * Paid AI-assistant charging — money path.
 *
 * This is one of the two real-money paths that go live the moment the platform
 * wallet (PLATFORM_NWC_URI) is provisioned: a paid `ai_assistant` message debits
 * the chatter's Cat Credits and grants the creator's 95% share. This suite pins
 * the rules that protect balances:
 *   - free / non-per_message / misconfigured prices bill 0 (never drain a balance),
 *   - the SANE_MAX guard refuses a mis-scaled legacy sats-in-BTC-column value,
 *   - settlement is 95/5, and the creator is NEVER paid when the payer debit
 *     didn't land (no money minted out of a failed charge).
 * The unit is BTC everywhere.
 */

import {
  computeCreatorChargeBtc,
  checkAffordability,
  settleAssistantCharge,
} from '@/services/ai/assistant-charge';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const appendCreditEntry = vi.fn();
const getCreditBalance = vi.fn();
vi.mock('@/services/cat/credits', () => ({
  appendCreditEntry: (...a: unknown[]) => appendCreditEntry(...a),
  getCreditBalance: (...a: unknown[]) => getCreditBalance(...a),
}));

// bumpAssistantRevenue reads then updates a counter row; a chainable stub is enough.
const revenueRow = { total_revenue: 0 };
vi.mock('@/lib/supabase/untyped', () => ({
  fromTable: () => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: revenueRow }) }) }),
    update: () => ({ eq: async () => ({ data: null, error: null }) }),
  }),
}));

const admin = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  revenueRow.total_revenue = 0;
});

describe('computeCreatorChargeBtc', () => {
  const perMessage = (price: number | null) => ({
    pricing_model: 'per_message',
    price_per_message: price,
  });

  it('charges the per_message price for a paid message', () => {
    expect(computeCreatorChargeBtc(perMessage(0.0001), false)).toBe(0.0001);
  });

  it('a free message costs nothing regardless of price', () => {
    expect(computeCreatorChargeBtc(perMessage(0.0001), true)).toBe(0);
  });

  it('non-per_message pricing models are not metered yet → 0', () => {
    expect(computeCreatorChargeBtc({ pricing_model: 'free', price_per_message: 0 }, false)).toBe(0);
    expect(
      computeCreatorChargeBtc({ pricing_model: 'per_token', price_per_message: 0.0001 }, false)
    ).toBe(0);
    expect(
      computeCreatorChargeBtc({ pricing_model: 'subscription', price_per_message: 0.0001 }, false)
    ).toBe(0);
  });

  it('null / zero / negative / non-finite prices bill 0', () => {
    expect(computeCreatorChargeBtc(perMessage(null), false)).toBe(0);
    expect(computeCreatorChargeBtc(perMessage(0), false)).toBe(0);
    expect(computeCreatorChargeBtc(perMessage(-0.0001), false)).toBe(0);
    expect(computeCreatorChargeBtc(perMessage(NaN), false)).toBe(0);
  });

  it('refuses a price above the sane max (mis-scaled legacy sats-in-BTC-column value)', () => {
    // 100000 "sats" that never got divided by 1e8 would sit as 100000 in a BTC column.
    expect(computeCreatorChargeBtc(perMessage(100000), false)).toBe(0);
    // Just over the ceiling is still refused; exactly at a sane price bills.
    expect(computeCreatorChargeBtc(perMessage(0.0100001), false)).toBe(0);
    expect(computeCreatorChargeBtc(perMessage(0.01), false)).toBe(0.01);
  });

  it('rounds to satoshi precision (numeric(18,8))', () => {
    // Sub-satoshi resolution is rounded away: 0.0000000260 BTC → 3 sats.
    expect(computeCreatorChargeBtc(perMessage(0.000000026), false)).toBe(0.00000003);
    // A whole-satoshi price passes through unchanged.
    expect(computeCreatorChargeBtc(perMessage(0.00000004), false)).toBe(0.00000004);
  });
});

describe('checkAffordability', () => {
  it('ok when balance covers the charge', async () => {
    getCreditBalance.mockResolvedValue(0.001);
    await expect(checkAffordability(admin, 'payer', 0.0005)).resolves.toEqual({ ok: true });
  });

  it('exact balance is affordable', async () => {
    getCreditBalance.mockResolvedValue(0.0005);
    await expect(checkAffordability(admin, 'payer', 0.0005)).resolves.toEqual({ ok: true });
  });

  it('reports the balance when funds are short', async () => {
    getCreditBalance.mockResolvedValue(0.0001);
    await expect(checkAffordability(admin, 'payer', 0.0005)).resolves.toEqual({
      ok: false,
      balance: 0.0001,
    });
  });
});

describe('settleAssistantCharge', () => {
  const baseArgs = {
    payerUserId: 'payer',
    creatorUserId: 'creator',
    assistantId: 'asst-1',
    messageId: 'msg-1',
    chargeBtc: 0.001,
    model: 'some-model',
    totalTokens: 1234,
  };

  it('debits the payer and grants the creator the whole price; the platform keeps nothing', async () => {
    appendCreditEntry.mockResolvedValue(0.5); // non-null → debit landed
    await settleAssistantCharge(admin, baseArgs);

    // Debit: negative usage entry, idempotent on the message id.
    const debit = appendCreditEntry.mock.calls[0] as [unknown, string, any];
    expect(debit[1]).toBe('payer');
    expect(debit[2].kind).toBe('usage');
    expect(debit[2].amountBtc).toBeCloseTo(-0.001, 10);
    expect(debit[2].ref).toBe('msg-1');
    // Message already served → the charge must land even into a negative
    // balance (closes the concurrent-message TOCTOU free-ride).
    expect(debit[2].allowOverdraw).toBe(true);

    // Grant: the creator gets the whole gross, tagged as assistant revenue.
    const grant = appendCreditEntry.mock.calls[1] as [unknown, string, any];
    expect(grant[1]).toBe('creator');
    expect(grant[2].kind).toBe('grant');
    expect(grant[2].amountBtc).toBeCloseTo(0.001, 10); // 100% of 0.001
    // A credit (creator payout) must NEVER overdraw — only served debits do.
    expect(grant[2].allowOverdraw).toBeFalsy();
    expect(grant[2].ref).toBe('msg-1:creator');
    expect(grant[2].metadata.grossBtc).toBe(0.001);

    expect(appendCreditEntry).toHaveBeenCalledTimes(2);
  });

  it('does NOT pay the creator when the payer debit did not land (no money minted)', async () => {
    appendCreditEntry.mockResolvedValueOnce(null); // debit returned null (race/dup/transient)
    await settleAssistantCharge(admin, baseArgs);

    expect(appendCreditEntry).toHaveBeenCalledTimes(1); // debit only, no creator grant
    expect(appendCreditEntry.mock.calls[0][1]).toBe('payer');
  });

  it('does not pay when the creator is the payer (self-chat)', async () => {
    appendCreditEntry.mockResolvedValue(0.5);
    await settleAssistantCharge(admin, { ...baseArgs, creatorUserId: 'payer' });

    // Only the debit; no self-payout.
    expect(appendCreditEntry).toHaveBeenCalledTimes(1);
    expect(appendCreditEntry.mock.calls[0][2].kind).toBe('usage');
  });

  it('a failed creator payout does not throw (platform retains the share)', async () => {
    appendCreditEntry
      .mockResolvedValueOnce(0.5) // debit ok
      .mockResolvedValueOnce(null); // creator grant fails
    await expect(settleAssistantCharge(admin, baseArgs)).resolves.toBeUndefined();
    expect(appendCreditEntry).toHaveBeenCalledTimes(2);
  });
});
