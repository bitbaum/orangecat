/**
 * Obligation loan contract SSOT — post-payoff / refinance new loan creation.
 *
 * Created when a borrower accepts a refinance offer and payment completes.
 * See docs/development/loans-flow.md ("New obligation (refinance path)").
 *
 * Created: 2026-07-09
 * Last Modified: 2026-07-09
 * Last Modified Summary: Initial schema for POST /api/loans/obligation.
 */

import { z } from 'zod';

export const obligationOfferSchema = z.object({
  loan_id: z.string().guid('loan_id must be a UUID'),
  offer_amount: z.number().positive('offer_amount must be greater than 0'),
  interest_rate: z.number().min(0).max(100).optional(),
  term_months: z.number().int().positive().optional(),
  currency: z.string().optional(),
});

export const createObligationLoanSchema = z.object({
  borrowerId: z.string().guid('borrowerId must be a UUID'),
  lenderProfileName: z.string().min(1).max(200),
  offer: obligationOfferSchema,
});

export type CreateObligationLoanInput = z.infer<typeof createObligationLoanSchema>;

/** Fixed copy for obligation loans — satisfies loan description min length. */
export const OBLIGATION_LOAN_TITLE = 'Refinanced Loan';
export const OBLIGATION_LOAN_DESCRIPTION = 'Refinanced via OrangeCat offer';
