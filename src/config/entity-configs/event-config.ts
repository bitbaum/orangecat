/**
 * EVENT ENTITY CONFIGURATION
 *
 * Defines the form structure, validation, and guidance for event creation.
 *
 * Created: 2025-01-28
 * Last Modified: 2025-01-28
 * Last Modified Summary: Initial creation of event entity configuration
 */

import { Calendar } from 'lucide-react';
import { ENTITY_STATUS } from '@/config/database-constants';
import { eventSchema, type EventFormData } from '@/lib/validation';
import { eventGuidanceContent, eventDefaultGuidance } from '@/lib/entity-guidance/event-guidance';
import type { FieldGroup } from '@/components/create/types';
import { EVENT_TEMPLATES, type EventTemplate } from '@/components/create/templates';
import { createEntityConfig } from './base-config-factory';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { WalletSelectorField } from '@/components/create/wallet-selector';
import { VenuePickerField } from '@/components/events/VenuePickerField';
import { EVENT_TYPES, EVENT_CATEGORIES } from '@/config/events';
import { MUSIC_GENRES } from '@/config/event-crew';
import { browserTimeZone, instantToWallTime, supportedTimeZones } from '@/utils/timezone';
import { eventZone } from '@/domain/events/time';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Essential details about your event',
    fields: [
      {
        name: 'title',
        label: 'Event Title',
        type: 'text',
        placeholder: 'e.g., Bitcoin Meetup Zurich, Art Exhibition Opening',
        required: true,
        colSpan: 2,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Describe your event - what will happen, who should attend, what to expect...',
        rows: 5,
        colSpan: 2,
      },
      {
        // The picture on the event's page and in every list. A photo the Cat
        // was sent arrives here on its draft (imageFieldOf).
        name: 'banner_url',
        label: 'Cover picture',
        type: 'image',
        colSpan: 2,
      },
      {
        name: 'event_type',
        label: 'Event Type',
        type: 'select',
        required: true,
        options: [...EVENT_TYPES],
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: EVENT_CATEGORIES.map(cat => ({ value: cat, label: cat })),
      },
    ],
  },
  {
    id: 'sound-and-feel',
    title: 'Music & Vibe',
    description: 'What it will sound and feel like — how people decide it is their night',
    fields: [
      {
        name: 'music_genres',
        label: 'Music',
        type: 'tags',
        placeholder: `e.g., ${MUSIC_GENRES.slice(0, 3).join(', ')}`,
        hint: 'Genres people can expect. They are shown on the page and searchable.',
        colSpan: 2,
      },
      {
        name: 'vibe',
        label: 'Vibe',
        type: 'text',
        placeholder: 'e.g., Rooftop sunset into a warehouse night — come as you are',
        hint: 'One line on the crowd, the dress, the energy',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'date-time',
    title: 'Date & Time',
    description: 'When will your event take place?',
    fields: [
      {
        name: 'start_date',
        label: 'Start Date & Time',
        type: 'datetime',
        required: true,
        hint: 'In the event’s time zone, below.',
        colSpan: 2,
      },
      {
        name: 'end_date',
        label: 'End Date & Time',
        type: 'datetime',
        hint: 'Leave empty for single-day events.',
        colSpan: 2,
      },
      {
        name: 'is_all_day',
        label: 'All Day Event',
        type: 'checkbox',
        colSpan: 2,
      },
      {
        name: 'timezone',
        label: 'Time zone',
        type: 'select',
        options: supportedTimeZones().map(zone => ({
          value: zone,
          label: zone.replace(/_/g, ' '),
        })),
        hint: 'Where the event happens. Times above are read on this clock.',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'location',
    title: 'Location',
    description: 'Where will your event take place?',
    fields: [
      {
        name: 'is_online',
        label: 'Online Event',
        type: 'checkbox',
        colSpan: 2,
      },
      {
        name: 'online_url',
        label: 'Online Event URL',
        type: 'url',
        placeholder: 'https://zoom.us/j/... or https://meet.jit.si/...',
        hint: 'Required for online events',
        showWhen: {
          field: 'is_online',
          value: true,
        },
        colSpan: 2,
      },
      {
        name: 'venue_name',
        label: 'Venue Name',
        type: 'text',
        placeholder: 'e.g., Community Center, Art Gallery',
        showWhen: {
          field: 'is_online',
          value: false,
        },
      },
      {
        name: 'venue_address',
        label: 'Street Address',
        type: 'text',
        placeholder: 'e.g., Bahnhofstrasse 1',
        showWhen: {
          field: 'is_online',
          value: false,
        },
        colSpan: 2,
      },
      {
        name: 'venue_city',
        label: 'City',
        type: 'text',
        placeholder: 'e.g., Zurich',
        showWhen: {
          field: 'is_online',
          value: false,
        },
      },
      {
        name: 'venue_postal_code',
        label: 'Postal Code',
        type: 'text',
        placeholder: 'e.g., 8001',
        showWhen: {
          field: 'is_online',
          value: false,
        },
      },
      {
        name: 'venue_country',
        label: 'Country',
        type: 'text',
        placeholder: 'e.g., Switzerland',
        showWhen: {
          field: 'is_online',
          value: false,
        },
        colSpan: 2,
      },
    ],
  },
  {
    id: 'venue-page',
    title: 'Venue page',
    description: 'At a bar, club or studio you run? List the event on its page.',
    customComponent: VenuePickerField,
  },
  {
    id: 'capacity',
    title: 'Capacity & RSVP',
    description: 'Manage attendance and registrations',
    fields: [
      {
        name: 'max_attendees',
        label: 'Maximum Attendees',
        type: 'number',
        placeholder: 'e.g., 50',
        min: 1,
        hint: 'Leave empty for unlimited capacity',
        colSpan: 2,
      },
      {
        name: 'requires_rsvp',
        label: 'Requires RSVP',
        type: 'checkbox',
        colSpan: 2,
      },
      {
        name: 'rsvp_deadline',
        label: 'RSVP Deadline',
        type: 'datetime',
        hint: 'When should people RSVP by?',
        showWhen: {
          field: 'requires_rsvp',
          value: true,
        },
        colSpan: 2,
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing & Funding',
    description: 'Set ticket prices or funding goals',
    fields: [
      {
        name: 'is_free',
        label: 'Free Event',
        type: 'checkbox',
        colSpan: 2,
      },
      {
        name: 'ticket_price',
        label: 'Ticket Price',
        type: 'currency',
        placeholder: '50.00',
        min: 1,
        hint: 'Price per ticket. Enter in your preferred currency. All transactions settle in Bitcoin. Tip: price in BTC for Bitcoin-native pricing (no conversion).',
        showWhen: {
          field: 'is_free',
          value: false,
        },
        colSpan: 2,
      },
      {
        name: 'funding_goal',
        label: 'Funding Goal (Optional)',
        type: 'currency',
        isGoal: true,
        placeholder: '10000.00',
        min: 1,
        hint: 'Optional: Set a funding goal to cover event costs.',
        colSpan: 2,
      },
    ],
  },
  {
    id: 'bitcoin',
    title: 'Pay into',
    description: 'Where money for this page should land',
    customComponent: WalletSelectorField,
    fields: [
      { name: 'bitcoin_address', label: 'Bitcoin Address', type: 'bitcoin_address' },
      { name: 'lightning_address', label: 'Lightning Address', type: 'text' },
    ],
  },
  {
    id: 'visibility',
    title: 'Profile Visibility',
    description: 'Control where this event appears',
    fields: [
      {
        name: 'show_on_profile',
        label: 'Show on Public Profile',
        type: 'checkbox',
        hint: 'When enabled, this event will appear on your public profile page',
        colSpan: 2,
      },
    ],
  },
];

// ==================== DEFAULT VALUES ====================

const defaultValues: EventFormData = {
  title: '',
  description: '',
  category: '',
  event_type: 'meetup',
  tags: [],
  music_genres: [],
  vibe: '',
  start_date: '',
  end_date: null,
  timezone: 'UTC',
  is_all_day: false,
  is_recurring: false,
  recurrence_pattern: null,
  venue_name: '',
  venue_address: '',
  venue_city: '',
  venue_country: '',
  venue_postal_code: '',
  latitude: null,
  longitude: null,
  is_online: false,
  online_url: '',
  asset_id: null,
  max_attendees: null,
  requires_rsvp: true,
  rsvp_deadline: null,
  ticket_price: null,
  currency: undefined, // Will be set from user's profile preference in EntityForm
  is_free: true,
  funding_goal: null,
  bitcoin_address: '',
  lightning_address: '',
  images: [],
  thumbnail_url: '',
  banner_url: '',
  video_url: '',
  status: ENTITY_STATUS.DRAFT,
  // Checked by default — matches the DB show_on_profile default and other configs.
  show_on_profile: true,
};

// ==================== EXPORT CONFIG ====================

export const eventConfig = createEntityConfig<EventFormData>({
  entityType: 'event',
  name: 'Event',
  namePlural: 'Events',
  icon: Calendar,
  colorTheme: 'tiffany',
  backUrl: ENTITY_REGISTRY['event'].basePath,
  successUrl: `${ENTITY_REGISTRY['event'].basePath}/[id]`,
  pageTitle: 'Create Event',
  pageDescription: 'Organize an in-person gathering or meetup',
  formTitle: 'Event Details',
  formDescription:
    'Fill in the information for your event. You can always edit these details later.',
  fieldGroups,
  validationSchema: eventSchema,
  defaultValues,
  guidanceContent: eventGuidanceContent,
  defaultGuidance: eventDefaultGuidance,
  templates: EVENT_TEMPLATES as unknown as EventTemplate[],
  // The form edits wall-clock time on the event's own clock. A new event
  // starts on this browser's zone (it used to default to UTC, so a creator in
  // Zurich typing 19:00 published 21:00); stored instants, template defaults
  // and any value with an offset are shown as that zone's wall time, so an
  // edit cannot keep a stray "+00:00" and shift the night (audit 2026-10-07).
  deriveInitialValues: data => {
    const zone =
      !(data as Record<string, unknown>).id && (!data.timezone || data.timezone === 'UTC')
        ? browserTimeZone()
        : eventZone(data);
    const wall = (v: unknown) =>
      v instanceof Date
        ? instantToWallTime(v.toISOString(), zone)
        : typeof v === 'string' && v
          ? instantToWallTime(v, zone)
          : v;
    return {
      timezone: zone,
      start_date: wall(data.start_date) as string,
      end_date: wall(data.end_date) as string | null,
      rsvp_deadline: wall(data.rsvp_deadline) as string | null,
    };
  },
});
