/**
 * #1677 review: a sale, rent or deposit amount kept in BTC that rounds to
 * 0.00000000 BTC is refused, not stored as nothing.
 */
import { assetSchema } from '@/lib/validation/finance';

const base = { title: 'Cargo bike', type: 'vehicle' };

describe('asset amounts kept in BTC', () => {
  it.each(['sale_price_btc', 'rental_price_btc', 'deposit_amount_btc'])(
    '%s refuses an amount that rounds to zero and keeps one that does not',
    field => {
      expect(assetSchema.safeParse({ ...base, [field]: 0.000000004 }).success).toBe(false);
      expect(assetSchema.safeParse({ ...base, [field]: 0.00000001 }).success).toBe(true);
    }
  );
});
