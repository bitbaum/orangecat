/**
 * Investment Entity Configuration
 *
 * List/card display config for the investment entity.
 */

import { EntityConfig } from '@/types/entity';
import { Investment } from '@/types/investments';
import Button from '@/components/ui/Button';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { getStatusBadge } from '@/config/entity-status';
import { ROUTES } from '@/config/routes';
import { GRADIENTS } from '@/config/gradients';

export const investmentEntityConfig: EntityConfig<Investment> = {
  name: ENTITY_REGISTRY['investment'].name,
  namePlural: ENTITY_REGISTRY['investment'].namePlural,
  colorTheme: ENTITY_REGISTRY['investment'].colorTheme,

  listPath: ENTITY_REGISTRY['investment'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['investment'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['investment'].createPath,
  editPath: id => `${ENTITY_REGISTRY['investment'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['investment'].type,
  apiEndpoint: ENTITY_REGISTRY['investment'].apiEndpoint,

  makeHref: investment => `${ENTITY_REGISTRY['investment'].basePath}/${investment.id}`,

  makeCardProps: investment => {
    const currency = investment.currency || PLATFORM_DEFAULT_CURRENCY;
    const targetLabel = investment.target_amount
      ? `${investment.target_amount} ${currency} target`
      : undefined;

    const metadataParts: string[] = [];
    if (investment.investment_type) {
      metadataParts.push(investment.investment_type.replace('_', ' '));
    }
    if (investment.risk_level) {
      metadataParts.push(`${investment.risk_level} risk`);
    }
    if ((investment.investor_count ?? 0) > 0) {
      metadataParts.push(
        `${investment.investor_count} investor${investment.investor_count !== 1 ? 's' : ''}`
      );
    }

    // Progress towards target
    const progress =
      investment.target_amount > 0
        ? Math.round((investment.total_raised / investment.target_amount) * 100)
        : 0;

    const badge = getStatusBadge('investment', investment.status);

    return {
      priceLabel: targetLabel,
      badge: badge?.label,
      badgeVariant: badge?.variant,
      metadata:
        metadataParts.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-fg-secondary">
            {metadataParts.map((part, idx) => (
              <span key={idx} className="capitalize">
                {part}
              </span>
            ))}
            {progress > 0 && <span className="text-green-600 font-medium">{progress}% funded</span>}
          </div>
        ) : undefined,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['investment'].createPath}?edit=${investment.id}`,
    };
  },

  emptyState: {
    title: 'No investments yet',
    description: 'Create your first investment opportunity to connect with potential investors.',
    action: (
      <Button href={ROUTES.DASHBOARD.INVESTMENTS_CREATE} className={GRADIENTS.brandGreen}>
        Create Investment
      </Button>
    ),
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
