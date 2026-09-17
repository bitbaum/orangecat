'use client';

import { useMemo, useState } from 'react';
import type { LoanOffer } from '@/types/loans';
import loansService from '@/services/loans';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { STATUS } from '@/config/database-constants';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IncomingLoanOfferCard } from './IncomingLoanOfferCard';
import {
  AcceptLoanOfferDialog,
  acceptOfferSchema,
  type AcceptOfferForm,
} from './AcceptLoanOfferDialog';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface IncomingLoanOffersListProps {
  offers: LoanOffer[];
  borrowerId: string;
  onOfferUpdated?: () => void;
}

export function IncomingLoanOffersList({
  offers,
  borrowerId,
  onOfferUpdated,
}: IncomingLoanOffersListProps) {
  const [activeOffer, setActiveOffer] = useState<LoanOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pendingOffers = useMemo(
    () => offers.filter(offer => offer.status === STATUS.LOAN_OFFERS.PENDING),
    [offers]
  );

  const form = useForm<AcceptOfferForm>({
    resolver: zodResolver(acceptOfferSchema),
    defaultValues: {
      payment_method: 'bank_transfer',
      transaction_id: '',
      notes: '',
    },
  });

  const handleReject = async (offer: LoanOffer) => {
    setSubmitting(true);
    try {
      const result = await loansService.respondToOffer(offer.id, false);
      if (!result.success) {
        toast.error(apiErrorMessage(result, 'Failed to reject offer'));
        return;
      }
      toast.success('Offer rejected');
      onOfferUpdated?.();
    } catch (error) {
      logger.error('Failed to reject loan offer', error, 'IncomingLoanOffers');
      toast.error('Failed to reject offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async (values: AcceptOfferForm) => {
    if (!activeOffer) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await loansService.acceptOfferAndSettle({
        offer: activeOffer,
        borrowerId,
        paymentMethod: values.payment_method,
        transactionId: values.transaction_id || undefined,
        notes: values.notes || undefined,
      });

      if (!result.success) {
        toast.error(apiErrorMessage(result, 'Failed to accept offer'));
        if (result.mutated) {
          onOfferUpdated?.();
        }
        return;
      }

      toast.success(
        result.refinanced
          ? 'Offer accepted and refinance handoff completed'
          : 'Offer accepted and payoff recorded'
      );
      form.reset();
      setActiveOffer(null);
      onOfferUpdated?.();
    } catch (error) {
      logger.error('Failed to accept loan offer', error, 'IncomingLoanOffers');
      toast.error('Failed to accept offer');
    } finally {
      setSubmitting(false);
    }
  };

  if (offers.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-fg-primary">Incoming Offers</h3>
          <p className="text-sm text-fg-secondary">
            Review lender proposals on your loans and complete the payoff/refinance handoff.
          </p>
        </div>

        <div className="space-y-4">
          {offers.map(offer => (
            <IncomingLoanOfferCard
              key={offer.id}
              offer={offer}
              submitting={submitting}
              onReject={handleReject}
              onAccept={setActiveOffer}
            />
          ))}
        </div>

        {pendingOffers.length === 0 && (
          <p className="text-sm text-fg-secondary">All current offers have been processed.</p>
        )}
      </div>

      <AcceptLoanOfferDialog
        open={Boolean(activeOffer)}
        onClose={() => setActiveOffer(null)}
        form={form}
        onSubmit={handleAccept}
        submitting={submitting}
      />
    </>
  );
}
