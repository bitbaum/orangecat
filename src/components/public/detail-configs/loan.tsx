import { Percent, TrendingUp, User, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatRelativeTime } from '@/utils/dates';
import { formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import PublicEntityCTA from '@/components/public/PublicEntityCTA';
import { ROUTES } from '@/config/routes';
import type { EntityDetailConfig, EntityData } from '@/components/public/PublicEntityDetailPage';
import { calculateProgress } from '@/lib/loans/progress';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

/**
 * Loan detail config (SSOT) — shared by the public route (/loans/[id]) and the
 * owner dashboard route (/dashboard/loans/[id]).
 */
export const loanDetailConfig: EntityDetailConfig = {
  entityType: 'loan',
  ownerLabel: 'Listed By',
  descriptionTitle: 'About this Loan',
  visibilityFilter: { column: 'is_public', value: true },
  getViewRoute: id => ROUTES.LOANS.VIEW(id),
  showPaymentSection: false,
  mobileStickyCTA: (entity: EntityData) => ({
    label: 'Contact lister',
    href: authLoginPath(ROUTES.LOANS.VIEW(entity.id)),
  }),
  getJsonLdExtra: (entity: EntityData) => ({
    amount: {
      '@type': 'MonetaryAmount',
      value: entity.original_amount,
      currency: entity.currency || 'BTC',
    },
    ...(entity.interest_rate !== null &&
      entity.interest_rate !== undefined && { annualPercentageRate: entity.interest_rate }),
  }),
  renderHeaderExtra: (entity: EntityData) => (
    <span className="text-fg-secondary text-sm">
      Listed {formatRelativeTime(entity.created_at)}
    </span>
  ),
  renderDetails: (entity: EntityData) => {
    const progress = calculateProgress(entity.original_amount, entity.remaining_balance);
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-fg-secondary">Remaining Balance</span>
                <span className="break-words text-xl font-bold text-fg-primary sm:text-right">
                  {formatCurrency(
                    entity.remaining_balance,
                    entity.currency ?? PLATFORM_DEFAULT_CURRENCY
                  )}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex flex-col gap-1 text-xs text-fg-secondary sm:flex-row sm:justify-between">
                <span>{progress.toFixed(1)}% funded</span>
                <span className="break-words sm:text-right">
                  Original:{' '}
                  {formatCurrency(
                    entity.original_amount,
                    entity.currency ?? PLATFORM_DEFAULT_CURRENCY
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {entity.interest_rate !== null && entity.interest_rate !== undefined && (
                <div className="p-4 bg-surface-raised rounded-lg">
                  <div className="flex items-center gap-2 text-fg-secondary text-sm mb-1">
                    <Percent className="w-4 h-4" />
                    Interest Rate
                  </div>
                  <div className="break-words text-lg font-semibold">
                    {entity.interest_rate}% APR
                  </div>
                </div>
              )}
              {entity.monthly_payment && (
                <div className="p-4 bg-surface-raised rounded-lg">
                  <div className="flex items-center gap-2 text-fg-secondary text-sm mb-1">
                    <TrendingUp className="w-4 h-4" />
                    Monthly Payment
                  </div>
                  <div className="break-words text-lg font-semibold">
                    {formatCurrency(
                      entity.monthly_payment,
                      entity.currency ?? PLATFORM_DEFAULT_CURRENCY
                    )}
                  </div>
                </div>
              )}
            </div>

            {entity.lender_name && (
              <div className="flex items-start gap-2 border-t pt-4 text-sm text-fg-secondary dark:border-default">
                <User className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 break-words">Current Lender: {entity.lender_name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {entity.preferred_terms && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preferred Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-fg-primary whitespace-pre-wrap">{entity.preferred_terms}</p>
            </CardContent>
          </Card>
        )}
      </>
    );
  },
  renderSidebarExtra: (entity: EntityData) => (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-fg-secondary">Loan Type</span>
            <Badge variant="secondary" className="capitalize">
              {entity.loan_category_id || 'General'}
            </Badge>
          </div>
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-fg-secondary">Negotiable</span>
            <span className="font-medium">{entity.is_negotiable ? 'Yes' : 'No'}</span>
          </div>
          {entity.minimum_offer_amount && (
            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-fg-secondary">Min Offer</span>
              <span className="break-words font-medium sm:text-right">
                {formatCurrency(
                  entity.minimum_offer_amount,
                  entity.currency ?? PLATFORM_DEFAULT_CURRENCY
                )}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-fg-secondary">Contact Method</span>
            <span className="break-words font-medium capitalize sm:text-right">
              {entity.contact_method || 'Platform'}
            </span>
          </div>
        </CardContent>
      </Card>

      <PublicEntityCTA
        href={authLoginPath(ROUTES.LOANS.VIEW(entity.id))}
        icon={MessageSquare}
        label="Contact Lister"
        description="Sign in to contact the loan lister or make an offer"
      />
    </>
  ),
};
