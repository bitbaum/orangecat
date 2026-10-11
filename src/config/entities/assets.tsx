/**
 * Asset Entity Configuration
 *
 * Following Engineering Principles:
 * - DRY: Uses shared EntityConfig pattern
 * - SSOT: Paths reference entity-registry.ts values
 * - Consistency: Same structure as products, services, causes
 *
 * Created: 2025-12-25
 * Last Modified: 2025-12-25
 * Last Modified Summary: Initial creation of asset entity configuration
 */

import { EntityConfig } from '@/types/entity';
import { Asset } from '@/types/asset';
import Button from '@/components/ui/Button';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { formatCurrency } from '@/services/currency';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { GRADIENTS } from '@/config/gradients';
import { ENTITY_STATUS } from '@/config/database-constants';

export const assetEntityConfig: EntityConfig<Asset> = {
  name: ENTITY_REGISTRY['asset'].name,
  namePlural: ENTITY_REGISTRY['asset'].namePlural,
  colorTheme: ENTITY_REGISTRY['asset'].colorTheme,

  listPath: ENTITY_REGISTRY['asset'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['asset'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['asset'].createPath,
  editPath: id => `${ENTITY_REGISTRY['asset'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['asset'].type,
  apiEndpoint: ENTITY_REGISTRY['asset'].apiEndpoint,

  makeHref: asset => `${ENTITY_REGISTRY['asset'].basePath}/${asset.id}`,

  makeCardProps: asset => {
    // Build value label
    const valueLabel = asset.estimated_value
      ? formatCurrency(asset.estimated_value, asset.currency || PLATFORM_DEFAULT_CURRENCY)
      : undefined;

    // Format asset type for display
    const typeLabel = asset.type?.replace(/_/g, ' ');

    // Build metadata
    const metadataParts: string[] = [];
    if (typeLabel) {
      metadataParts.push(typeLabel);
    }
    if (asset.location) {
      metadataParts.push(asset.location);
    }

    return {
      priceLabel: valueLabel,
      badge:
        asset.verification_status === 'third_party_verified'
          ? 'Verified'
          : asset.verification_status === 'user_provided'
            ? 'Self-Verified'
            : asset.status === ENTITY_STATUS.DRAFT
              ? 'Draft'
              : undefined,
      badgeVariant:
        asset.verification_status === 'third_party_verified'
          ? 'success'
          : asset.verification_status === 'user_provided'
            ? 'default'
            : 'default',
      metadata:
        metadataParts.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-fg-secondary">
            {metadataParts.map((part, idx) => (
              <span key={idx} className="capitalize">
                {part}
              </span>
            ))}
          </div>
        ) : undefined,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['asset'].createPath}?edit=${asset.id}`,
      // Removed duplicate actions button - edit icon overlay is sufficient
    };
  },

  emptyState: {
    title: 'No assets yet',
    description:
      'Create your first asset to use as collateral for loans or to track your portfolio.',
    action: (
      <Button href={ROUTES.DASHBOARD.ASSETS_CREATE} className={GRADIENTS.brandGreen}>
        Create Asset
      </Button>
    ),
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
