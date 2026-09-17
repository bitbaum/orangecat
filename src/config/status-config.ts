/**
 * Status Configuration - Single Source of Truth
 *
 * Centralized status labels and styling for all entity statuses.
 * Components should import from here instead of defining their own mappings.
 *
 * BENEFITS:
 * - Consistent status presentation across the app
 * - Easy to update labels/colors in one place
 * - Follows DRY and SSOT principles from CLAUDE.md
 *
 * Created: 2026-01-28
 */

// ==================== STATUS TYPES ====================

/**
 * All entity statuses across the platform — generic + entity-specific live states.
 * Generic: draft, active, paused, completed, cancelled, archived
 * Events:  published, open, full, ongoing
 * Investments: funded, closed
 */
export type EntityStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'archived'
  // Event-specific
  | 'published'
  | 'open'
  | 'full'
  | 'ongoing'
  // Investment-specific
  | 'funded'
  | 'closed';

// ==================== STATUS CONFIG ====================

interface StatusInfo {
  label: string;
  className: string;
  description?: string;
}

/**
 * Status configuration - SSOT for all status labels and styles
 */
import { BADGE_COLORS } from '@/config/badge-colors';
import { STATUS_LABELS } from './status-labels';

export const STATUS_CONFIG: Record<EntityStatus, StatusInfo> = {
  // Generic statuses
  draft: {
    label: STATUS_LABELS.draft,
    className: BADGE_COLORS.neutral,
    description: 'Not yet published',
  },
  active: {
    label: STATUS_LABELS.active,
    className: BADGE_COLORS.success,
    description: 'Live and visible',
  },
  paused: {
    label: STATUS_LABELS.paused,
    className: BADGE_COLORS.warning,
    description: 'Temporarily inactive',
  },
  completed: {
    label: STATUS_LABELS.completed,
    className: BADGE_COLORS.info,
    description: 'Successfully finished',
  },
  cancelled: {
    label: STATUS_LABELS.cancelled,
    className: BADGE_COLORS.error,
    description: 'No longer active',
  },
  archived: {
    label: STATUS_LABELS.archived,
    className: BADGE_COLORS.muted,
    description: 'Stored for reference',
  },
  // Event-specific live states
  published: {
    label: STATUS_LABELS.published,
    className: BADGE_COLORS.success,
    description: 'Live and accepting registrations',
  },
  open: {
    label: STATUS_LABELS.open,
    className: BADGE_COLORS.success,
    description: 'Open for registrations or applications',
  },
  full: {
    label: STATUS_LABELS.full,
    className: BADGE_COLORS.amber,
    description: 'Capacity reached — no more registrations',
  },
  ongoing: {
    label: STATUS_LABELS.ongoing,
    className: BADGE_COLORS.info,
    description: 'Currently in progress',
  },
  // Investment-specific live states
  funded: {
    label: STATUS_LABELS.funded,
    className: BADGE_COLORS.success,
    description: 'Fully funded and running',
  },
  closed: {
    label: STATUS_LABELS.closed,
    className: BADGE_COLORS.muted,
    description: 'No longer accepting investment',
  },
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get status info for any status string
 * Returns default styling for unknown statuses
 *
 * @example
 * const info = getStatusInfo('active');
 * // { label: STATUS_LABELS.active, className: 'bg-green-100 text-green-700' }
 */
export function getStatusInfo(status: string | null | undefined): StatusInfo {
  if (!status) {
    return { label: 'Unknown', className: BADGE_COLORS.neutral };
  }

  const normalized = status.toLowerCase() as EntityStatus;
  return (
    STATUS_CONFIG[normalized] || {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      className: BADGE_COLORS.neutral,
    }
  );
}

/**
 * Check if a status is considered "public" (visible to others)
 */
export function isPublicStatus(status: string | null | undefined): boolean {
  const publicStatuses: EntityStatus[] = [
    'active',
    'completed',
    // Event live states
    'published',
    'open',
    'full',
    'ongoing',
    // Investment live states
    'funded',
  ];
  return publicStatuses.includes((status?.toLowerCase() || '') as EntityStatus);
}

// ==================== STATUS LISTS ====================

/**
 * Statuses considered "normal" that don't need special visual emphasis
 * (e.g., no extra badge needed on entity cards)
 */
export const NORMAL_VISIBLE_STATUSES: EntityStatus[] = ['active', 'draft', 'published'];
