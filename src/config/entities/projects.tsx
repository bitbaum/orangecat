/**
 * Project Entity Configuration
 *
 * Following Engineering Principles:
 * - DRY: Uses shared EntityConfig pattern
 * - SSOT: Paths reference entity-registry.ts values
 * - Consistency: Same structure as products, services, loans
 *
 * Created: 2025-12-31
 * Last Modified: 2026-01-04
 * Last Modified Summary: Updated to convert prices to user's preferred currency
 */

import { EntityConfig } from '@/types/entity';
import Button from '@/components/ui/Button';
import { convert, formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { getStatusBadge } from '@/config/entity-status';
import type { Currency } from '@/types/settings';
import { GRADIENTS } from '@/config/gradients';

// Project type for EntityList usage
export interface ProjectListItem {
  id: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  goal_amount?: number | null;
  total_funding?: number;
  current_amount?: number;
  currency?: string;
  category?: string;
  status?: string;
  isDraft?: boolean;
  isActive?: boolean;
  isPaused?: boolean;
  tags?: string[];
  [key: string]: unknown; // Index signature for BaseEntity compatibility
}

export const projectEntityConfig: EntityConfig<ProjectListItem> = {
  name: ENTITY_REGISTRY['project'].name,
  namePlural: ENTITY_REGISTRY['project'].namePlural,
  colorTheme: ENTITY_REGISTRY['project'].colorTheme,

  listPath: ENTITY_REGISTRY['project'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['project'].publicBasePath}/${id}`,
  createPath: ENTITY_REGISTRY['project'].createPath,
  editPath: id => `${ENTITY_REGISTRY['project'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['project'].type,
  apiEndpoint: ENTITY_REGISTRY['project'].apiEndpoint,

  makeHref: project => `${ENTITY_REGISTRY['project'].publicBasePath}/${project.id}`,

  makeCardProps: (project, userCurrency?: string) => {
    // Display amounts in user's preferred currency (or project's currency)
    const displayCurrency = (userCurrency ||
      project.currency ||
      PLATFORM_DEFAULT_CURRENCY) as Currency;

    // Format funding progress
    const fundingLabel =
      project.goal_amount && project.currency
        ? (() => {
            const current = project.current_amount || project.total_funding || 0;
            const goal = project.goal_amount;

            // Convert both to display currency if needed
            const currentInDisplay =
              project.currency === displayCurrency
                ? current
                : convert(current, project.currency as Currency, displayCurrency);
            const goalInDisplay =
              project.currency === displayCurrency
                ? goal
                : convert(goal, project.currency as Currency, displayCurrency);

            return `${formatCurrency(currentInDisplay, displayCurrency)} / ${formatCurrency(goalInDisplay, displayCurrency)}`;
          })()
        : project.total_funding && project.currency
          ? (() => {
              const total =
                project.currency === displayCurrency
                  ? project.total_funding
                  : convert(project.total_funding, project.currency as Currency, displayCurrency);
              return formatCurrency(total, displayCurrency);
            })()
          : undefined;

    // Calculate progress percentage (both amounts must be in same currency)
    const progress =
      project.goal_amount && project.goal_amount > 0 && project.currency
        ? (() => {
            const current = project.current_amount || project.total_funding || 0;
            // Both amounts are in project.currency, so direct comparison
            return Math.round((current / project.goal_amount) * 100);
          })()
        : 0;

    // Build metadata parts
    const metadataParts: string[] = [];
    if (project.category) {
      metadataParts.push(project.category);
    }

    const statusBadge = getStatusBadge('project', project.status);

    return {
      priceLabel: fundingLabel,
      badge: statusBadge?.label,
      badgeVariant: statusBadge?.variant,
      metadata:
        metadataParts.length > 0 || project.goal_amount ? (
          <div className="space-y-1.5">
            {/* Slim funding-progress bar — communicates the X / Y ratio
                in priceLabel at a glance. Only shows when a goal is set;
                no-goal projects skip the bar (the priceLabel falls back
                to total_funding only). */}
            {project.goal_amount && project.goal_amount > 0 ? (
              <div className="space-y-0.5">
                <div className="h-1 w-full overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full bg-fg-primary transition-all duration-500"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-fg-secondary">
                  <span>
                    {metadataParts.map((part, idx) => (
                      <span key={idx} className="capitalize">
                        {idx > 0 ? ' · ' : ''}
                        {part}
                      </span>
                    ))}
                  </span>
                  <span className="font-medium tabular-nums">{progress}%</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 text-xs text-fg-secondary">
                {metadataParts.map((part, idx) => (
                  <span key={idx} className="capitalize">
                    {part}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : undefined,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['project'].createPath}?edit=${project.id}`,
    };
  },

  emptyState: {
    title: 'No projects yet',
    description:
      'Create your first project to start accepting Bitcoin funding and building support for your cause.',
    action: (
      <Button href={ROUTES.DASHBOARD.PROJECTS_CREATE} className={GRADIENTS.brandOrangeDark}>
        Create Project
      </Button>
    ),
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
