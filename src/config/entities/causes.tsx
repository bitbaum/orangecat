/**
 * Cause Entity Configuration
 *
 * Created: 2025-12-25
 * Last Modified: 2026-01-04
 * Last Modified Summary: Updated to convert prices to user's preferred currency
 */

import { EntityConfig } from '@/types/entity';
import { UserCause } from '@/types/database';
import Button from '@/components/ui/Button';
import { convert, formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { getStatusBadge } from '@/config/entity-status';
import type { Currency } from '@/types/settings';
import { GRADIENTS } from '@/config/gradients';

export const causeEntityConfig: EntityConfig<UserCause> = {
  name: ENTITY_REGISTRY['cause'].name,
  namePlural: ENTITY_REGISTRY['cause'].namePlural,
  colorTheme: ENTITY_REGISTRY['cause'].colorTheme,

  listPath: ENTITY_REGISTRY['cause'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['cause'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['cause'].createPath,
  editPath: id => `${ENTITY_REGISTRY['cause'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['cause'].type,
  apiEndpoint: ENTITY_REGISTRY['cause'].apiEndpoint,

  makeHref: cause => `${ENTITY_REGISTRY['cause'].basePath}/${cause.id}`,

  makeCardProps: (cause, userCurrency?: string) => {
    // Display goal in user's preferred currency (or cause's currency)
    const displayCurrency = (userCurrency ||
      cause.currency ||
      PLATFORM_DEFAULT_CURRENCY) as Currency;
    // Build goal label - use goal_amount (database field name)
    const goalLabel =
      cause.goal_amount && cause.currency
        ? (() => {
            const goalAmount =
              cause.currency === displayCurrency
                ? cause.goal_amount
                : convert(cause.goal_amount, cause.currency as Currency, displayCurrency);
            return `Goal: ${formatCurrency(goalAmount, displayCurrency)}`;
          })()
        : undefined;

    // Build progress info
    const progressParts: string[] = [];
    if (cause.cause_category) {
      progressParts.push(cause.cause_category);
    }
    // Use current_amount (database field name) instead of total_raised
    if (cause.current_amount !== undefined && cause.goal_amount && cause.currency) {
      // Convert both to same currency for percentage calculation
      const raisedInGoalCurrency =
        cause.currency === displayCurrency
          ? cause.current_amount
          : convert(cause.current_amount, cause.currency as Currency, displayCurrency);
      const goalInGoalCurrency =
        cause.currency === displayCurrency
          ? cause.goal_amount
          : convert(cause.goal_amount, cause.currency as Currency, displayCurrency);
      const percentage = Math.round((raisedInGoalCurrency / goalInGoalCurrency) * 100);
      progressParts.push(`${percentage}% funded`);
    }

    const statusBadge = getStatusBadge('cause', cause.status);

    return {
      priceLabel: goalLabel,
      badge: statusBadge?.label,
      badgeVariant: statusBadge?.variant,
      metadata:
        progressParts.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-fg-secondary">
            {progressParts.map((part, idx) => (
              <span key={idx}>{part}</span>
            ))}
          </div>
        ) : undefined,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['cause'].createPath}?edit=${cause.id}`,
      // Removed duplicate actions button - edit icon overlay is sufficient
    };
  },

  emptyState: {
    title: 'No causes yet',
    description: 'Start making a difference by creating your first cause or fundraiser.',
    action: (
      <Button href={ROUTES.DASHBOARD.CAUSES_CREATE} className={GRADIENTS.brandOrangeDark}>
        Create Cause
      </Button>
    ),
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
