/**
 * Obligation loan schema + domain
 */

import { createObligationLoanSchema } from '@/config/loan-obligation';
import { createObligationLoan } from '@/domain/loans/obligation';

vi.mock('@/domain/base/entityService', () => ({
  createEntity: vi.fn().mockResolvedValue({ id: 'new-loan-id', status: 'active' }),
}));

describe('createObligationLoanSchema', () => {
  it('requires borrowerId, lender name, and a single offer payload', () => {
    const parsed = createObligationLoanSchema.safeParse({
      borrowerId: '00000000-0000-4000-8000-000000000001',
      lenderProfileName: 'Alice Lender',
      offer: {
        loan_id: '00000000-0000-4000-8000-000000000002',
        offer_amount: 2500,
        interest_rate: 4.5,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects non-positive offer amounts', () => {
    const parsed = createObligationLoanSchema.safeParse({
      borrowerId: '00000000-0000-4000-8000-000000000001',
      lenderProfileName: 'Alice',
      offer: {
        loan_id: '00000000-0000-4000-8000-000000000002',
        offer_amount: 0,
      },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('createObligationLoan domain', () => {
  const borrowerId = '00000000-0000-4000-8000-000000000099';
  const sourceLoanId = '00000000-0000-4000-8000-000000000088';

  function mockSupabase(sourceUserId: string | null) {
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: sourceUserId ? { id: sourceLoanId, user_id: sourceUserId } : null,
              error: null,
            }),
          }),
        }),
      }),
    };
  }

  it('creates an active obligation when the borrower owns the source loan', async () => {
    const supabase = mockSupabase(borrowerId);
    const result = await createObligationLoan(
      borrowerId,
      {
        lenderProfileName: 'Bob Bank',
        offer: { loan_id: sourceLoanId, offer_amount: 1200, currency: 'CHF' },
      },
      supabase as never
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.loan.id).toBe('new-loan-id');
    }
  });

  it('forbids obligation creation for a loan owned by another user', async () => {
    const supabase = mockSupabase('00000000-0000-4000-8000-000000000001');
    const result = await createObligationLoan(
      borrowerId,
      {
        lenderProfileName: 'Bob Bank',
        offer: { loan_id: sourceLoanId, offer_amount: 1200 },
      },
      supabase as never
    );

    expect(result).toEqual({
      ok: false,
      reason: 'forbidden',
      message: 'You can only create obligations for your own loans',
    });
  });
});
