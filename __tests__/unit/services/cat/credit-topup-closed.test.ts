/**
 * With the till shut, no invoice is minted. At all.
 *
 * credit-topup.test.ts opens the gate so it can exercise the minting logic.
 * This file is the other half, and the half that protects real money: with
 * PAID_PLANS_OPEN false, `initiateTopUp` must refuse BEFORE it touches the
 * wallet — no invoice, no pending row, nothing for anyone to pay.
 *
 * Asserting "returns null" alone would be too weak. A null return with an
 * invoice already minted at the provider is exactly the failure worth
 * preventing: somebody could pay it, and nothing on our side would be
 * expecting the money.
 */

import { initiateTopUp } from '@/services/cat/credit-topup';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Shut, which is also the real default — this mock states it rather than
// relying on the ambient env.
vi.mock('@/config/commerce', () => ({
  PAID_PLANS_OPEN: false,
  COMMERCE_CLOSED: { badge: 'Not open yet', short: '', full: '', meanwhile: '' },
}));

const makeInvoice = vi.fn();
const getPlatformNwcClient = vi.fn();

vi.mock('@/lib/bitcoin/platform-wallet', () => ({
  // Deliberately TRUE: a configured wallet must not be enough on its own.
  // That conflation is the bug this gate exists to fix.
  platformReceiveEnabled: () => true,
  getPlatformNwcClient: () => getPlatformNwcClient(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => {
    throw new Error('the database must not be reached when the till is shut');
  },
}));

describe('initiateTopUp with paid plans closed', () => {
  beforeEach(() => {
    makeInvoice.mockReset();
    getPlatformNwcClient.mockReset();
  });

  it('returns null', async () => {
    await expect(initiateTopUp('user-1', 0.0001)).resolves.toBeNull();
  });

  it('never reaches the wallet — no invoice exists for anyone to pay', async () => {
    await initiateTopUp('user-1', 0.0001);
    expect(getPlatformNwcClient).not.toHaveBeenCalled();
    expect(makeInvoice).not.toHaveBeenCalled();
  });

  it('refuses even though a receiving wallet IS configured', async () => {
    // platformReceiveEnabled() is mocked true above. Before this gate that
    // alone opened the till, so configuring a wallet to test something would
    // have started taking money as a side effect.
    await expect(initiateTopUp('user-1', 0.001)).resolves.toBeNull();
    expect(getPlatformNwcClient).not.toHaveBeenCalled();
  });

  it('refuses every amount, including ones that would otherwise be valid', async () => {
    for (const amount of [0.00001, 0.0001, 0.001, 0.01]) {
      await expect(initiateTopUp('user-1', amount)).resolves.toBeNull();
    }
    expect(getPlatformNwcClient).not.toHaveBeenCalled();
  });
});
