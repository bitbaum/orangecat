/**
 * Service Entity Configuration
 *
 * Created: 2025-01-27
 * Last Modified: 2026-01-04
 * Last Modified Summary: Updated to convert prices to user's preferred currency
 */

import { EntityConfig } from '@/types/entity';
import { UserService } from '@/types/database';
import Button from '@/components/ui/Button';
import { convert, formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { getStatusBadge } from '@/config/entity-status';
import type { Currency } from '@/types/settings';
import { GRADIENTS } from '@/config/gradients';

export const serviceEntityConfig: EntityConfig<UserService> = {
  name: ENTITY_REGISTRY['service'].name,
  namePlural: ENTITY_REGISTRY['service'].namePlural,
  colorTheme: ENTITY_REGISTRY['service'].colorTheme,

  listPath: ENTITY_REGISTRY['service'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['service'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['service'].createPath,
  editPath: id => `${ENTITY_REGISTRY['service'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['service'].type,
  apiEndpoint: ENTITY_REGISTRY['service'].apiEndpoint,

  makeHref: service => `${ENTITY_REGISTRY['service'].basePath}/${service.id}`,

  makeCardProps: (service, userCurrency?: string) => {
    // Display prices in user's preferred currency (or service's currency)
    const displayCurrency = (userCurrency ||
      service.currency ||
      PLATFORM_DEFAULT_CURRENCY) as Currency;
    const priceParts: string[] = [];
    if (service.hourly_rate && service.currency) {
      const hourlyRate =
        service.currency === displayCurrency
          ? service.hourly_rate
          : convert(service.hourly_rate, service.currency as Currency, displayCurrency);
      priceParts.push(`${formatCurrency(hourlyRate, displayCurrency)}/hour`);
    }
    if (service.fixed_price && service.currency) {
      const fixedPrice =
        service.currency === displayCurrency
          ? service.fixed_price
          : convert(service.fixed_price, service.currency as Currency, displayCurrency);
      priceParts.push(formatCurrency(fixedPrice, displayCurrency));
    }
    const priceLabel = priceParts.length > 0 ? priceParts.join(' or ') : undefined;

    // Build metadata (category, location)
    const metadataParts: string[] = [];
    if (service.category) {
      metadataParts.push(service.category);
    }
    if (service.service_location_type) {
      metadataParts.push(
        service.service_location_type === 'remote'
          ? 'Remote'
          : service.service_location_type === 'onsite'
            ? 'On-site'
            : 'Remote & On-site'
      );
    }

    const statusBadge = getStatusBadge('service', service.status);

    return {
      priceLabel,
      badge: statusBadge?.label,
      badgeVariant: statusBadge?.variant,
      metadata:
        metadataParts.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-fg-secondary">
            {metadataParts.map((part, idx) => (
              <span key={idx}>{part}</span>
            ))}
          </div>
        ) : undefined,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['service'].createPath}?edit=${service.id}`,
      // Removed duplicate actions button - edit icon overlay is sufficient
    };
  },

  emptyState: {
    title: 'No services yet',
    description: 'Start offering your expertise to the community by creating your first service.',
    action: (
      <Button href={ROUTES.DASHBOARD.SERVICES_CREATE} className={GRADIENTS.brandOrangeDark}>
        Create Service
      </Button>
    ),
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
