'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY, CURRENCY_CODES } from '@/config/currencies';
import type { CurrencyCode } from '@/config/currencies';
import loansService from '@/services/loans';
import { Loan, CreateLoanOfferRequest } from '@/types/loans';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export const offerSchema = z
  .object({
    offer_type: z.enum(['refinance', 'payoff']),
    offer_amount: z.number().min(0.01, 'Offer amount must be greater than 0'),
    interest_rate: z.number().min(0).max(100).optional(),
    term_months: z.number().min(1).max(360).optional(),
    terms: z.string().optional(),
    conditions: z.string().optional(),
  })
  .refine(
    data => {
      if (data.offer_type === 'refinance') {
        return data.interest_rate !== undefined && data.term_months !== undefined;
      }
      return true;
    },
    {
      message: 'Refinance offers require interest rate and term',
      path: ['interest_rate'],
    }
  );

export type OfferFormData = z.infer<typeof offerSchema>;

export function useMakeOfferForm(
  loan: Loan,
  onOpenChange: (open: boolean) => void,
  onOfferSubmitted: () => void
) {
  const [loading, setLoading] = useState(false);

  const form = useForm<OfferFormData>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      offer_type: 'refinance',
      offer_amount: Math.min(loan.remaining_balance * 0.9, loan.remaining_balance),
      interest_rate: loan.interest_rate ? Math.max(0, loan.interest_rate - 2) : 15,
      term_months: 36,
    },
  });

  const watchOfferType = form.watch('offer_type');

  const formatLoanCurrency = (amount: number, currency: string = PLATFORM_DEFAULT_CURRENCY) => {
    const validCurrency = (
      CURRENCY_CODES.includes(currency as CurrencyCode) ? currency : PLATFORM_DEFAULT_CURRENCY
    ) as CurrencyCode;
    return formatCurrency(amount, validCurrency);
  };

  const onSubmit = async (data: OfferFormData) => {
    try {
      setLoading(true);

      const offerData: CreateLoanOfferRequest = {
        loan_id: loan.id,
        offer_type: data.offer_type,
        offer_amount: data.offer_amount,
        interest_rate: data.interest_rate,
        term_months: data.term_months,
        terms: data.terms,
        conditions: data.conditions,
      };

      const result = await loansService.createLoanOffer(offerData);

      if (result.success) {
        toast.success('Offer submitted successfully!');
        onOfferSubmitted();
        form.reset();
      } else {
        toast.error(apiErrorMessage(result, 'Failed to submit offer'));
      }
    } catch (error) {
      logger.error('Failed to submit offer:', error);
      toast.error('Failed to submit offer');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return { form, loading, watchOfferType, formatLoanCurrency, onSubmit, handleOpenChange };
}
