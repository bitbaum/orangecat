'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { EntityCardActions } from './EntityCardActions';
import { EntityCardImage } from './EntityCardImage';
import { getStatusInfo } from '@/config/status-config';
import { BADGE_VARIANT_CLASSES } from '@/config/badge-colors';

export interface EntityCardProps {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
  category?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  href?: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'destructive' | 'secondary';
  priceLabel?: string;
  metadata?: ReactNode;
  fundingProgress?: number;
  goalAmount?: string;
  createdAt?: string;
  updatedAt?: string;
  className?: string;
  editUrl?: string;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  isDeleting?: boolean;
  showEditButton?: boolean;
  editHref?: string;
  onClick?: () => void;
  imageAspectRatio?: 'square' | 'landscape' | 'portrait' | string;
  actions?: ReactNode;
  showOnProfile?: boolean;
  onToggleVisibility?: () => void | Promise<void>;
  isTogglingVisibility?: boolean;
  entityStatus?: string;
  onStatusChange?: (newStatus: string) => void | Promise<void>;
  isChangingStatus?: boolean;
  headerSlot?: ReactNode;
  progressSlot?: ReactNode;
  metricsSlot?: ReactNode;
  footerSlot?: ReactNode;
  compact?: boolean;
}

export function EntityCard({
  id: _id,
  title,
  description,
  status,
  category,
  imageUrl,
  thumbnailUrl,
  href,
  badge,
  badgeVariant = 'default',
  priceLabel,
  metadata,
  fundingProgress,
  goalAmount,
  className,
  editUrl,
  editHref,
  onEdit,
  onDelete,
  isDeleting,
  showEditButton: _showEditButton,
  onClick,
  imageAspectRatio: _imageAspectRatio,
  actions: _actions,
  showOnProfile,
  onToggleVisibility,
  isTogglingVisibility,
  entityStatus,
  onStatusChange,
  isChangingStatus,
  headerSlot,
  progressSlot,
  metricsSlot,
  footerSlot,
  compact = false,
}: EntityCardProps) {
  const imageSrc = thumbnailUrl || imageUrl;
  const hasActions =
    editUrl || editHref || onEdit || onDelete || onToggleVisibility || onStatusChange;
  const detailHref = href || '#';

  return (
    <div
      className={cn(
        'oc-surface oc-card-link group relative flex flex-col overflow-hidden',
        'transition-colors duration-150',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
    >
      <EntityCardImage imageSrc={imageSrc} title={title} compact={compact} href={detailHref} />

      {hasActions && (
        <div className="absolute top-2 right-2 z-20">
          <EntityCardActions
            editUrl={editUrl || editHref}
            onEdit={onEdit}
            onDelete={onDelete}
            isDeleting={isDeleting}
            deleteConfirmTitle={`Delete ${title}`}
            deleteConfirmDescription={`Are you sure you want to delete "${title}"? This action cannot be undone.`}
            showOnProfile={showOnProfile}
            onToggleVisibility={onToggleVisibility}
            isTogglingVisibility={isTogglingVisibility}
            entityStatus={entityStatus}
            onStatusChange={onStatusChange}
            isChangingStatus={isChangingStatus}
          />
        </div>
      )}

      {showOnProfile === false && (
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center gap-1 rounded-md border border-subtle bg-surface-page/90 px-2 py-1 text-xs font-medium text-fg-primary backdrop-blur">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
            Hidden
          </span>
        </div>
      )}

      <div className={cn('flex flex-1 flex-col', compact ? 'p-3' : 'p-4')}>
        {badge && (
          <div className={cn(compact ? 'mb-1' : 'mb-2')}>
            <Badge
              variant="secondary"
              className={cn('text-xs', BADGE_VARIANT_CLASSES[badgeVariant])}
            >
              {badge}
            </Badge>
          </div>
        )}

        {headerSlot && <div className={cn(compact ? 'mb-1' : 'mb-2')}>{headerSlot}</div>}

        <Link href={detailHref}>
          <h3
            className={cn(
              'font-semibold text-fg-primary transition-colors group-hover:underline underline-offset-4 line-clamp-1',
              compact ? 'text-sm' : 'text-lg'
            )}
          >
            {title}
          </h3>
        </Link>

        {description && !compact && (
          <p className="mt-2 text-base text-fg-secondary line-clamp-2">{description}</p>
        )}

        {priceLabel && (
          <p className={cn(compact ? 'mt-1' : 'mt-2', 'text-sm font-medium text-fg-primary')}>
            {priceLabel}
          </p>
        )}

        {metadata && <div className={cn(compact ? 'mt-1' : 'mt-2')}>{metadata}</div>}

        {(status || category) && (
          <div className={cn(compact ? 'mt-2' : 'mt-3', 'flex items-center justify-between')}>
            <div className="flex items-center gap-2">
              {status && (
                <Badge className={cn('text-xs', getStatusInfo(status).className)}>
                  {getStatusInfo(status).label}
                </Badge>
              )}
              {category && (
                <Badge variant="outline" className="text-xs">
                  {category}
                </Badge>
              )}
            </div>
            {goalAmount && (
              <span className="text-sm font-medium text-fg-primary">{goalAmount}</span>
            )}
          </div>
        )}

        {fundingProgress !== undefined && (
          <div className={cn(compact ? 'mt-2' : 'mt-3')}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-secondary">Progress</span>
              <span className="font-medium text-fg-primary">{fundingProgress}%</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-surface-raised">
              <div
                className="h-2 rounded-full bg-fg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, fundingProgress)}%` }}
              />
            </div>
          </div>
        )}

        {progressSlot && <div className={cn(compact ? 'mt-2' : 'mt-3')}>{progressSlot}</div>}
        {metricsSlot && <div className={cn(compact ? 'mt-2' : 'mt-3')}>{metricsSlot}</div>}

        {footerSlot && (
          <div className={cn(compact ? 'mt-2 pt-2' : 'mt-3 pt-3', 'border-t border-subtle')}>
            {footerSlot}
          </div>
        )}
      </div>
    </div>
  );
}

export default EntityCard;
