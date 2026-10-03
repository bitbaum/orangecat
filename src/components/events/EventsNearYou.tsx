'use client';

/**
 * "What's on near me tonight?" — upcoming public events around the visitor,
 * nearest first, filterable by the music. Uses the browser's location when
 * granted, or a place the visitor types (geocoded by OpenStreetMap); never
 * stores either.
 */

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { LocateFixed, MapPin, Music, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { MUSIC_GENRES } from '@/config/event-crew';
import { formatCurrency } from '@/services/currency';
import { searchNominatim } from '@/lib/nominatim';
import type { NearbyEvent } from '@/domain/events/nearby';

type Point = { lat: number; lng: number; label: string };

const RADII_KM = [5, 25, 100] as const;

export default function EventsNearYou() {
  const [point, setPoint] = useState<Point | null>(null);
  const [place, setPlace] = useState('');
  const [genre, setGenre] = useState('');
  const [radius, setRadius] = useState<number>(25);
  const [events, setEvents] = useState<NearbyEvent[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(at: Point, nextGenre = genre, nextRadius = radius) {
    setPoint(at);
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams({
        lat: String(at.lat),
        lng: String(at.lng),
        radius_km: String(nextRadius),
        ...(nextGenre && { genre: nextGenre }),
      });
      const res = await fetch(`/api/events/nearby?${params}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Search failed');
      }
      setEvents(json.data.events as NearbyEvent[]);
    } catch {
      setStatus('Could not load events nearby. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus('Your browser does not share a location — type a place instead.');
      return;
    }
    setStatus('Finding you…');
    navigator.geolocation.getCurrentPosition(
      pos => search({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'you' }),
      () => setStatus('Location was not shared — type a place instead.'),
      { timeout: 10000, maximumAge: 300000 }
    );
  }

  async function searchPlace(e: React.FormEvent) {
    e.preventDefault();
    const [hit] = await searchNominatim(place, 1);
    if (hit?.lat === undefined || hit.lon === undefined) {
      setStatus(`Could not find "${place}". Try a city or a street.`);
      return;
    }
    search({ lat: hit.lat, lng: hit.lon, label: hit.mainText });
  }

  const refilter = (nextGenre: string, nextRadius: number) => {
    setGenre(nextGenre);
    setRadius(nextRadius);
    if (point) {
      search(point, nextGenre, nextRadius);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="accent" onClick={useMyLocation} disabled={loading}>
          <LocateFixed className="mr-2 h-4 w-4" />
          Near me
        </Button>
        <form onSubmit={searchPlace} className="flex min-w-0 flex-1 gap-2">
          <input
            value={place}
            onChange={e => setPlace(e.target.value)}
            placeholder="Or a place: Zürich, Lisbon, 10115 Berlin…"
            aria-label="Place to search around"
            className="min-h-11 w-full min-w-0 rounded-md border border-default bg-surface-base px-3 text-sm text-fg-primary"
          />
          <Button type="submit" variant="outline" disabled={loading || place.trim().length < 2}>
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={genre}
          onChange={e => refilter(e.target.value, radius)}
          aria-label="Music"
          className="min-h-11 rounded-md border border-default bg-surface-base px-3 text-sm text-fg-primary"
        >
          <option value="">Any music</option>
          {MUSIC_GENRES.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={radius}
          onChange={e => refilter(genre, Number(e.target.value))}
          aria-label="Distance"
          className="min-h-11 rounded-md border border-default bg-surface-base px-3 text-sm text-fg-primary"
        >
          {RADII_KM.map(r => (
            <option key={r} value={r}>
              Within {r} km
            </option>
          ))}
        </select>
      </div>

      {status && <p className="text-sm text-fg-secondary">{status}</p>}

      {events && events.length === 0 && (
        <p className="text-sm text-fg-secondary">
          Nothing on within {radius} km{genre ? ` playing ${genre}` : ''} yet. Widen the distance,
          or{' '}
          <Link href={ENTITY_REGISTRY.event.createPath} className="underline underline-offset-4">
            host the first one
          </Link>
          .
        </p>
      )}

      {events && events.length > 0 && (
        <ul className="divide-y divide-default rounded-xl border border-default">
          {events.map(ev => (
            <li key={ev.id}>
              <Link
                href={ROUTES.EVENTS.VIEW(ev.id)}
                className="flex flex-col gap-1 p-4 transition-colors hover:bg-surface-raised"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 break-words font-medium text-fg-primary">
                    {ev.title}
                  </span>
                  <span className="shrink-0 text-sm text-fg-secondary">
                    {ev.distance_km < 1 ? '<1' : Math.round(ev.distance_km)} km
                  </span>
                </div>
                <div className="text-sm text-fg-secondary">
                  {format(new Date(ev.start_date), 'EEE d MMM, HH:mm')}
                  {' · '}
                  {ev.is_free || !ev.ticket_price
                    ? 'Free'
                    : formatCurrency(Number(ev.ticket_price), ev.currency || 'CHF')}
                </div>
                {(ev.venue_name || ev.venue_city) && (
                  <div className="flex items-center gap-1 text-sm text-fg-secondary">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 break-words">
                      {[ev.venue_name, ev.venue_city].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {ev.music_genres.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-fg-secondary">
                    <Music className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 break-words">{ev.music_genres.join(' · ')}</span>
                  </div>
                )}
                {ev.vibe && <div className="break-words text-sm text-fg-primary">{ev.vibe}</div>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
