/**
 * Loan Entity Configuration
 *
 * Created: 2025-12-31
 * Last Modified: 2025-12-31
 * Last Modified Summary: Initial creation of loan entity configuration for modular entity system
 */

import { EntityConfig } from '@/types/entity';
import { Loan } from '@/types/loans';
import Button from '@/components/ui/Button';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { formatCurrency } from '@/services/currency';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { getStatusBadge } from '@/config/entity-status';
import { GRADIENTS } from '@/config/gradients';

export const loanEntityConfig: EntityConfig<Loan> = {
  name: ENTITY_REGISTRY['loan'].name,
  namePlural: ENTITY_REGISTRY['loan'].namePlural,
  colorTheme: ENTITY_REGISTRY['loan'].colorTheme,

  listPath: ENTITY_REGISTRY['loan'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['loan'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['loan'].createPath,
  editPath: id => `${ENTITY_REGISTRY['loan'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['loan'].type,
  apiEndpoint: ENTITY_REGISTRY['loan'].apiEndpoint,

  makeHref: loan => `${ENTITY_REGISTRY['loan'].basePath}/${loan.id}`,

  makeCardProps: loan => {
    // Build remaining balance label
    const balanceLabel = loan.remaining_balance
      ? `${formatCurrency(loan.remaining_balance, loan.currency || PLATFORM_DEFAULT_CURRENCY)} remaining`
      : undefined;

    // Build metadata parts
    const metadataParts: string[] = [];
    if (loan.interest_rate) {
      metadataParts.push(`${loan.interest_rate}% interest`);
    }
    if (loan.loan_category_id) {
      metadataParts.push(loan.loan_category_id.replace('_', ' '));
    }
    if (loan.status) {
      metadataParts.push(loan.status.replace('_', ' '));
    }

    // Calculate progress percentage
    const progress =
      loan.original_amount > 0
        ? Math.round(((loan.original_amount - loan.remaining_balance) / loan.original_amount) * 100)
        : 0;

    const statusBadge = getStatusBadge('loan', loan.status);

    return {
      priceLabel: balanceLabel,
      badge: statusBadge?.label,
      badgeVariant: statusBadge?.variant,
      metadata:
        metadataParts.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-fg-secondary">
            {metadataParts.map((part, idx) => (
              <span key={idx} className="capitalize">
                {part}
              </span>
            ))}
            {progress > 0 && <span className="text-fg-primary font-medium">{progress}% paid</span>}
          </div>
        ) : undefined,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['loan'].createPath}?edit=${loan.id}`,
    };
  },

  emptyState: {
    title: 'No loans yet',
    description: 'Add your first loan to start receiving refinancing offers from the community.',
    action: (
      <Button href={ROUTES.DASHBOARD.LOANS_CREATE} className={GRADIENTS.brandTiffanyDark}>
        Create Loan
      </Button>
    ),
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
