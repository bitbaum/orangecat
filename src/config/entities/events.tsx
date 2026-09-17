/**
 * Event Entity Configuration
 *
 * Created: 2025-01-30
 * Last Modified: 2026-01-04
 * Last Modified Summary: Updated to convert prices to user's preferred currency
 */

import { EntityConfig } from '@/types/entity';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { convert, formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { getStatusBadge } from '@/config/entity-status';
import type { Currency } from '@/types/settings';
import { GRADIENTS } from '@/config/gradients';
import { formatDate } from '@/utils/dates';

// Event type from database - matches events table schema
export interface Event {
  id: string;
  user_id: string;
  organization_id?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  event_type: string;
  tags?: string[] | null;
  start_date: string;
  end_date?: string | null;
  timezone?: string | null;
  is_all_day?: boolean | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: Record<string, unknown> | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_city?: string | null;
  venue_country?: string | null;
  venue_postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_online?: boolean | null;
  online_url?: string | null;
  asset_id?: string | null;
  max_attendees?: number | null;
  current_attendees?: number | null;
  requires_rsvp?: boolean | null;
  rsvp_deadline?: string | null;
  ticket_price?: number | null;
  currency?: string | null;
  is_free?: boolean | null;
  funding_goal?: number | null;
  bitcoin_address?: string | null;
  lightning_address?: string | null;
  images?: string[] | null;
  thumbnail_url?: string | null;
  banner_url?: string | null;
  video_url?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown; // Index signature for BaseEntity compatibility
}

export const eventEntityConfig: EntityConfig<Event> = {
  name: ENTITY_REGISTRY['event'].name,
  namePlural: ENTITY_REGISTRY['event'].namePlural,
  colorTheme: ENTITY_REGISTRY['event'].colorTheme,

  listPath: ENTITY_REGISTRY['event'].basePath,
  detailPath: id => `${ENTITY_REGISTRY['event'].basePath}/${id}`,
  createPath: ENTITY_REGISTRY['event'].createPath,
  editPath: id => `${ENTITY_REGISTRY['event'].createPath}?edit=${id}`,

  entityType: ENTITY_REGISTRY['event'].type,
  apiEndpoint: ENTITY_REGISTRY['event'].apiEndpoint,

  makeHref: event => `${ENTITY_REGISTRY['event'].basePath}/${event.id}`,

  makeCardProps: (event, userCurrency?: string) => {
    // Display price in user's preferred currency (or event's currency)
    const displayCurrency = (userCurrency ||
      event.currency ||
      PLATFORM_DEFAULT_CURRENCY) as Currency;
    const priceLabel = event.is_free
      ? 'Free'
      : event.ticket_price && event.currency
        ? (() => {
            // If event currency matches display currency, use directly
            if (event.currency === displayCurrency) {
              return formatCurrency(event.ticket_price, displayCurrency);
            }
            // Otherwise convert from event's currency to display currency
            const converted = convert(
              event.ticket_price,
              event.currency as Currency,
              displayCurrency
            );
            return formatCurrency(converted, displayCurrency);
          })()
        : undefined;

    // Build metadata (category, location, date)
    const metadataParts: string[] = [];
    if (event.category) {
      metadataParts.push(event.category);
    }
    if (event.venue_city) {
      metadataParts.push(event.venue_city);
    } else if (event.is_online) {
      metadataParts.push('Online');
    }
    if (event.start_date) {
      try {
        const date = new Date(event.start_date);
        metadataParts.push(formatDate(date));
      } catch {
        // Ignore date parsing errors
      }
    }

    const statusBadge = getStatusBadge('event', event.status);

    return {
      priceLabel,
      badge: statusBadge?.label,
      badgeVariant: statusBadge?.variant,
      metadata:
        metadataParts.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs text-fg-secondary">
            {metadataParts.map((part, idx) => (
              <span key={idx}>{part}</span>
            ))}
          </div>
        ) : undefined,
      showEditButton: true,
      editHref: `${ENTITY_REGISTRY['event'].createPath}?edit=${event.id}`,
      // Removed duplicate actions button - edit icon overlay is sufficient
    };
  },

  emptyState: {
    title: 'No events yet',
    description:
      'Organize your first in-person gathering or meetup with Bitcoin-powered ticketing.',
    action: (
      <Link href={ROUTES.DASHBOARD.EVENTS_CREATE}>
        <Button className={GRADIENTS.brandBlue}>Create Event</Button>
      </Link>
    ),
  },

  gridCols: {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
};
