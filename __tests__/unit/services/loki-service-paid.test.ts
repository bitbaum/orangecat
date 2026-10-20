/**
 * A builder booked through Loki is paid through a service in their own name,
 * and Loki marks the booking paid from OrangeCat's settled-payment signal —
 * never from anyone's say-so. So the signal must fire for a service bought
 * outright, not only for funding on a project.
 */
vi.mock('@/services/loki/signed-post', () => ({
  postSignedToLoki: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/untyped', () => ({ looseClient: vi.fn() }));
vi.mock('@/domain/actors', () => ({ getUserActorId: vi.fn() }));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { notifyLokiProjectFunding } from '@/services/loki/entitlement-notify';
import { postSignedToLoki } from '@/services/loki/signed-post';
import type { PaymentIntent } from '@/domain/payments/types';

const intent = (over: Partial<PaymentIntent>): PaymentIntent =>
  ({
    id: 'pi_1',
    entity_type: 'project',
    entity_id: 'e1',
    intent_kind: 'support',
    amount_btc: 0.001,
    description: 'Booking page',
    ...over,
  }) as unknown as PaymentIntent;

describe('payment.settled reaches Loki', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ORANGECAT_WEBHOOK_SECRET = 'test-secret';
  });

  it('for a service bought outright — the fee of a builder booked through Loki', async () => {
    await notifyLokiProjectFunding(intent({ entity_type: 'service', intent_kind: 'purchase' }));
    expect(postSignedToLoki).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        type: 'payment.settled',
        entityType: 'service',
        entityId: 'e1',
        externalId: 'pi_1',
      })
    );
  });

  it('for funding on a project, as before', async () => {
    await notifyLokiProjectFunding(intent({}));
    expect(postSignedToLoki).toHaveBeenCalledTimes(1);
  });

  it('not for a product bought — a pass or a thing from a shop is not a booking', async () => {
    await notifyLokiProjectFunding(intent({ entity_type: 'product', intent_kind: 'purchase' }));
    expect(postSignedToLoki).not.toHaveBeenCalled();
  });
});
