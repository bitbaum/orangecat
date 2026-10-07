'use client';

/**
 * "Where is it?" — pick one of the venue pages you run, and the event is
 * listed on that page ("Happening here") with its address filled in. Replaces
 * a text box that asked people to paste an asset's UUID.
 *
 * Only places you run are offered; the database refuses any other (see
 * public.can_list_events_at), so the picker can never offer a dead end.
 */

import { useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import Link from 'next/link';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { Venue } from '@/domain/events/venue-page';

interface VenuePickerFieldProps {
  formData: Record<string, unknown>;
  onFieldChange: (field: string, value: unknown) => void;
  disabled?: boolean;
}

export function VenuePickerField({ formData, onFieldChange, disabled }: VenuePickerFieldProps) {
  const [places, setPlaces] = useState<Venue[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch(API_ROUTES.EVENTS.MY_PLACES)
      .then(r => (r.ok ? r.json() : null))
      .then(json => live && setPlaces((json?.data?.places as Venue[]) ?? []))
      .catch(() => live && setPlaces([]));
    return () => {
      live = false;
    };
  }, []);

  const selected = typeof formData.asset_id === 'string' ? formData.asset_id : '';

  function pick(id: string) {
    onFieldChange('asset_id', id || null);
    const place = places?.find(p => p.id === id);
    if (!place) {
      return;
    }
    // Fill only what is empty — never overwrite an address someone typed.
    if (!formData.venue_name) {
      onFieldChange('venue_name', place.title);
    }
    if (!formData.venue_address && place.location) {
      onFieldChange('venue_address', place.location);
    }
  }

  if (formData.is_online === true) {
    return null; // an online event has no door
  }
  if (places === null) {
    return <div className="h-11 w-full animate-pulse rounded-md bg-surface-raised" />;
  }

  if (places.length === 0) {
    return (
      <p className="text-sm text-fg-secondary">
        Running a bar, club or studio? Give it a page and its events show there.{' '}
        <Link
          href={ENTITY_REGISTRY.asset.createPath}
          className="text-fg-primary underline underline-offset-4"
        >
          Create a venue page
        </Link>
      </p>
    );
  }

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-fg-primary">Venue page</span>
      <select
        value={selected}
        disabled={disabled}
        onChange={e => pick(e.target.value)}
        className="min-h-11 w-full rounded-md border border-default bg-surface-base px-3 text-sm text-fg-primary"
      >
        <option value="">Not at one of my venues</option>
        {places.map(p => (
          <option key={p.id} value={p.id}>
            {p.title}
            {p.location ? ` — ${p.location}` : ''}
          </option>
        ))}
      </select>
      <span className="block text-sm text-fg-secondary">
        The event is listed on the venue&apos;s page, under &ldquo;Happening here&rdquo;.
      </span>
    </label>
  );
}
