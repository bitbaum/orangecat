/**
 * Loan offer contract SSOT — refinance and payoff offers.
 *
 * Created: 2026-07-09
 * Last Modified: 2026-07-09
 * Last Modified Summary: Initial schema set for /api/loans/offers routes.
 */

import { z } from 'zod';
import { STATUS } from '@/config/database-constants';

export const LOAN_OFFER_TYPES = ['refinance', 'payoff'] as const;

export const createLoanOfferSchema = z
  .object({
    loan_id: z.string().guid('loan_id must be a UUID'),
    offer_type: z.enum(LOAN_OFFER_TYPES),
    offer_amount: z.number().positive('offer_amount must be greater than 0'),
    interest_rate: z.number().min(0).max(100).optional(),
    term_months: z.number().int().min(1).max(360).optional(),
    terms: z.string().max(2000).optional(),
    conditions: z.string().max(1000).optional(),
    is_binding: z.boolean().optional(),
  })
  .refine(
    data => data.offer_type === 'payoff' || (data.interest_rate !== undefined && data.term_months),
    {
      message: 'Refinance offers require interest_rate and term_months',
      path: ['interest_rate'],
    }
  );

export const updateLoanOfferSchema = z.object({
  status: z.enum([
    STATUS.LOAN_OFFERS.PENDING,
    STATUS.LOAN_OFFERS.ACCEPTED,
    STATUS.LOAN_OFFERS.REJECTED,
    STATUS.LOAN_OFFERS.EXPIRED,
    STATUS.LOAN_OFFERS.CANCELLED,
  ]),
});

export const respondToLoanOfferSchema = z.object({
  accept: z.boolean(),
  notes: z.string().max(1000).optional(),
});
