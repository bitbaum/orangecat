/**
 * Cat Credits ledger primitives (credits.ts).
 *
 * The atomicity / overdraw / idempotency logic lives in the SECURITY DEFINER
 * `cat_credit_append` Postgres RPC (covered by DB migrations, not Jest). What
 * this thin wrapper owns — and what every money path depends on — is the RPC
 * contract: correct RPC name + param mapping, numeric coercion of the result,
 * and the "never throw; unavailable reads as no-credits / failed-write" rule.
 */

import { getCreditBalance, appendCreditEntry } from '@/services/cat/credits';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const rpc = vi.fn();
const supabase = { rpc: (...a: unknown[]) => rpc(...a) } as never;

beforeEach(() => vi.clearAllMocks());

describe('getCreditBalance', () => {
  it('reads the balance via cat_credit_balance', async () => {
    rpc.mockResolvedValue({ data: 0.0025, error: null });
    await expect(getCreditBalance(supabase, 'u1')).resolves.toBe(0.0025);
    expect(rpc).toHaveBeenCalledWith('cat_credit_balance', { p_user_id: 'u1' });
  });

  it('coerces a numeric-string balance', async () => {
    rpc.mockResolvedValue({ data: '0.001', error: null });
    await expect(getCreditBalance(supabase, 'u1')).resolves.toBe(0.001);
  });

  it('returns 0 (never throws) on RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'rls' } });
    await expect(getCreditBalance(supabase, 'u1')).resolves.toBe(0);
  });

  it('returns 0 when the RPC throws', async () => {
    rpc.mockRejectedValue(new Error('network'));
    await expect(getCreditBalance(supabase, 'u1')).resolves.toBe(0);
  });
});

describe('appendCreditEntry', () => {
  it('maps the entry to cat_credit_append params and returns the new balance', async () => {
    rpc.mockResolvedValue({ data: 0.003, error: null });
    const balance = await appendCreditEntry(supabase, 'u1', {
      kind: 'topup',
      amountBtc: 0.001,
      ref: 'ph_1',
      metadata: { source: 'lightning' },
    });
    expect(balance).toBe(0.003);
    expect(rpc).toHaveBeenCalledWith('cat_credit_append', {
      p_user_id: 'u1',
      p_kind: 'topup',
      p_amount_btc: 0.001,
      p_ref: 'ph_1',
      p_metadata: { source: 'lightning' },
      p_allow_overdraw: false, // a top-up (credit) never overdraws
    });
  });

  it('defaults optional ref and metadata to null', async () => {
    rpc.mockResolvedValue({ data: 0, error: null });
    await appendCreditEntry(supabase, 'u1', { kind: 'usage', amountBtc: -0.0001 });
    expect(rpc).toHaveBeenCalledWith(
      'cat_credit_append',
      expect.objectContaining({ p_ref: null, p_metadata: null })
    );
  });

  it('returns null on RPC error (incl. insufficient_credits) — never throws at the caller', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '23514', message: 'insufficient_credits' },
    });
    await expect(
      appendCreditEntry(supabase, 'u1', { kind: 'usage', amountBtc: -1 })
    ).resolves.toBeNull();
  });

  it('returns null when the RPC throws', async () => {
    rpc.mockRejectedValue(new Error('boom'));
    await expect(
      appendCreditEntry(supabase, 'u1', { kind: 'grant', amountBtc: 0.001 })
    ).resolves.toBeNull();
  });
});
