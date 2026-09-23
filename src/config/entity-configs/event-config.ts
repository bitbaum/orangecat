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
import { EVENT_TYPES, EVENT_CATEGORIES } from '@/config/events';

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
    id: 'date-time',
    title: 'Date & Time',
    description: 'When will your event take place?',
    fields: [
      {
        name: 'start_date',
        label: 'Start Date & Time',
        type: 'text',
        placeholder: 'YYYY-MM-DDTHH:mm',
        required: true,
        hint: 'Format: YYYY-MM-DDTHH:mm (e.g., 2025-02-15T18:00)',
        colSpan: 2,
      },
      {
        name: 'end_date',
        label: 'End Date & Time',
        type: 'text',
        placeholder: 'YYYY-MM-DDTHH:mm',
        hint: 'Leave empty for single-day events. Format: YYYY-MM-DDTHH:mm',
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
        label: 'Timezone',
        type: 'text',
        placeholder: 'UTC',
        hint: 'Default is UTC. Use format like "Europe/Zurich"',
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
      {
        name: 'asset_id',
        label: 'Link to Asset (Optional)',
        type: 'text',
        placeholder: 'UUID of asset if venue is a rented asset',
        hint: "If you're renting a venue from the assets marketplace, link it here",
        showWhen: {
          field: 'is_online',
          value: false,
        },
        colSpan: 2,
      },
    ],
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
        type: 'text',
        placeholder: 'YYYY-MM-DDTHH:mm',
        hint: 'When should people RSVP by? Format: YYYY-MM-DDTHH:mm',
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
  start_date: new Date().toISOString(),
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
});
