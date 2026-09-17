/**
 * Loan payment contract SSOT — payoff / refinance payment records.
 *
 * Created: 2026-07-09
 * Last Modified: 2026-07-09
 * Last Modified Summary: Initial schema for /api/loans/payments routes.
 */

import { z } from 'zod';
import { CURRENCY_CODES } from '@/config/currencies';

/** Mirrors loan_payments.payment_type CHECK constraint. */
export const LOAN_PAYMENT_TYPES = ['monthly', 'lump_sum', 'refinance', 'payoff'] as const;
export type LoanPaymentType = (typeof LOAN_PAYMENT_TYPES)[number];

/** Mirrors loan_payments.payment_method CHECK constraint. */
export const LOAN_PAYMENT_METHODS = [
  'bitcoin',
  'lightning',
  'bank_transfer',
  'card',
  'other',
] as const;
export type LoanPaymentMethod = (typeof LOAN_PAYMENT_METHODS)[number];

/** Display labels for payment methods (UI dropdowns). Bitcoin-native ordering. */
export const LOAN_PAYMENT_METHOD_LABELS: Record<LoanPaymentMethod, string> = {
  bitcoin: 'Bitcoin',
  lightning: 'Lightning',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  other: 'Other',
};

export const createLoanPaymentSchema = z.object({
  loan_id: z.string().guid('loan_id must be a UUID'),
  offer_id: z.string().guid().optional(),
  amount: z.number().positive('amount must be greater than 0'),
  currency: z.enum(CURRENCY_CODES),
  payment_type: z.enum(LOAN_PAYMENT_TYPES),
  payer_id: z.string().guid().optional(),
  recipient_id: z.string().guid('recipient_id must be a UUID'),
  transaction_id: z.string().max(200).optional(),
  payment_method: z.enum(LOAN_PAYMENT_METHODS).optional(),
  notes: z.string().max(500).optional(),
});

export type CreateLoanPaymentBody = z.infer<typeof createLoanPaymentSchema>;

/** Optional obligation creation after refinance payment completion. */
export const completeLoanPaymentSchema = z.object({
  createObligation: z
    .object({
      lenderProfileName: z.string().min(1).max(200),
    })
    .optional(),
});

export type CompleteLoanPaymentBody = z.infer<typeof completeLoanPaymentSchema>;
