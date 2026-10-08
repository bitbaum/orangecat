/**
 * The owner's rule decides which wallet a payment to them lands in — through
 * the real resolution path, against a fake that applies the queries.
 *
 * The usual choice (NWC > Lightning > on-chain, primary first) would always
 * pick `main` here, so every case where another wallet wins proves the rule
 * did it. And every way a rule can be wrong — naming someone else's wallet, a
 * deactivated one, or being satisfied — must fall back to that usual choice
 * rather than leave the person unpayable.
 */

import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import { createFakeSupabase, type Row } from '../../../../test-utils/fakeSupabase';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/domain/payments/encryptionService', () => ({ decrypt: vi.fn((s: string) => s) }));
// Today's price, without the network: routing sits on a payment path.
vi.mock('@/services/currency/rates.server', () => ({
  getRenderRates: vi.fn(() => ({ rates: { CHF: 50_000 }, fetchedAt: Date.now() })),
}));

const OWNER = 'user-1';
const STRANGER = 'user-2';
const STARTS = '2026-10-01T00:00:00.000Z';

function wallet(over: Row): Row {
  return {
    profile_id: OWNER,
    is_active: true,
    is_primary: false,
    wallet_type: 'lightning',
    nwc_connection_uri: null,
    lightning_address: null,
    address_or_xpub: null,
    created_at: '2026-01-01',
    ...over,
  };
}

const WALLETS: Row[] = [
  wallet({ id: 'main', is_primary: true, nwc_connection_uri: 'nostr+walletconnect://main' }),
  wallet({ id: 'tax', lightning_address: 'tax@getalby.com' }),
  wallet({ id: 'aoz', lightning_address: 'aoz-repay@getalby.com' }),
  wallet({ id: 'off', lightning_address: 'old@getalby.com', is_active: false }),
  wallet({ id: 'theirs', profile_id: STRANGER, lightning_address: 'stranger@getalby.com' }),
];

function line(over: Row): Row {
  return {
    profile_id: OWNER,
    kind: 'share',
    share_bps: null,
    target_amount: null,
    target_currency: null,
    period: 'once',
    starts_at: STARTS,
    created_at: STARTS,
    ...over,
  };
}

const TAX_FIRST = line({ wallet_id: 'tax', position: 0, kind: 'share', share_bps: 2500 });
const AOZ_THEN = line({
  wallet_id: 'aoz',
  position: 1,
  kind: 'fill',
  target_amount: '1000.00',
  target_currency: 'CHF',
});

function paid(walletId: string, chf: number): Row {
  return {
    seller_id: OWNER,
    status: 'paid',
    receiving_wallet_id: walletId,
    amount_btc: chf / 50_000,
    rates_at_paid: { CHF: 50_000 },
    paid_at: '2026-10-05T00:00:00.000Z',
  };
}

function resolve(tables: { money_routes?: Row[]; payment_intents?: Row[] }) {
  const { client } = createFakeSupabase({
    wallets: WALLETS,
    money_routes: tables.money_routes ?? [],
    payment_intents: tables.payment_intents ?? [],
  });
  return resolveUserWallet(client as never, OWNER);
}

describe('resolveUserWallet follows the owner’s rule', () => {
  it('without a rule, chooses exactly as before', async () => {
    expect(await resolve({})).toMatchObject({ method: 'nwc', wallet_id: 'main' });
  });

  it('sends the first payment to taxes', async () => {
    expect(await resolve({ money_routes: [TAX_FIRST, AOZ_THEN] })).toMatchObject({
      method: 'lightning_address',
      wallet_id: 'tax',
      lightning_address: 'tax@getalby.com',
    });
  });

  it('then to the debt once taxes hold their share', async () => {
    const r = await resolve({
      money_routes: [TAX_FIRST, AOZ_THEN],
      payment_intents: [paid('tax', 100)],
    });
    expect(r).toMatchObject({ wallet_id: 'aoz', lightning_address: 'aoz-repay@getalby.com' });
  });

  it('back to the usual wallet once every line is satisfied', async () => {
    const r = await resolve({
      money_routes: [TAX_FIRST, AOZ_THEN],
      payment_intents: [paid('tax', 400), paid('aoz', 1000)],
    });
    expect(r).toMatchObject({ method: 'nwc', wallet_id: 'main' });
  });

  it('never routes into someone else’s wallet', async () => {
    const forged = line({ wallet_id: 'theirs', position: 0, share_bps: 10000 });
    expect(await resolve({ money_routes: [forged] })).toMatchObject({ wallet_id: 'main' });
  });

  it('skips a deactivated wallet rather than paying into it', async () => {
    const stale = line({ wallet_id: 'off', position: 0, share_bps: 10000 });
    expect(await resolve({ money_routes: [stale] })).toMatchObject({ wallet_id: 'main' });
  });

  it('ignores payments that landed before the rule began', async () => {
    const before = { ...paid('tax', 1000), paid_at: '2026-09-15T00:00:00.000Z' };
    // Nothing counts yet, so taxes still come first.
    expect(await resolve({ money_routes: [TAX_FIRST], payment_intents: [before] })).toMatchObject({
      wallet_id: 'tax',
    });
  });
});
