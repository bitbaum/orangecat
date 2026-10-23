import { z } from 'zod';

// Mirror the API schema to ensure constraints stay consistent
const TransactionSchema = z.object({
  projectId: z.string().min(1).max(64),
  amount_sats: z.number().int().positive().max(1_000_000_000_000),
  payment_method: z.enum(['lightning', 'on-chain']),
  message: z.string().max(200).optional().nullable(),
});

describe('TransactionSchema', () => {
  it('accepts valid payload', () => {
    const result = TransactionSchema.safeParse({
      projectId: 'proj_123',
      amount_sats: 1000,
      payment_method: 'lightning',
      message: 'Great project!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid payloads', () => {
    expect(
      TransactionSchema.safeParse({ projectId: '', amount_sats: -1, payment_method: 'x' }).success
    ).toBe(false);
    expect(
      TransactionSchema.safeParse({ projectId: 'p', amount_sats: 0, payment_method: 'on-chain' })
        .success
    ).toBe(false);
  });
});
