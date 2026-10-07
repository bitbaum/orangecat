/**
 * Event Entity Configuration - Single Source of Truth
 *
 * Display labels for event types.
 * Components should import from here instead of defining inline.
 */

import { STATUS } from '@/config/database-constants';

// ==================== EVENT TYPES ====================

export const EVENT_TYPES = [
  { value: 'meetup', label: 'Meetup' },
  // Added 2026-10-07: a concert is what people most often make here, and it
  // was filed under Other. The events table's check constraint carries the
  // same list (migration 20261007190000).
  { value: 'concert', label: 'Concert' },
  { value: 'conference', label: 'Conference' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'party', label: 'Party' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'festival', label: 'Festival' },
  { value: 'retreat', label: 'Retreat' },
  { value: 'other', label: 'Other' },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]['value'];

// ==================== EVENT CATEGORIES ====================

export const EVENT_CATEGORIES = [
  'Social',
  'Business',
  'Education',
  'Arts & Culture',
  'Technology',
  'Sports & Fitness',
  'Food & Drink',
  'Music',
  'Networking',
  'Community',
  'Other',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

// ==================== GROUP EVENT TYPES (internal/governance use) ====================

export const GROUP_EVENT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'assembly', label: 'Assembly' },
] as const;

export type GroupEventType = (typeof GROUP_EVENT_TYPES)[number]['value'];

// ==================== LOCATION TYPES ====================

export const EVENT_LOCATION_TYPES = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In Person' },
  { value: 'hybrid', label: 'Hybrid' },
] as const;

export type EventLocationType = (typeof EVENT_LOCATION_TYPES)[number]['value'];

// ==================== DERIVED LOOKUP MAPS ====================

export const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_TYPES.map(t => [t.value, t.label])
);

// ==================== EVENT STATUSES ====================

export type EventStatus = (typeof STATUS.EVENTS)[keyof typeof STATUS.EVENTS];
export const EVENT_STATUSES = Object.values(STATUS.EVENTS) as [EventStatus, ...EventStatus[]];

/**
 * Statuses in which anyone may see an event — the same set as the events
 * SELECT policy ("Events viewable if published or owned"). Draft and cancelled
 * stay with the organizer. The public page, its metadata and /api/events read
 * this; none restates it.
 */
export const EVENT_PUBLIC_STATUSES: readonly EventStatus[] = [
  STATUS.EVENTS.PUBLISHED,
  STATUS.EVENTS.OPEN,
  STATUS.EVENTS.FULL,
  STATUS.EVENTS.ONGOING,
  STATUS.EVENTS.COMPLETED,
];

/**
 * Where the Cat may take an event's cover from: the photo the person just
 * sent, or an image generated with their own AI key. Nothing else — a model
 * asked for a picture URL invents one.
 */
export const EVENT_COVER_SOURCES = ['chat_photo', 'generate'] as const;
export type EventCoverSource = (typeof EVENT_COVER_SOURCES)[number];
