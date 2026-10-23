import { z } from 'zod';

const CollateralSchema = z.object({
  loan_id: z.string().min(1),
  asset_id: z.string().min(1),
  pledged_value: z.number().positive().optional().nullable(),
  currency: z.string().min(3).max(6).optional().default('USD'),
});

describe('CollateralSchema', () => {
  it('accepts minimal valid payload', () => {
    const result = CollateralSchema.safeParse({ loan_id: 'l1', asset_id: 'a1' });
    expect(result.success).toBe(true);
  });
  it('rejects invalid values', () => {
    expect(CollateralSchema.safeParse({ loan_id: '', asset_id: '' }).success).toBe(false);
    expect(
      CollateralSchema.safeParse({ loan_id: 'l', asset_id: 'a', pledged_value: -5 }).success
    ).toBe(false);
  });
});
