'use client';

/**
 * What the people of a place would choose — the public aggregate for the
 * region the person named. Shows each locality with enough declarations, and
 * says plainly when there are not enough yet: an empty card that explains
 * itself is the honest state for a feature on its first day.
 */
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { CIVIC_LEVELS } from '@/config/civic-split';
import { fetchPlaceAggregate, type PlaceAggregateResponse } from '@/services/civic-split/client';
import { SplitBar } from './ShareSliders';

interface PlaceAggregateCardProps {
  countryCode: string;
  region: string;
}

export default function PlaceAggregateCard({ countryCode, region }: PlaceAggregateCardProps) {
  const [data, setData] = useState<PlaceAggregateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!/^[A-Z]{2}$/.test(countryCode) || !region.trim()) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetchPlaceAggregate(countryCode, region)
      .then(res => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, region]);

  if (!data && !error) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="font-heading text-lg text-fg-primary">
            What {region.trim()} would choose
          </h2>
          <p className="mt-1 text-sm text-fg-secondary">
            The average declared split per place. A place appears once {data?.min_group ?? 3} people
            there have declared.
          </p>
        </div>
        {error && <p className="text-sm text-status-negative">{error}</p>}
        {data && data.places.length === 0 && (
          <p className="rounded-lg border border-default bg-surface-raised p-4 text-sm text-fg-secondary">
            Nobody in {region.trim()} has reached that number yet. Yours counts towards it — tell
            the people around you.
          </p>
        )}
        {data && data.places.length > 0 && (
          <ul className="space-y-4">
            {data.places.map(place => (
              <li key={`${place.region}|${place.locality}`} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-fg-primary">{place.locality}</span>
                  <span className="flex items-center gap-1 text-xs text-fg-tertiary">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {place.count}
                  </span>
                </div>
                <SplitBar shares={place.shares} />
                <p className="text-xs text-fg-tertiary">
                  {CIVIC_LEVELS.map(l => `${l.label} ${place.shares[l.id]}%`).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
