/**
 * The Cat's `send_payment` runs the same code as tapping Send.
 *
 * It used to be a second, older implementation of paying a person, and the
 * drift was not cosmetic: it read `wallets.lightning_address` directly, so an
 * NWC-only recipient — perfectly payable everywhere else on the platform —
 * came back as "has no Lightning address configured"; and it matched usernames
 * with `.eq`, so paying @Alice failed for a user stored as @alice.
 *
 * These tests pin the delegation itself. If someone reintroduces a local
 * implementation, the shared service stops being called and this fails.
 */

import { paymentHandlers } from '@/services/cat/handlers/payments';
import { sendToRecipient } from '@/domain/payments/sendPaymentService';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/domain/payments/sendPaymentService', () => ({
  sendToRecipient: vi.fn(),
  resolveSenderNwcUri: vi.fn(),
}));

const sendToRecipientMock = sendToRecipient as Mock;
const supabase = {} as never;
const send = (params: Record<string, unknown>) =>
  paymentHandlers.send_payment(supabase, 'user-1', 'actor-1', params);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cat send_payment', () => {
  it('delegates to the shared send service and reports what was paid', async () => {
    sendToRecipientMock.mockResolvedValue({
      ok: true,
      paymentHash: 'hash-1',
      amountBtc: 0.0001,
      destination: 'alice@getalby.com',
    });

    const result = await send({ amount_btc: 0.0001, recipient: '@alice', memo: 'coffee' });

    expect(sendToRecipientMock).toHaveBeenCalledWith('user-1', '@alice', 0.0001, 'coffee');
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      payment_hash: 'hash-1',
      amount_btc: 0.0001,
      recipient: 'alice@getalby.com',
      status: 'paid',
    });
  });

  it('passes the service’s own wording through rather than inventing its own', async () => {
    sendToRecipientMock.mockResolvedValue({
      ok: false,
      reason: 'recipient_cannot_receive',
      message: "@bob can't receive Bitcoin payments right now.",
    });

    const result = await send({ amount_btc: 0.0001, recipient: 'bob' });

    expect(result.success).toBe(false);
    expect(result.error).toBe("@bob can't receive Bitcoin payments right now.");
  });

  it('refuses an amount the model did not fill in, without calling the service', async () => {
    // The params come from a model response, so "a number" is an assumption,
    // not a guarantee — and `undefined <= 0` is false, so a bare comparison
    // would have let it through to a service that expects a real figure.
    for (const amount of [undefined, null, 'lots', NaN, 0, -1]) {
      const result = await send({ amount_btc: amount, recipient: 'alice' });
      expect(result.success).toBe(false);
    }
    expect(sendToRecipientMock).not.toHaveBeenCalled();
  });

  it('refuses a missing recipient, without calling the service', async () => {
    for (const recipient of [undefined, null, '', '   ']) {
      const result = await send({ amount_btc: 0.0001, recipient });
      expect(result.success).toBe(false);
    }
    expect(sendToRecipientMock).not.toHaveBeenCalled();
  });
});
