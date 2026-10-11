/**
 * Product Entity Configuration
 *
 * Created: 2025-01-27
 * Last Modified: 2026-01-04
 * Last Modified Summary: Updated to convert prices to user's preferred currency
 */

import { EntityConfig } from '@/types/entity';
import { UserProduct } from '@/types/database';
import Button from '@/components/ui/Button';
import { convert, formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { getStatusBadge } from '@/config/entity-status';
import type { Currency } from '@/types/settings';

export const productEntityConfig: EntityConfig<UserProduct> = {
  name: ENTITY_REGISTRY['product'].name,
  namePlural: ENTITY_REGISTRY['product'].namePlural,
  colorTheme: ENTITY_REGISTRY['product'].colorTheme,

  listPath: ENTITY_REGISTRY['product'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['product'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['product'].createPath,
  editPath: id => `${ENTITY_REGISTRY['product'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['product'].type,
  apiEndpoint: ENTITY_REGISTRY['product'].apiEndpoint,

  makeHref: product => `${ENTITY_REGISTRY['product'].basePath}/${product.id}`,

  makeCardProps: (product, userCurrency?: string) => {
    // Display price in user's preferred currency (or product's currency)
    const displayCurrency = (userCurrency ||
      product.currency ||
      PLATFORM_DEFAULT_CURRENCY) as Currency;
    const priceLabel =
      product.price && product.currency
        ? (() => {
            // If product currency matches display currency, use directly
            if (product.currency === displayCurrency) {
              return formatCurrency(product.price, displayCurrency);
            }
            // Otherwise convert from product's currency to display currency
            const converted = convert(product.price, product.currency as Currency, displayCurrency);
            return formatCurrency(converted, displayCurrency);
          })()
        : undefined;

    const statusBadge = getStatusBadge('product', product.status);

    return {
      priceLabel,
      badge: statusBadge?.label,
      badgeVariant: statusBadge?.variant,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['product'].createPath}?edit=${product.id}`,
      // Removed duplicate actions button - edit icon overlay is sufficient
    };
  },

  emptyState: {
    title: 'No products yet',
    description: 'Start building your marketplace by creating your first product.',
    action: <Button href={ROUTES.DASHBOARD.STORE_CREATE}>Create Product</Button>,
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
