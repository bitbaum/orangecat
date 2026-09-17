import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';
import { displayBTC, formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import {
  ASSET_TYPE_LABELS,
  ASSET_VERIFICATION_COLORS,
  ASSET_VERIFICATION_LABELS,
  ASSET_RENTAL_PERIOD_LABELS,
} from '@/config/assets';
import { BookEntityButton } from '@/components/bookings/BookEntityButton';

/**
 * Asset detail config (SSOT) — shared by the public route (/assets/[id]) and the
 * owner dashboard route (/dashboard/assets/[id]).
 */
export const assetDetailConfig: EntityDetailConfig = {
  entityType: 'asset',
  ownerLabel: 'Listed By',
  descriptionTitle: 'About this Asset',
  metadataSelect: 'title, description',
  showPaymentSection: false,
  getViewRoute: id => ROUTES.ASSETS.VIEW(id),
  renderHeaderExtra: entity => {
    const verificationStatus = entity.verification_status as string | undefined;
    if (!verificationStatus) {
      return null;
    }
    return (
      <span
        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
          ASSET_VERIFICATION_COLORS[verificationStatus] ?? 'bg-surface-raised text-fg-primary'
        }`}
      >
        {ASSET_VERIFICATION_LABELS[verificationStatus] ?? verificationStatus}
      </span>
    );
  },
  getJsonLdExtra: entity => ({
    ...(entity.estimated_value && {
      value: {
        '@type': 'MonetaryAmount',
        value: entity.estimated_value,
        currency: entity.currency || 'CHF',
      },
    }),
    ...(entity.location && { address: entity.location }),
  }),
  renderDetails: (entity, _payable, _isOwner, isSignedIn) => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Asset Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entity.type && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-fg-secondary">Type</span>
              <Badge variant="secondary">
                {ASSET_TYPE_LABELS[entity.type as string] ?? String(entity.type)}
              </Badge>
            </div>
          )}
          {entity.location && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-fg-secondary">Location</span>
              <span className="font-medium text-sm">{String(entity.location)}</span>
            </div>
          )}
          {entity.estimated_value !== null && entity.estimated_value !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-fg-secondary">Estimated Value</span>
              <span className="font-semibold">
                {formatCurrency(Number(entity.estimated_value), String(entity.currency || PLATFORM_DEFAULT_CURRENCY))}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {(entity.is_for_sale || entity.is_for_rent) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entity.is_for_sale && (
              <div className="p-3 bg-status-positive-subtle rounded-lg space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-status-positive">For Sale</span>
                </div>
                {entity.sale_price_btc !== null && entity.sale_price_btc !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-fg-secondary">Sale Price</span>
                    <span className="font-bold text-status-positive">
                      {displayBTC(Number(entity.sale_price_btc))}
                    </span>
                  </div>
                )}
              </div>
            )}
            {entity.is_for_rent && (
              <div className="p-3 bg-surface-raised/40 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg-primary">For Rent</span>
                </div>
                {entity.rental_price_btc !== null && entity.rental_price_btc !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-fg-secondary">Rental Price</span>
                    <span className="font-bold text-fg-primary">
                      {displayBTC(Number(entity.rental_price_btc))} /{' '}
                      {ASSET_RENTAL_PERIOD_LABELS[entity.rental_period_type as string] ?? 'period'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-fg-secondary">Minimum Period</span>
                  <span className="font-medium">
                    {entity.min_rental_period}{' '}
                    {ASSET_RENTAL_PERIOD_LABELS[entity.rental_period_type as string] ?? 'period'}
                    {Number(entity.min_rental_period) !== 1 ? 's' : ''}
                  </span>
                </div>
                {entity.max_rental_period !== null && entity.max_rental_period !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-fg-secondary">Maximum Period</span>
                    <span className="font-medium">
                      {entity.max_rental_period}{' '}
                      {ASSET_RENTAL_PERIOD_LABELS[entity.rental_period_type as string] ?? 'period'}
                      {Number(entity.max_rental_period) !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
            {entity.requires_deposit &&
              entity.deposit_amount_btc !== null &&
              entity.deposit_amount_btc !== undefined && (
                <div className="flex justify-between items-center border-t dark:border-default pt-2">
                  <span className="text-sm text-fg-secondary">Security Deposit</span>
                  <span className="font-semibold">
                    {displayBTC(Number(entity.deposit_amount_btc))}
                  </span>
                </div>
              )}
            {entity.is_for_rent && (
              <BookEntityButton
                className="w-full"
                label="Book this rental"
                isSignedIn={isSignedIn}
                bookableType="asset"
                bookableId={entity.id as string}
                bookableTitle={(entity.title as string) || 'this asset'}
                priceBtc={
                  entity.rental_price_btc !== null && entity.rental_price_btc !== undefined
                    ? Number(entity.rental_price_btc)
                    : undefined
                }
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  ),
};
