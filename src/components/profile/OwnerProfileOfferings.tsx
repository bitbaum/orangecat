'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import type { OwnOfferings } from '@/domain/profile/offerings';
import ProfileOfferings from './ProfileOfferings';

/** Only mounted on the signed-in owner's profile; private data comes from an owned route. */
export default function OwnerProfileOfferings() {
  const [state, setState] = useState<OwnOfferings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(API_ROUTES.CAT.OFFERINGS, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Could not load your offerings. Please try again.');
      }
      const result = await response.json();
      setState(result.data);
    } catch {
      setError('Could not load your offerings. Please try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeSharing() {
    if (!state || inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(API_ROUTES.CAT.OFFERINGS, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !state.enabled }),
      });
      if (!response.ok) {
        throw new Error('Sharing was not changed. Please try again.');
      }
      const result = await response.json();
      setState(result.data);
    } catch {
      setState(null);
      setError('Could not confirm your sharing choice. Try again to load its current status.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="mt-4" aria-label="Your offerings and sharing">
      <div className="space-y-3 rounded-md border border-subtle bg-surface-raised/40 p-4">
        <h2 className="text-sm font-semibold text-fg-primary">
          {state
            ? state.enabled
              ? 'Your offerings are public'
              : 'Your offerings are private'
            : 'Your offerings'}
        </h2>
        <p className="mb-0 text-sm text-fg-secondary">
          Review the card below before sharing. When public, these offerings and future updates from
          Cat are visible to everyone. Your goals, constraints and motivation stay private.
        </p>
        {error && (
          <p role="alert" className="mb-0 text-sm text-fg-primary">
            {error}
          </p>
        )}
        {state ? (
          <Button
            type="button"
            className="min-h-11"
            variant={state.enabled ? 'outline' : 'primary'}
            onClick={() => void changeSharing()}
            disabled={busy}
            isLoading={busy}
          >
            {state.enabled ? 'Hide offerings' : 'Make offerings public'}
          </Button>
        ) : error ? (
          <Button type="button" className="min-h-11" variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        ) : (
          <p role="status" className="mb-0 text-sm text-fg-secondary">
            Loading your offerings…
          </p>
        )}
      </div>
      {state && <ProfileOfferings economicProfile={state.offerings} isOwnProfile />}
    </section>
  );
}
