'use client';

import Link from 'next/link';
import { formatRelativeTime } from '@/utils/dates';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { EntityCard } from '@/components/entity/EntityCard';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { getStatusInfo } from '@/config/status-config';
import { cn } from '@/lib/utils';

export interface GenericPublicEntity {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  category?: string | null;
  cause_category?: string | null;
  created_at: string;
  // group uses slug for URL
  slug?: string | null;
}

interface GenericPublicCardProps {
  entity: GenericPublicEntity;
  entityType: EntityType;
  href: string;
  viewMode?: 'grid' | 'list';
}

export function GenericPublicCard({
  entity,
  entityType,
  href,
  viewMode = 'grid',
}: GenericPublicCardProps) {
  const meta = ENTITY_REGISTRY[entityType];
  const Icon = meta?.icon;
  const category = entity.category ?? entity.cause_category;

  if (viewMode === 'list') {
    return (
      <Link href={href}>
        <Card className="oc-card-link">
          <div className="flex items-center p-4 gap-4">
            <div className="oc-icon-tile h-12 w-12">
              {Icon && <Icon className="w-6 h-6 text-fg-secondary" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-fg-primary truncate">{entity.title}</h3>
              {entity.description && (
                <p className="text-sm text-fg-secondary truncate">{entity.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              {entity.status && (
                <Badge variant="secondary" className="capitalize text-xs">
                  {entity.status}
                </Badge>
              )}
              <span className="text-fg-tertiary whitespace-nowrap">
                {formatRelativeTime(entity.created_at)}
              </span>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <EntityCard
      id={entity.id}
      title={entity.title}
      description={entity.description}
      href={href}
      headerSlot={
        entity.status ? (
          // Not `{entity.status}` with a `capitalize` class: CSS capitalises the
          // first letter and leaves the underscore, so a sold-out product read
          // "Sold_out" on every public card. This component already knew that —
          // it does `.replace(/_/g, ' ')` for the category two lines down.
          <Badge
            variant="secondary"
            className={cn('text-xs', getStatusInfo(entity.status, entityType).className)}
          >
            {getStatusInfo(entity.status, entityType).label}
          </Badge>
        ) : null
      }
      metadata={
        category ? (
          <Badge variant="outline" className="text-xs capitalize">
            {category.replace(/_/g, ' ')}
          </Badge>
        ) : null
      }
    />
  );
}

export default GenericPublicCard;
