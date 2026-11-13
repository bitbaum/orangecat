'use client';

/**
 * CatInterestsManager — see and control what you are publicly findable for.
 *
 * Interests are the one thing Cat writes that other people can see, so this
 * panel states that plainly and makes removal one click. Add is here too: a
 * user should never have to talk to an AI to change what is public about them.
 */

import { useCallback, useEffect, useState } from 'react';
import { Compass, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface Interest {
  id: string;
  topic: string;
  source: 'cat' | 'manual';
}

export function CatInterestsManager() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API_ROUTES.CAT.INTERESTS);
      if (!res.ok) {
        throw new Error('failed');
      }
      const json = await res.json();
      setInterests((json?.data?.interests ?? []) as Interest[]);
    } catch (err) {
      logger.error('Failed to load interests', err, 'CatInterests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = useCallback(async () => {
    const topic = draft.trim();
    if (!topic) {
      return;
    }
    setIsAdding(true);
    try {
      const res = await fetch(API_ROUTES.CAT.INTERESTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(apiErrorMessage(json, 'Could not add that interest'));
        return;
      }
      setDraft('');
      await load();
      toast.success(
        json?.data?.alreadyPublished
          ? 'You already had that interest'
          : `"${json?.data?.topic ?? topic}" is now discoverable`
      );
    } catch (err) {
      logger.error('Failed to add interest', err, 'CatInterests');
      toast.error('Could not add that interest');
    } finally {
      setIsAdding(false);
    }
  }, [draft, load]);

  const handleRemove = useCallback(async (interest: Interest) => {
    setRemoving(interest.id);
    try {
      const res = await fetch(
        `${API_ROUTES.CAT.INTERESTS}?topic=${encodeURIComponent(interest.topic)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        throw new Error('failed');
      }
      setInterests(prev => prev.filter(i => i.id !== interest.id));
      toast.success(`Removed "${interest.topic}"`);
    } catch (err) {
      logger.error('Failed to remove interest', err, 'CatInterests');
      toast.error('Could not remove that interest');
    } finally {
      setRemoving(null);
    }
  }, []);

  return (
    <section className="rounded-lg border border-default bg-surface-base p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-md bg-surface-raised p-2">
          <Compass className="h-5 w-5 text-fg-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-fg-primary">What you&apos;re findable for</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            These topics are <strong className="text-fg-primary">public</strong> — anyone signed in
            who searches them can find you, which is how people working on the same things meet.
            Unlike Cat&apos;s memory, this is not private. Remove any of it anytime.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAdd();
            }
          }}
          maxLength={80}
          placeholder="e.g. longevity research"
          aria-label="Add an interest"
          className="min-w-0 flex-1 rounded-md border border-default bg-surface-raised px-3 py-2 text-sm text-fg-primary placeholder:text-fg-tertiary focus:border-fg-primary focus:outline-none"
        />
        <Button
          onClick={() => void handleAdd()}
          disabled={!draft.trim() || isAdding}
          className="shrink-0"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" /> Add
            </>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-fg-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : interests.length === 0 ? (
        <p className="text-sm text-fg-tertiary">
          Nothing published yet — nobody can find you by topic. Add one above, or just tell Cat what
          you&apos;re into and it will offer.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {interests.map(interest => (
            <li
              key={interest.id}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-default bg-surface-raised px-3 py-1.5"
            >
              <span className="truncate text-sm text-fg-primary">{interest.topic}</span>
              <button
                type="button"
                onClick={() => void handleRemove(interest)}
                disabled={removing === interest.id}
                aria-label={`Remove ${interest.topic}`}
                className="shrink-0 rounded-full p-0.5 text-fg-tertiary hover:bg-surface-base hover:text-status-negative"
              >
                {removing === interest.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
