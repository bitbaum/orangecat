/**
 * CIRCLE ENTITY CONFIGURATION
 *
 * Configuration for displaying circles in list views and the dashboard.
 */

import { EntityConfig } from '@/types/entity';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

export interface CircleListItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  visibility: string;
  tags: string[];
  member_count: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export const circleEntityConfig: EntityConfig<CircleListItem> = {
  name: ENTITY_REGISTRY['circle'].name,
  namePlural: ENTITY_REGISTRY['circle'].namePlural,
  colorTheme: ENTITY_REGISTRY['circle'].colorTheme,

  listPath: ENTITY_REGISTRY['circle'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['circle'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['circle'].createPath,
  editPath: id => `${ENTITY_REGISTRY['circle'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['circle'].type,
  apiEndpoint: ENTITY_REGISTRY['circle'].apiEndpoint,

  makeHref: item => `${ENTITY_REGISTRY['circle'].basePath}/${item.id}`,

  makeCardProps: item => ({
    badge: item.category || 'Circle',
    status: item.visibility === 'private' ? 'private' : 'active',
    showEditButton: true,
    editHref: `${ENTITY_REGISTRY['circle'].createPath}?edit=${item.id}`,
    metadata: (
      <div className="flex flex-wrap gap-2 text-xs text-fg-secondary">
        {item.category && <span>{item.category}</span>}
        <span className="capitalize">{item.visibility}</span>
        {item.member_count > 0 && <span>{item.member_count} members</span>}
      </div>
    ),
  }),

  emptyState: {
    title: 'No circles yet',
    description:
      'A circle is a light community around a shared interest: one page that says what it is about and who it is for, without the rules and votes of a group.',
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
