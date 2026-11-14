/**
 * Group Card Component
 *
 * Unified card for groups using config-based labels.
 * Extends EntityCard pattern for DRY consistency.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-12-29
 * Last Modified Summary: Updated to use config-based labels
 */

'use client';

import EntityCard from '@/components/entity/EntityCard';
import { Users } from 'lucide-react';
import type { Group, GroupWithRelations } from '@/types/group';
import { GROUP_LABELS, type GroupLabel } from '@/config/group-labels';
import { ROUTES } from '@/config/routes';

interface GroupCardProps {
  group: Group | GroupWithRelations;
  onClick?: () => void;
  className?: string;
}

export function GroupCard({ group, onClick, className }: GroupCardProps) {
  // Get label config from SSOT
  const labelConfig = GROUP_LABELS[group.label as GroupLabel];
  const _Icon = labelConfig?.icon || Users;

  // A group always has its founder, so 0 means the members are not visible to
  // this reader (or were not counted): say nothing rather than "0 members".
  const memberCount = 'member_count' in group ? group.member_count : undefined;
  const metadata = (
    <div className="flex items-center gap-4 text-sm text-fg-secondary">
      {memberCount !== undefined && memberCount > 0 && (
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          <span>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
        </div>
      )}
      {group.tags && group.tags.length > 0 && <span className="text-xs">{group.tags[0]}</span>}
    </div>
  );

  return (
    <EntityCard
      id={group.id}
      title={group.name}
      description={group.description || undefined}
      thumbnailUrl={group.avatar_url || undefined}
      entityType="group"
      href={ROUTES.GROUPS.VIEW(group.slug)}
      badge={labelConfig?.name || 'Group'}
      badgeVariant={group.is_public ? 'default' : 'info'}
      metadata={metadata}
      className={className}
      onClick={onClick}
      imageAspectRatio="landscape"
    />
  );
}
