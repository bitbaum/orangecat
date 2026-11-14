import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import PriceDisplay from '@/components/public/PriceDisplay';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ownerOnlyStatus } from '@/components/public/public-entity-detail-config';
import { ROUTES } from '@/config/routes';

// user_products stores `price` in the entity's chosen `currency` (NOT price_btc —
// that column doesn't exist). Read price + currency and format in that currency.
// See decision_currency_convention / 20260618000005.
const getPrice = (entity: Record<string, unknown>) => ({
  amount: typeof entity.price === 'number' ? entity.price : Number(entity.price ?? NaN),
  currency: (entity.currency as string) || 'CHF',
});

/** inventory_count -1 (or null) = unlimited, e.g. digital goods. */
export function availabilityLabel(inventory: number | null | undefined): string {
  if (inventory === null || inventory === undefined || inventory < 0) {
    return 'In stock';
  }
  return inventory > 0 ? `${inventory} available` : 'Sold out';
}

/**
 * SSOT for the product detail page. Used by BOTH the public route
 * (/products/[id]) and the owner dashboard route (/dashboard/store/[id]) — one
 * layout, buyers see the listing, the owner sees it plus the manage bar.
 */
export const productDetailConfig: EntityDetailConfig = {
  entityType: 'product',
  ownerLabel: 'Seller',
  statusBadge: ownerOnlyStatus,
  createdLabel: 'Listed',
  getViewRoute: id => ROUTES.PRODUCTS.VIEW(id),
  getPrice: entity => {
    const { amount, currency } = getPrice(entity);
    return Number.isFinite(amount) && amount > 0 ? { amount, currency } : null;
  },
  getJsonLdExtra: entity => {
    const { amount, currency } = getPrice(entity);
    return amount > 0
      ? { offers: { '@type': 'Offer', priceCurrency: currency, price: amount } }
      : {};
  },
  // Price and stock lead the page, where a phone's first screen reaches: they
  // used to sit in a Details card under the description, with a second, orange
  // "Buy now" beside the pay panel's own action. The one action is the pay
  // panel (#pay), which the mobile sticky bar leads to with the price in it.
  renderLead: entity => {
    const { amount, currency } = getPrice(entity);
    const hasPrice = Number.isFinite(amount) && amount > 0;
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6">
          {hasPrice && (
            <PriceDisplay
              amount={amount}
              currency={currency}
              className="text-3xl font-bold text-fg-primary"
            />
          )}
          <p className="mb-0 text-sm font-medium text-fg-secondary">
            {availabilityLabel(entity.inventory_count as number | null | undefined)}
          </p>
        </CardContent>
      </Card>
    );
  },
  renderDetails: entity => {
    const productType = entity.product_type as string | undefined;
    if (!productType) {
      return null;
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-fg-secondary">Type</span>
            <span className="font-medium capitalize">{productType}</span>
          </div>
        </CardContent>
      </Card>
    );
  },
};
