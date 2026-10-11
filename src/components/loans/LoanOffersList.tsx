'use client';

import { LoanOffer } from '@/types/loans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { ROUTES } from '@/config/routes';
import { Target, TrendingUp, Edit, MessageSquare } from 'lucide-react';
import { STATUS } from '@/config/database-constants';
import { formatRelativeTime } from '@/utils/dates';
import { getLoanOfferStatusColor, getLoanOfferStatusIcon } from '@/config/loans';
import { formatLoanAmount } from './useLoanList';

interface LoanOffersListProps {
  offers: LoanOffer[];
  onOfferUpdated?: () => void;
}

export function LoanOffersList({ offers, onOfferUpdated: _onOfferUpdated }: LoanOffersListProps) {
  if (offers.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No offers yet"
        description="Offers you make on community loans will appear here."
        action={
          <Button href={ROUTES.DISCOVER_TYPE('loans')} variant="outline">
            Browse loans
          </Button>
        }
        className="py-8"
      />
    );
  }

  return (
    <div className="space-y-4">
      {offers.map(offer => {
        const StatusIcon = getLoanOfferStatusIcon(offer.status);
        return (
          <Card key={offer.id} className="oc-card-link">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <CardTitle className="text-lg">
                      {offer.offer_type === 'refinance' ? 'Refinance Offer' : 'Payoff Offer'}
                    </CardTitle>
                    <Badge className={`${getLoanOfferStatusColor(offer.status)} gap-1`}>
                      <StatusIcon className="h-4 w-4" />
                      {offer.status}
                    </Badge>
                  </div>
                  <CardDescription>Made {formatRelativeTime(offer.created_at)}</CardDescription>
                </div>
                <div className="flex gap-1 self-start">
                  {offer.status === STATUS.LOAN_OFFERS.PENDING && (
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Offer Details */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-fg-secondary">Offer Amount</p>
                  <p className="text-lg font-semibold text-status-positive">
                    {formatLoanAmount(offer.offer_amount)}
                  </p>
                </div>

                {offer.interest_rate && (
                  <div className="space-y-1">
                    <p className="text-sm text-fg-secondary">Interest Rate</p>
                    <p className="text-lg font-semibold">{offer.interest_rate}%</p>
                  </div>
                )}

                {offer.term_months && (
                  <div className="space-y-1">
                    <p className="text-sm text-fg-secondary">Term</p>
                    <p className="text-lg font-semibold">{offer.term_months} months</p>
                  </div>
                )}

                {offer.monthly_payment && (
                  <div className="space-y-1">
                    <p className="text-sm text-fg-secondary">Monthly Payment</p>
                    <p className="text-lg font-semibold">
                      {formatLoanAmount(offer.monthly_payment)}
                    </p>
                  </div>
                )}
              </div>

              {/* Terms */}
              {offer.terms && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Terms & Conditions</p>
                  <p className="rounded bg-surface-raised p-3 text-sm text-fg-secondary">
                    {offer.terms}
                  </p>
                </div>
              )}

              {/* Status-specific info */}
              <div className="flex flex-col gap-3 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-fg-secondary">
                  {offer.status === STATUS.LOAN_OFFERS.PENDING && offer.expires_at && (
                    <span>Expires {formatRelativeTime(offer.expires_at)}</span>
                  )}
                  {offer.status === STATUS.LOAN_OFFERS.ACCEPTED && offer.accepted_at && (
                    <span>Accepted {formatRelativeTime(offer.accepted_at)}</span>
                  )}
                  {offer.status === STATUS.LOAN_OFFERS.REJECTED && offer.rejected_at && (
                    <span>Rejected {formatRelativeTime(offer.rejected_at)}</span>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {offer.status === STATUS.LOAN_OFFERS.PENDING && (
                    <>
                      <Button variant="outline" size="sm" className="w-full gap-1 sm:w-auto">
                        <MessageSquare className="h-3 w-3" />
                        Message
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-status-negative hover:text-status-negative/80 sm:w-auto"
                      >
                        Cancel Offer
                      </Button>
                    </>
                  )}
                  {offer.status === STATUS.LOAN_OFFERS.ACCEPTED && (
                    <Button variant="outline" size="sm" className="w-full gap-1 sm:w-auto">
                      <TrendingUp className="h-3 w-3" />
                      View Agreement
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
