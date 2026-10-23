import { z } from 'zod';

const AssetSchema = z.object({
  title: z.string().min(3).max(100),
  type: z.enum(['real_estate', 'business', 'vehicle', 'equipment', 'securities', 'other']),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  estimated_value: z.number().positive().optional().nullable(),
  currency: z.string().min(3).max(6).default('USD'),
  documents: z.array(z.string().url()).optional().nullable(),
});

describe('AssetSchema', () => {
  it('accepts valid payload', () => {
    const result = AssetSchema.safeParse({
      title: '123 Main St Apartment',
      type: 'real_estate',
      description: 'Good location',
      location: 'Zurich, CH',
      estimated_value: 250000,
      currency: 'CHF',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid title and type', () => {
    expect(AssetSchema.safeParse({ title: 'a', type: 'x' }).success).toBe(false);
  });
});
