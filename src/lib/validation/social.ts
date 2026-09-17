import { z } from 'zod';
import { CURRENCY_CODES } from '@/config/currencies';
import { EVENT_TYPES, EVENT_STATUSES } from '@/config/events';
import { STATUS } from '@/config/database-constants';
import { DAYS_OF_WEEK, RECURRENCE_FREQUENCIES } from '@/config/schedule';
import { lightningAddressSchema, optionalText, optionalUrl, webUrl } from './base';

/**
 * Recurrence pattern for events.
 * Standard iCalendar-style recurrence rule stored as JSONB in the database.
 *
 * Uses .passthrough() to allow additional fields without breaking existing data.
 */
const recurrencePatternSchema = z
  .object({
    frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
    interval: z.number().int().positive().max(365).optional(),
    end_date: z.string().optional().nullable(),
    count: z.number().int().positive().max(1000).optional().nullable(),
    days_of_week: z.array(z.enum(DAYS_OF_WEEK)).optional(),
    day_of_month: z.number().int().min(1).max(31).optional().nullable(),
    month_of_year: z.number().int().min(1).max(12).optional().nullable(),
  })
  .passthrough();

// Event validation
export const eventSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title must be at most 100 characters'),
    description: optionalText(2000),
    category: optionalText(50),
    event_type: z.enum(EVENT_TYPES.map(t => t.value) as [string, ...string[]]).default('meetup'),
    tags: z.array(z.string()).optional().default([]),

    // Date & Time
    start_date: z
      .string()
      .or(z.date())
      .refine(val => {
        const date = typeof val === 'string' ? new Date(val) : val;
        return !isNaN(date.getTime());
      }, 'Start date is required and must be valid'),
    end_date: z
      .string()
      .or(z.date())
      .optional()
      .nullable()
      .refine(val => {
        if (!val) {
          return true;
        }
        const date = typeof val === 'string' ? new Date(val) : val;
        return !isNaN(date.getTime());
      }, 'End date must be valid'),
    timezone: z.string().max(50).default('UTC'),
    is_all_day: z.boolean().default(false),
    is_recurring: z.boolean().default(false),
    recurrence_pattern: recurrencePatternSchema.optional().nullable(),

    // Location
    venue_name: optionalText(200),
    venue_address: optionalText(500),
    venue_city: optionalText(100),
    venue_country: optionalText(100),
    venue_postal_code: optionalText(20),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    is_online: z.boolean().default(false),
    online_url: optionalUrl(),
    asset_id: z.string().guid().optional().nullable().or(z.literal('')),

    // Capacity & Attendance
    max_attendees: z.number().int().positive().optional().nullable(),
    requires_rsvp: z.boolean().default(true),
    rsvp_deadline: z
      .string()
      .or(z.date())
      .optional()
      .nullable()
      .refine(val => {
        if (!val) {
          return true;
        }
        const date = typeof val === 'string' ? new Date(val) : val;
        return !isNaN(date.getTime());
      }, 'RSVP deadline must be valid'),

    // Pricing & Funding
    // Amounts stored in user's currency (not satoshis)
    ticket_price: z.number().positive().optional().nullable(),
    currency: z.enum(CURRENCY_CODES).optional(),
    is_free: z.boolean().default(false),
    funding_goal: z.number().positive().optional().nullable(),
    bitcoin_address: optionalText(),
    lightning_address: lightningAddressSchema,

    // Media
    images: z.array(webUrl()).optional().default([]),
    thumbnail_url: optionalUrl(),
    banner_url: optionalUrl(),
    video_url: optionalUrl(),

    // Status
    status: z.enum(EVENT_STATUSES).default(STATUS.EVENTS.DRAFT),

    // Public-profile visibility toggle (DB show_on_profile, default true).
    // Optional/no-default — see userProductSchema note. Was absent → the form
    // checkbox was silently stripped by zod on submit.
    show_on_profile: z.boolean().optional(),
  })
  .refine(
    data => {
      // If not free, either ticket_price or funding_goal must be set
      if (!data.is_free && !data.ticket_price && !data.funding_goal) {
        return false;
      }
      return true;
    },
    {
      message: 'Either ticket price or funding goal must be set for paid events',
      path: ['ticket_price'],
    }
  )
  .refine(
    data => {
      // If online, online_url should be provided
      if (data.is_online && !data.online_url) {
        return false;
      }
      return true;
    },
    {
      message: 'Online URL is required for online events',
      path: ['online_url'],
    }
  );

/** Channel / marketing waitlist sign-up (shared by API route and channel page). */
export const waitlistSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  source: z.string().max(100).optional(),
  referrer: z.string().max(500).optional(),
});

export type WaitlistFormData = z.infer<typeof waitlistSchema>;

// Types
export type EventFormData = z.infer<typeof eventSchema>;
