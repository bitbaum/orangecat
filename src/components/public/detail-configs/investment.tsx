import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import FundingProgress from '@/components/public/FundingProgress';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';
import { INVESTMENT_PUBLIC_STATUSES } from '@/config/investments';
import { formatCurrency } from '@/services/currency';
import {
  INVESTMENT_TYPE_LABELS,
  INVESTMENT_RISK_COLORS,
  RETURN_FREQUENCY_LABELS,
} from '@/config/investments';

// investments carry a `currency` column (today all BTC, but CHF etc. are possible).
// Format amounts in that currency rather than assuming BTC. formatCurrency(x,'BTC')
// renders identically to the old displayBTC, so this is regression-safe + future-proof.
const invFmt = (entity: Record<string, unknown>, amount: unknown) =>
  formatCurrency(Number(amount ?? 0), (entity.currency as string) || 'BTC');

/**
 * Investment detail config (SSOT) — shared by the public route
 * (/investments/[id]) and the owner dashboard route (/dashboard/investments/[id]).
 */
export const investmentDetailConfig: EntityDetailConfig = {
  entityType: 'investment',
  ownerLabel: 'Offered By',
  descriptionTitle: 'About this Investment',
  metadataSelect: 'title, description',
  // Live as open, funded or active — the same set the public list shows.
  visibilityFilter: { column: 'status', value: INVESTMENT_PUBLIC_STATUSES },
  getViewRoute: id => ROUTES.INVESTMENTS.VIEW(id),
  getJsonLdExtra: entity => ({
    ...(entity.target_amount && {
      funding: {
        '@type': 'MonetaryGrant',
        amount: {
          '@type': 'MonetaryAmount',
          value: entity.target_amount,
          currency: (entity.currency as string) || 'BTC',
        },
      },
    }),
  }),
  renderDetails: entity => {
    return (
      <div className="space-y-4">
        <FundingProgress
          raised={Number(entity.total_raised ?? 0)}
          goal={Number(entity.target_amount ?? 0)}
          currency={(entity.currency as string) || 'BTC'}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Investment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entity.investment_type && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-fg-secondary">Type</span>
                <Badge variant="secondary">
                  {INVESTMENT_TYPE_LABELS[entity.investment_type as string] ??
                    entity.investment_type}
                </Badge>
              </div>
            )}
            {entity.risk_level && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-fg-secondary">Risk Level</span>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    INVESTMENT_RISK_COLORS[entity.risk_level as string] ??
                    'bg-surface-raised text-fg-primary'
                  }`}
                >
                  {String(entity.risk_level).charAt(0).toUpperCase() +
                    String(entity.risk_level).slice(1)}
                </span>
              </div>
            )}
            {entity.expected_return_rate !== null && entity.expected_return_rate !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-fg-secondary">Expected Return</span>
                <span className="font-semibold">
                  {Number(entity.expected_return_rate).toFixed(1)}%
                </span>
              </div>
            )}
            {/* A rate without its cadence is only half a term: "12%" paid
                quarterly and "12%" paid at exit are different offers, and this
                card already renders the rate. The form has always collected the
                frequency; nothing showed it. */}
            {typeof entity.return_frequency === 'string' && entity.return_frequency && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-fg-secondary">Return Paid</span>
                <span className="font-semibold">
                  {RETURN_FREQUENCY_LABELS[entity.return_frequency] ?? entity.return_frequency}
                </span>
              </div>
            )}
            {entity.term_months !== null && entity.term_months !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-fg-secondary">Term</span>
                <span className="font-semibold">{entity.term_months} months</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-fg-secondary">Minimum Investment</span>
              <span className="font-semibold">{invFmt(entity, entity.minimum_investment)}</span>
            </div>
            {entity.maximum_investment !== null && entity.maximum_investment !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-fg-secondary">Maximum Investment</span>
                <span className="font-semibold">{invFmt(entity, entity.maximum_investment)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {entity.terms && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-fg-primary whitespace-pre-wrap">
                {entity.terms as string}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  },
};
