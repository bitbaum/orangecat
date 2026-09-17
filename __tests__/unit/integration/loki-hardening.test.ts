/**
 * Integration-hardening contract tests.
 *
 * Locks the behaviour added when closing the Loki ↔ OrangeCat gaps:
 *   1. `payment.settled` is a real, advertised webhook event and its payload
 *      shape matches what the fan-out emits.
 *   2. The public v1 `search` + `demand` endpoints are discoverable.
 *   4. `parseSupporterPass` (previously untested) honours its tag contract.
 */
import {
  PUBLIC_API_WEBHOOK_EVENTS,
  PUBLIC_API_ECONOMIC_WEBHOOK_EVENTS,
  PUBLIC_API_INTEGRATION_ENDPOINTS,
} from '@/config/public-api';
import {
  PAYMENT_SETTLED_EVENT,
  buildPaymentSettledPayload,
} from '@/services/webhooks/paymentSettledWebhook';
import { parseSupporterPass } from '@/services/supporter/grant';
import type { PaymentIntent } from '@/domain/payments/types';

describe('payment.settled webhook event (gap 1)', () => {
  it('is advertised in the public webhook event registry', () => {
    expect(PUBLIC_API_WEBHOOK_EVENTS).toContain('payment.settled');
    expect(PUBLIC_API_ECONOMIC_WEBHOOK_EVENTS).toContain('payment.settled');
  });

  it('the emitter constant matches the advertised event name', () => {
    expect(PUBLIC_API_WEBHOOK_EVENTS).toContain(PAYMENT_SETTLED_EVENT);
  });

  it('does not clobber the entity.created events', () => {
    expect(PUBLIC_API_WEBHOOK_EVENTS).toContain('product.created');
    expect(PUBLIC_API_WEBHOOK_EVENTS).toContain('project.created');
  });

  it('builds a payload with the settlement fields integrators need', () => {
    const pi = {
      id: 'pi_123',
      seller_id: 'user_seller',
      buyer_id: 'user_buyer',
      entity_type: 'product',
      entity_id: 'ent_1',
      amount_btc: 0.0005,
      intent_kind: 'purchase',
      description: 'Widget',
    } as unknown as PaymentIntent;

    expect(buildPaymentSettledPayload(pi)).toEqual({
      type: 'payment.settled',
      intentKind: 'purchase',
      entityType: 'product',
      entityId: 'ent_1',
      amountBtc: '0.0005',
      title: 'Widget',
      externalId: 'pi_123',
    });
  });

  it('coerces a missing amount to an empty string, never null/NaN', () => {
    const pi = {
      id: 'pi_x',
      seller_id: 's',
      entity_type: 'project',
      entity_id: 'e',
      amount_btc: null,
      intent_kind: 'support',
      description: null,
    } as unknown as PaymentIntent;
    const payload = buildPaymentSettledPayload(pi);
    expect(payload.amountBtc).toBe('');
    expect(payload.title).toBeUndefined();
  });
});

describe('v1 search + demand discoverability (gap 2)', () => {
  const names = PUBLIC_API_INTEGRATION_ENDPOINTS.map(e => e.name);

  it('advertises search and demand alongside the existing endpoints', () => {
    expect(names).toEqual(
      expect.arrayContaining(['search', 'demand', 'timeline.publish', 'stakeholders'])
    );
  });

  it('points them at the real v1 routes as GET', () => {
    const search = PUBLIC_API_INTEGRATION_ENDPOINTS.find(e => e.name === 'search');
    const demand = PUBLIC_API_INTEGRATION_ENDPOINTS.find(e => e.name === 'demand');
    expect(search).toMatchObject({ endpoint: '/api/v1/search', methods: ['GET'] });
    expect(demand).toMatchObject({ endpoint: '/api/v1/demand', methods: ['GET'] });
  });
});

describe('parseSupporterPass tag contract (gap 4)', () => {
  it('parses a well-formed supporter pass', () => {
    expect(parseSupporterPass(['supporter-plan', 'supporter-days:30'])).toEqual({ days: 30 });
  });

  it('ignores tag order and unrelated tags', () => {
    expect(parseSupporterPass(['x', 'supporter-days:90', 'y', 'supporter-plan'])).toEqual({
      days: 90,
    });
  });

  it('requires BOTH the marker and a day count', () => {
    expect(parseSupporterPass(['supporter-plan'])).toBeNull();
    expect(parseSupporterPass(['supporter-days:30'])).toBeNull();
  });

  it('rejects non-array and non-string entries', () => {
    expect(parseSupporterPass(null)).toBeNull();
    expect(parseSupporterPass('supporter-plan')).toBeNull();
    expect(parseSupporterPass([123, { supporter: true }])).toBeNull();
  });

  it('rejects zero days and out-of-range day formats', () => {
    expect(parseSupporterPass(['supporter-plan', 'supporter-days:0'])).toBeNull();
    expect(parseSupporterPass(['supporter-plan', 'supporter-days:12345'])).toBeNull();
    expect(parseSupporterPass(['supporter-plan', 'supporter-days:abc'])).toBeNull();
  });
});
