/**
 * Project status: the VALUES, the visibility rules, and nothing about colour.
 *
 * This file used to open by calling itself the single source of truth and
 * telling you to "import from this file only", while three other tables also
 * decided what colour a project status is — `STATUS_CONFIG`, the per-entity
 * `STATUS_BADGES`, and a private map inside `EntityCard`. They disagreed: a
 * completed project rendered blue here and on its header, and green on the
 * dashboard list. A docblock cannot make a claim like that true; only having
 * one table can.
 *
 * So the colours are gone from here. `PROJECT_STATUSES` still exists because
 * plenty of code reads its shape, but every entry is now DERIVED from
 * `getStatusInfo(status, 'project')` — the same call the rest of the app makes.
 * What stays owned here is what is genuinely project-specific: the status
 * values, which of them a signed-out visitor may see, and validation.
 */

import { getStatusInfo } from '@/config/status-config';
import { getStatusBadge, type BadgeVariant } from '@/config/entity-status';

/** String constants for project status comparisons (follows STATUS.* pattern) */
export const PROJECT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

/**
 * Statuses a signed-out visitor can see. This mirrors the `projects_public_read`
 * RLS policy on the database (`status = 'active' OR status = 'completed' OR
 * user_id = auth.uid()`) — keep the two in step. Anything else is owner-only,
 * which means the owner is the only person who can act on it.
 */
export const PROJECT_PUBLICLY_VISIBLE_STATUSES: readonly string[] = [
  PROJECT_STATUS.ACTIVE,
  PROJECT_STATUS.COMPLETED,
];

/** True when the project is visible to people other than its owner. */
export function isProjectPubliclyVisible(status: string | null | undefined): boolean {
  return !!status && PROJECT_PUBLICLY_VISIBLE_STATUSES.includes(status);
}

export type ProjectStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

interface ProjectStatusDisplay {
  label: string;
  className: string;
  badgeVariant: BadgeVariant;
}

/**
 * Derived, not declared. `getStatusInfo(status, 'project')` is the same call
 * every other surface makes, so this cannot drift from them again; the `border`
 * prefix is the one thing this shape adds, because its callers render a bordered
 * pill.
 */
export const PROJECT_STATUSES: Record<ProjectStatus, ProjectStatusDisplay> = Object.fromEntries(
  (['draft', 'active', 'paused', 'completed', 'cancelled'] as const).map(status => {
    const info = getStatusInfo(status, 'project');
    return [
      status,
      {
        label: info.label,
        className: `border ${info.className}`,
        badgeVariant: getStatusBadge('project', status)?.variant ?? 'default',
      },
    ];
  })
) as Record<ProjectStatus, ProjectStatusDisplay>;

/** All valid project status values */
export const VALID_PROJECT_STATUSES = [
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
] as const satisfies readonly ProjectStatus[];

/** Statuses visible in public search/discover */
export const PUBLIC_SEARCH_STATUSES: readonly ProjectStatus[] = ['active', 'paused'] as const;
