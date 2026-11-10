/**
 * Cat's create_service used to insert no category (NOT NULL → 400) and a
 * price in CHF as BTC (QA 2026-11-10: "hourly rate 30 CHF").
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/currency/profileCurrency', () => ({
  getProfileCurrency: async () => 'CHF',
  isCurrencyCode: (v: unknown) => ['USD', 'EUR', 'CHF', 'GBP', 'BTC'].includes(v as string),
}));

import { entityCreateHandlers } from '@/services/cat/handlers/entities-create';

function fakeSupabase() {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return {
          select: () => ({ single: async () => ({ data: { id: 's1', ...row }, error: null }) }),
        };
      },
    }),
  };
  return { client, inserted };
}

describe('create_service', () => {
  it('files it under a category and keeps the price in the currency the user said', async () => {
    const { client, inserted } = fakeSupabase();
    const res = await entityCreateHandlers.create_service(client as never, 'u1', 'a1', {
      title: 'QA confirm service',
      description: 'QA test',
      hourly_rate: 30,
      currency: 'CHF',
    });
    expect(res.success).toBe(true);
    expect(inserted[0]).toMatchObject({
      category: 'Other',
      hourly_rate: 30,
      currency: 'CHF',
      description: 'QA test',
      status: 'draft',
    });
  });

  it("uses a named category and the user's currency when none is given", async () => {
    const { client, inserted } = fakeSupabase();
    await entityCreateHandlers.create_service(client as never, 'u1', 'a1', {
      title: 'Tutoring',
      category: 'teaching & tutoring',
      fixed_price: 40,
    });
    expect(inserted[0]).toMatchObject({
      category: 'Teaching & Tutoring',
      fixed_price: 40,
      currency: 'CHF',
    });
  });
});
