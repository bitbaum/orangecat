/**
 * Loan offer schema + domain
 */

import { createLoanOfferSchema } from '@/config/loan-offers';
import { STATUS } from '@/config/database-constants';
import { createLoanOffer, respondToLoanOffer, updateLoanOffer } from '@/domain/loans/offers';

describe('createLoanOfferSchema', () => {
  it('requires refinance offers to include interest rate and term', () => {
    const parsed = createLoanOfferSchema.safeParse({
      loan_id: '00000000-0000-4000-8000-000000000001',
      offer_type: 'refinance',
      offer_amount: 1500,
    });

    expect(parsed.success).toBe(false);
  });
});

describe('createLoanOffer domain', () => {
  const loanId = '00000000-0000-4000-8000-000000000011';
  const offererId = '00000000-0000-4000-8000-000000000022';
  const ownerId = '00000000-0000-4000-8000-000000000033';

  function createSupabase(minimumOfferAmount: number | null = null) {
    return {
      from: vi.fn((table: string) => {
        if (table === 'loans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: loanId,
                    user_id: ownerId,
                    status: STATUS.LOANS.ACTIVE,
                    minimum_offer_amount: minimumOfferAmount,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'offer-1', loan_id: loanId, offerer_id: offererId },
                error: null,
              }),
            }),
          }),
        };
      }),
    };
  }

  it('creates a valid offer', async () => {
    const result = await createLoanOffer(
      offererId,
      {
        loan_id: loanId,
        offer_type: 'payoff',
        offer_amount: 1200,
      },
      createSupabase() as never
    );

    expect(result.ok).toBe(true);
  });

  it('rejects offers below the loan minimum', async () => {
    const result = await createLoanOffer(
      offererId,
      {
        loan_id: loanId,
        offer_type: 'payoff',
        offer_amount: 400,
      },
      createSupabase(500) as never
    );

    expect(result).toEqual({
      ok: false,
      reason: 'below_minimum',
      message: 'Offer amount below minimum required',
    });
  });
});

describe('updateLoanOffer domain', () => {
  it('returns not_found when the offer does not belong to the caller', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    const result = await updateLoanOffer(
      'user-1',
      'offer-1',
      { status: STATUS.LOAN_OFFERS.CANCELLED },
      supabase as never
    );

    expect(result).toEqual({
      ok: false,
      reason: 'not_found',
      message: 'Offer not found',
    });
  });
});

describe('respondToLoanOffer domain', () => {
  const ownerId = '00000000-0000-4000-8000-000000000044';

  it('rejects responses to non-pending offers', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'loan_offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'offer-2',
                    loan_id: 'loan-2',
                    status: STATUS.LOAN_OFFERS.ACCEPTED,
                    loans: { user_id: ownerId },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return null;
      }),
    };

    const result = await respondToLoanOffer(ownerId, 'offer-2', true, supabase as never);

    expect(result).toEqual({
      ok: false,
      reason: 'invalid_state',
      message: 'Only pending offers can be accepted or rejected',
    });
  });
});
