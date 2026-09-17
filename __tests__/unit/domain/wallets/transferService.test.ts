/**
 * Unit coverage for executeWalletTransfer — the money-movement guard rails.
 *
 * The happy path and each failure code are exercised against a chainable
 * supabase stub. The guard tests matter most: a non-positive amount or a
 * same-wallet transfer must short-circuit BEFORE any balance-move RPC runs.
 */

import { executeWalletTransfer } from '@/domain/wallets/transferService';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/api/auditLog', () => ({
  auditSuccess: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { WALLET_BALANCE_REFRESHED: 'wallet.balance_refreshed' },
}));

const USER = 'user-1';
const FROM = 'wallet-from';
const TO = 'wallet-to';

/**
 * Chainable supabase stub. Each awaited builder chain and each single()/rpc()
 * call shifts the next queued response, in consumption order.
 */
function makeSupabase(responses: Array<{ data?: unknown; error?: unknown }>) {
  const queue = [...responses];
  const next = () => (queue.length ? queue.shift()! : { data: null, error: null });

  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'eq', 'insert', 'update']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(next()));
  // Make the builder thenable so `await from().select().in().eq()` resolves.
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(resolve, reject);

  const rpc = vi.fn(() => Promise.resolve(next()));
  return { client: { from: vi.fn(() => builder), rpc }, rpc };
}

const twoWallets = () => [
  { id: FROM, user_id: USER, label: 'From', balance_btc: 1, profile_id: 'p1', project_id: null },
  { id: TO, user_id: USER, label: 'To', balance_btc: 0, profile_id: 'p2', project_id: null },
];

describe('executeWalletTransfer — guards (no DB touched)', () => {
  it('rejects a non-positive amount before any query', async () => {
    const { client } = makeSupabase([]);
    const res = await executeWalletTransfer(client, USER, FROM, TO, 0);
    expect(res).toMatchObject({ ok: false, code: 'INVALID_AMOUNT' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects a negative amount (would otherwise flow funds backwards)', async () => {
    const { client } = makeSupabase([]);
    const res = await executeWalletTransfer(client, USER, FROM, TO, -0.5);
    expect(res).toMatchObject({ ok: false, code: 'INVALID_AMOUNT' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects a same-wallet transfer', async () => {
    const { client } = makeSupabase([]);
    const res = await executeWalletTransfer(client, USER, FROM, FROM, 0.1);
    expect(res).toMatchObject({ ok: false, code: 'SAME_WALLET' });
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe('executeWalletTransfer — validated paths', () => {
  it('returns NOT_FOUND when both wallets are not returned', async () => {
    const { client } = makeSupabase([{ data: [{ id: FROM }], error: null }]);
    const res = await executeWalletTransfer(client, USER, FROM, TO, 0.1);
    expect(res).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('returns FORBIDDEN when a wallet belongs to another user', async () => {
    const wallets = twoWallets();
    wallets[1].user_id = 'someone-else';
    const { client } = makeSupabase([{ data: wallets, error: null }]);
    const res = await executeWalletTransfer(client, USER, FROM, TO, 0.1);
    expect(res).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('returns INSUFFICIENT_BALANCE when amount exceeds balance', async () => {
    const { client } = makeSupabase([{ data: twoWallets(), error: null }]);
    const res = await executeWalletTransfer(client, USER, FROM, TO, 5);
    expect(res).toMatchObject({ ok: false, code: 'INSUFFICIENT_BALANCE' });
  });

  it('completes the transfer and calls the balance-move RPC', async () => {
    const { client, rpc } = makeSupabase([
      { data: twoWallets(), error: null }, // wallets fetch
      { data: { id: 'tx-1' }, error: null }, // transaction insert
      { error: null }, // rpc
      { data: twoWallets(), error: null }, // updated wallets fetch
    ]);
    const res = await executeWalletTransfer(client, USER, FROM, TO, 0.5, 'rent');
    expect(res.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'transfer_between_wallets',
      expect.objectContaining({
        p_from_wallet_id: FROM,
        p_to_wallet_id: TO,
        p_amount_btc: 0.5,
        p_transaction_id: 'tx-1',
      })
    );
  });

  it('returns UPDATE_ERROR and does not report success when the RPC fails', async () => {
    const { client } = makeSupabase([
      { data: twoWallets(), error: null },
      { data: { id: 'tx-1' }, error: null },
      { error: { message: 'rpc boom' } }, // rpc fails
    ]);
    const res = await executeWalletTransfer(client, USER, FROM, TO, 0.5);
    expect(res).toMatchObject({ ok: false, code: 'UPDATE_ERROR' });
  });
});
