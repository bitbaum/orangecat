import { Percent, TrendingUp, TrendingDown, User, MessageSquare } from 'lucide-react';
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
import { LOAN_TYPES, LOAN_CATEGORIES } from '@/config/loans';
import { DAY_FIRST_LOCALE } from '@/utils/locale';

const labelFor = (
  options: ReadonlyArray<{ value: string; label: string }>,
  value: unknown
): string | null => options.find(o => o.value === value)?.label ?? null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * These date columns are `optionalText` in the schema, not timestamps, so the
 * stored value is whatever the form wrote. Render it as a date only when it
 * genuinely parses, and fall back to the raw string rather than printing
 * "Invalid Date" over the user's own input.
 *
 * Fixed to UTC on purpose: this renders on the server, which cannot know the
 * reader's timezone, and an unpinned format shifts a maturity date by a day
 * depending on where it happens to run.
 */
const formatLoanDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }
  return parsed.toLocaleDateString(DAY_FIRST_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

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
    href: `${ROUTES.AUTH}?mode=login&from=${ROUTES.LOANS.VIEW(entity.id)}`,
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
    // `current_lender` is what the create form writes; `lender_name` is what a
    // lender-created obligation writes (src/domain/loans/obligation.ts). Both are
    // real columns, so the page has to read both or it silently drops one path.
    const currentLender = entity.current_lender || entity.lender_name || null;
    const currentRate = entity.current_interest_rate;
    const desiredRate = entity.desired_rate;
    // Show the refinance terms whenever they exist, not only when loan_type says
    // so — a listing with the numbers filled in must never render as if empty.
    const showRefinance =
      entity.loan_type === 'existing_refinance' || isNumber(currentRate) || isNumber(desiredRate);
    const originationDate = formatLoanDate(entity.origination_date);
    const maturityDate = formatLoanDate(entity.maturity_date);
    const loanNumber =
      typeof entity.loan_number === 'string' && entity.loan_number.trim()
        ? entity.loan_number.trim()
        : null;
    const rateReduction =
      isNumber(currentRate) && isNumber(desiredRate) && currentRate > desiredRate
        ? currentRate - desiredRate
        : null;
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

            {currentLender && (
              <div className="flex items-start gap-2 border-t pt-4 text-sm text-fg-secondary dark:border-default">
                <User className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 break-words">Current Lender: {currentLender}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {showRefinance && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Refinancing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-surface-raised p-4">
                  <div className="mb-1 flex items-center gap-2 text-sm text-fg-secondary">
                    <Percent className="h-4 w-4" />
                    Current Rate
                  </div>
                  <div className="break-words text-lg font-semibold">
                    {isNumber(currentRate) ? `${currentRate}% APR` : 'Not stated'}
                  </div>
                </div>
                <div className="rounded-lg bg-surface-raised p-4">
                  <div className="mb-1 flex items-center gap-2 text-sm text-fg-secondary">
                    <TrendingDown className="h-4 w-4" />
                    Desired Rate
                  </div>
                  <div className="break-words text-lg font-semibold">
                    {isNumber(desiredRate) ? `${desiredRate}% APR` : 'Not stated'}
                  </div>
                </div>
              </div>
              {rateReduction !== null && (
                <p className="text-sm text-fg-secondary">
                  Seeking a {rateReduction.toFixed(1)} percentage point reduction on the current
                  rate.
                </p>
              )}
            </CardContent>
          </Card>
        )}

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

        {/* When the loan starts, when it comes due, and the lender's reference
            for it — collected on existing-loan listings and rendered nowhere, so
            a listing could not answer "how long is left on this?". */}
        {(originationDate || maturityDate || loanNumber) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Loan Term</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {originationDate && (
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-fg-secondary">Originated</span>
                  <span className="font-medium sm:text-right">{originationDate}</span>
                </div>
              )}
              {maturityDate && (
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-fg-secondary">Matures</span>
                  <span className="font-medium sm:text-right">{maturityDate}</span>
                </div>
              )}
              {loanNumber && (
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-fg-secondary">Loan number</span>
                  <span className="break-all font-medium sm:text-right">{loanNumber}</span>
                </div>
              )}
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
            <Badge variant="secondary">
              {labelFor(LOAN_TYPES, entity.loan_type) ?? 'Request New Loan'}
            </Badge>
          </div>
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-fg-secondary">Category</span>
            <Badge variant="secondary" className="capitalize">
              {labelFor(LOAN_CATEGORIES, entity.loan_category_id) ??
                entity.loan_category_id ??
                'General'}
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
        href={`${ROUTES.AUTH}?mode=login&from=${ROUTES.LOANS.VIEW(entity.id)}`}
        icon={MessageSquare}
        label="Contact Lister"
        description="Sign in to contact the loan lister or make an offer"
      />
    </>
  ),
};
