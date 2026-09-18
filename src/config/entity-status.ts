import { STATUS, ENTITY_STATUS as GENERIC_ENTITY_STATUS } from '@/config/database-constants';
import { STATUS_LABELS } from './status-labels';
import { type EntityType } from '@/config/entity-registry';

export type BadgeVariant = 'success' | 'default' | 'warning' | 'destructive' | 'info' | 'error';

export interface EntityStatusBadge {
  label: string;
  variant: BadgeVariant;
}

export type ClientStatusIntent =
  'draft' | 'active' | 'paused' | 'completed' | 'cancelled' | 'archived';

export const CLIENT_STATUS_INTENTS = [
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled',
  'archived',
] as const satisfies readonly ClientStatusIntent[];

export const ENTITY_PUBLISH_STATUS: Partial<Record<EntityType, string>> = {
  event: STATUS.EVENTS.PUBLISHED,
  investment: STATUS.INVESTMENTS.OPEN,
};

export const LIVE_ENTITY_STATUSES = new Set<string>([
  GENERIC_ENTITY_STATUS.ACTIVE,
  STATUS.EVENTS.PUBLISHED,
  STATUS.EVENTS.OPEN,
  STATUS.EVENTS.FULL,
  STATUS.EVENTS.ONGOING,
  STATUS.INVESTMENTS.OPEN,
  STATUS.INVESTMENTS.FUNDED,
]);

export const ENTITY_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'published', 'open'],
  active: ['paused', 'completed', 'cancelled', 'draft', 'archived'],
  paused: ['active', 'draft'],
  completed: ['draft'],
  cancelled: ['draft'],
  archived: ['draft'],
  published: ['open', 'paused', 'cancelled', 'draft'],
  open: ['full', 'ongoing', 'paused', 'cancelled', 'draft'],
  full: ['open', 'ongoing', 'cancelled'],
  ongoing: ['completed', 'cancelled'],
  funded: ['active', 'closed', 'cancelled'],
  closed: ['draft'],
};

const STATUS_BADGES = {
  project: {
    [STATUS.PROJECTS.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.PROJECTS.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.PROJECTS.PAUSED]: { label: STATUS_LABELS.paused, variant: 'warning' },
    [STATUS.PROJECTS.COMPLETED]: { label: STATUS_LABELS.completed, variant: 'success' },
    [STATUS.PROJECTS.CANCELLED]: { label: STATUS_LABELS.cancelled, variant: 'destructive' },
  },
  product: {
    [STATUS.PRODUCTS.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.PRODUCTS.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.PRODUCTS.PAUSED]: { label: STATUS_LABELS.paused, variant: 'warning' },
    [STATUS.PRODUCTS.SOLD_OUT]: { label: 'Sold Out', variant: 'destructive' },
  },
  service: {
    [STATUS.SERVICES.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.SERVICES.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.SERVICES.PAUSED]: { label: STATUS_LABELS.paused, variant: 'warning' },
    [STATUS.SERVICES.UNAVAILABLE]: { label: 'Unavailable', variant: 'destructive' },
  },
  cause: {
    [STATUS.CAUSES.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.CAUSES.COMPLETED]: { label: STATUS_LABELS.completed, variant: 'default' },
    [STATUS.CAUSES.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.CAUSES.CANCELLED]: { label: STATUS_LABELS.cancelled, variant: 'destructive' },
  },
  ai_assistant: {
    [STATUS.AI_ASSISTANTS.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.AI_ASSISTANTS.PAUSED]: { label: STATUS_LABELS.paused, variant: 'warning' },
    [STATUS.AI_ASSISTANTS.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.AI_ASSISTANTS.ARCHIVED]: { label: STATUS_LABELS.archived, variant: 'default' },
  },
  loan: {
    [STATUS.LOANS.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.LOANS.PAID_OFF]: { label: 'Paid Off', variant: 'success' },
    [STATUS.LOANS.REFINANCED]: { label: 'Refinanced', variant: 'default' },
    [STATUS.LOANS.DEFAULTED]: { label: 'Defaulted', variant: 'destructive' },
    [STATUS.LOANS.CANCELLED]: { label: STATUS_LABELS.cancelled, variant: 'warning' },
  },
  investment: {
    [STATUS.INVESTMENTS.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.INVESTMENTS.OPEN]: { label: STATUS_LABELS.open, variant: 'success' },
    [STATUS.INVESTMENTS.FUNDED]: { label: STATUS_LABELS.funded, variant: 'success' },
    [STATUS.INVESTMENTS.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.INVESTMENTS.CLOSED]: { label: STATUS_LABELS.closed, variant: 'default' },
    [STATUS.INVESTMENTS.CANCELLED]: { label: STATUS_LABELS.cancelled, variant: 'warning' },
  },
  event: {
    [STATUS.EVENTS.PUBLISHED]: { label: STATUS_LABELS.published, variant: 'success' },
    [STATUS.EVENTS.OPEN]: { label: STATUS_LABELS.open, variant: 'success' },
    [STATUS.EVENTS.FULL]: { label: STATUS_LABELS.full, variant: 'warning' },
    [STATUS.EVENTS.ONGOING]: { label: STATUS_LABELS.ongoing, variant: 'success' },
    [STATUS.EVENTS.COMPLETED]: { label: STATUS_LABELS.completed, variant: 'default' },
    [STATUS.EVENTS.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.EVENTS.CANCELLED]: { label: STATUS_LABELS.cancelled, variant: 'destructive' },
  },
  research: {
    [STATUS.RESEARCH.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.RESEARCH.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.RESEARCH.PAUSED]: { label: STATUS_LABELS.paused, variant: 'warning' },
    [STATUS.RESEARCH.COMPLETED]: { label: STATUS_LABELS.completed, variant: 'default' },
    [STATUS.RESEARCH.CANCELLED]: { label: STATUS_LABELS.cancelled, variant: 'destructive' },
  },
  asset: {
    [STATUS.ASSETS.DRAFT]: { label: STATUS_LABELS.draft, variant: 'default' },
    [STATUS.ASSETS.ACTIVE]: { label: STATUS_LABELS.active, variant: 'success' },
    [STATUS.ASSETS.ARCHIVED]: { label: STATUS_LABELS.archived, variant: 'default' },
  },
} as const satisfies Partial<Record<EntityType, Record<string, EntityStatusBadge>>>;

/**
 * The per-entity status table — the SSOT for what a status looks like when we
 * know which entity it belongs to. Exported so a test can walk every entry and
 * assert the other surfaces agree with it; nothing else should read it
 * directly, use `getStatusBadge` or `getStatusInfo`.
 */
export const ENTITY_STATUS_BADGES: Partial<Record<EntityType, Record<string, EntityStatusBadge>>> =
  STATUS_BADGES;

export function resolvePublishStatus(entityType: EntityType, clientStatus: string): string {
  return clientStatus === GENERIC_ENTITY_STATUS.ACTIVE
    ? (ENTITY_PUBLISH_STATUS[entityType] ?? clientStatus)
    : clientStatus;
}

export function getAllowedStatusTransitions(status: string): string[] {
  return ENTITY_STATUS_TRANSITIONS[status.toLowerCase()] ?? [];
}

export function getStatusBadge(
  entityType: EntityType,
  status: string | null | undefined
): EntityStatusBadge | undefined {
  if (!status) {
    return undefined;
  }
  return ENTITY_STATUS_BADGES[entityType]?.[status];
}

export function isLiveEntityStatus(status: string | null | undefined): boolean {
  return Boolean(status && LIVE_ENTITY_STATUSES.has(status));
}
