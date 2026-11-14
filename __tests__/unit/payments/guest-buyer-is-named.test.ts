/**
 * A buyer without an account is named to the seller, in the claim and in the
 * email. The claim said "A supporter says they've paid" for a purchase, and
 * the seller's email looked the buyer up with `.eq('id', null)` and said
 * "Anonymous" while the in-app note named the guest.
 */
const sendEmail = vi.fn().mockResolvedValue({ sent: true });
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/notifications/recipientEmail', () => ({
  resolveRecipientEmail: vi
    .fn()
    .mockResolvedValue({ email: 'seller@example.org', displayName: 'Cato' }),
}));
vi.mock('@/lib/email/client', () => ({
  isEmailConfigured: () => true,
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));

import { claimant } from '@/domain/payments/paymentStatusFlow';
import { sendSellerPaymentNotification } from '@/lib/email/send-seller-notification';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createFakeSupabase } from '../../../test-utils/fakeSupabase';
import type { PaymentIntent } from '@/domain/payments/types';

describe('who says they paid', () => {
  it('a purchase is claimed by a buyer, named when they bought without an account', () => {
    expect(claimant({ intent_kind: 'purchase', guest_name: ' Ana ' })).toBe(
      'Ana (a buyer without an account)'
    );
    expect(claimant({ intent_kind: 'purchase', guest_name: null })).toBe('A buyer');
  });

  it('support is still claimed by a supporter', () => {
    expect(claimant({ intent_kind: 'support', guest_name: null })).toBe('A supporter');
  });
});

describe('the seller’s email', () => {
  const intent = (over: Partial<PaymentIntent>) =>
    ({
      id: 'pi-1',
      seller_id: 'seller-1',
      buyer_id: null,
      guest_name: 'Ana',
      amount_btc: 0.0002,
      payment_method: 'nwc',
      description: 'Product: Morning with Cat',
      entity_type: 'product',
      entity_id: 'p1',
      ...over,
    }) as unknown as PaymentIntent;

  it('names the guest, and never looks a profile up by a null id', async () => {
    const db = createFakeSupabase({ [DATABASE_TABLES.PROFILES]: [{ id: null, name: 'Nobody' }] });
    await sendSellerPaymentNotification(intent({}), db.client);
    expect(JSON.stringify(sendEmail.mock.calls)).toContain('Ana');
    expect(JSON.stringify(sendEmail.mock.calls)).not.toContain('Nobody');
  });
});
