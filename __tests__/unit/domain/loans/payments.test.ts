/**
 * Loan payment schema + domain
 */

import { createLoanPaymentSchema } from '@/config/loan-payments';
import { createLoanPayment, completeLoanPayment } from '@/domain/loans/payments';
import { STATUS } from '@/config/database-constants';

vi.mock('@/domain/loans/obligation', () => ({
  createObligationLoan: vi.fn().mockResolvedValue({
    ok: true,
    loan: { id: 'obligation-loan-id', status: 'active' },
  }),
}));

describe('createLoanPaymentSchema', () => {
  it('accepts a valid payoff payload', () => {
    const parsed = createLoanPaymentSchema.safeParse({
      loan_id: '00000000-0000-4000-8000-000000000001',
      amount: 500,
      currency: 'CHF',
      payment_type: 'payoff',
      recipient_id: '00000000-0000-4000-8000-000000000002',
      payment_method: 'lightning',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('createLoanPayment domain', () => {
  const payerId = '00000000-0000-4000-8000-000000000099';
  const recipientId = '00000000-0000-4000-8000-000000000088';
  const loanId = '00000000-0000-4000-8000-000000000077';

  function mockSupabaseForCreate() {
    const paymentRow = {
      id: 'payment-1',
      status: STATUS.LOAN_PAYMENTS.PENDING,
      payer_id: payerId,
      recipient_id: recipientId,
    };
    return {
      from: vi.fn((table: string) => {
        if (table === 'loans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: loanId }, error: null }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: paymentRow, error: null }),
            }),
          }),
        };
      }),
    };
  }

  it('creates a pending payment for the authenticated payer', async () => {
    const result = await createLoanPayment(
      payerId,
      {
        loan_id: loanId,
        amount: 1000,
        currency: 'CHF',
        payment_type: 'payoff',
        recipient_id: recipientId,
      },
      mockSupabaseForCreate() as never
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payment.id).toBe('payment-1');
    }
  });

  it('rejects self-payments', async () => {
    const result = await createLoanPayment(
      payerId,
      {
        loan_id: loanId,
        amount: 1000,
        currency: 'CHF',
        payment_type: 'payoff',
        recipient_id: payerId,
      },
      mockSupabaseForCreate() as never
    );

    expect(result).toEqual({
      ok: false,
      reason: 'forbidden',
      message: 'Payer and recipient must be different users',
    });
  });

  it('allows the recipient to record a pending payment with an explicit payer', async () => {
    const result = await createLoanPayment(
      recipientId,
      {
        loan_id: loanId,
        amount: 1000,
        currency: 'CHF',
        payment_type: 'payoff',
        payer_id: payerId,
        recipient_id: recipientId,
      },
      mockSupabaseForCreate() as never
    );

    expect(result.ok).toBe(true);
  });
});

describe('completeLoanPayment domain', () => {
  const userId = '00000000-0000-4000-8000-000000000088';

  it('forbids users who are not payment parties', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'payment-1',
                payer_id: 'other-payer',
                recipient_id: 'other-recipient',
                status: STATUS.LOAN_PAYMENTS.PENDING,
                payment_type: 'payoff',
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const result = await completeLoanPayment(userId, 'payment-1', {}, supabase as never);
    expect(result).toEqual({
      ok: false,
      reason: 'forbidden',
      message: 'You are not a party to this payment',
    });
  });
});
