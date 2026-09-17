'use client';

/**
 * Waiting for the Cat's answer to appear, the way tagging @grok does.
 *
 * Threading was already right: tag the Cat under a post and its answer is
 * written as a child of the post that tagged it. What was missing is that the
 * answer never ARRIVED. The thread refetches once when your reply is created,
 * and the Cat takes 10–17 seconds to think (measured in production 2026-08-28:
 * 07:48:46 → 07:49:03, and 07:23:52 → 07:24:02). By then the refetch is long
 * over and there is no realtime subscription on timeline events, so the reply
 * you asked for sat in the database until you reloaded the page.
 *
 * That is the whole difference between "the model replies" and "the model
 * replies to you". So after a reply that tags the Cat, this waits for the
 * answer and hands it back to be inserted.
 *
 * Polling rather than realtime deliberately: this is a single row, expected
 * once, within a known short window. A realtime channel for that is a
 * subscription to keep alive, authorise and tear down for something that ends
 * in under a minute.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { timelineService } from '@/services/timeline';
import { activeMentionsCat } from '@/domain/mentions/rank';
import { logger } from '@/utils/logger';
import type { TimelineDisplayEvent } from '@/types/timeline';

/** How long to keep looking before giving up. */
const WINDOW_MS = 60_000;
/** Gap between checks. Fast enough to feel immediate, slow enough to be cheap. */
const INTERVAL_MS = 2_500;

interface Options {
  /** Called once with the Cat's reply, if it arrives inside the window. */
  onArrived: (parentId: string, reply: TimelineDisplayEvent) => void;
}

export interface AwaitCatReplyState {
  /** The event whose answer we are waiting for, or null when idle. */
  awaitingParentId: string | null;
  /** Start waiting if this text tags the Cat. Safe to call on every reply. */
  watchIfTagged: (event: TimelineDisplayEvent | undefined) => void;
}

export function useAwaitCatReply({ onArrived }: Options): AwaitCatReplyState {
  const [awaitingParentId, setAwaitingParentId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;

  const stop = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = undefined;
    setAwaitingParentId(null);
  }, []);

  useEffect(() => stop, [stop]);

  const watchIfTagged = useCallback((event: TimelineDisplayEvent | undefined) => {
    if (!event?.id) {
      return;
    }
    // One definition of "this tags the Cat" — the same one the resolver and the
    // autocomplete menu use. A second opinion here is how `@catalogue` would
    // start spawning phantom waits.
    const text = `${event.title ?? ''} ${event.description ?? ''}`;
    if (!activeMentionsCat(text)) {
      return;
    }
    setAwaitingParentId(event.id);
  }, []);

  useEffect(() => {
    if (!awaitingParentId) {
      return;
    }

    const startedAt = Date.now();
    let cancelled = false;

    const check = async () => {
      try {
        const result = await timelineService.getReplies(awaitingParentId, 10);
        const catReply = (result.replies ?? []).find(
          reply => reply.metadata?.is_cat_reply === true
        );
        if (catReply && !cancelled) {
          onArrivedRef.current(awaitingParentId, catReply);
          stop();
          return;
        }
      } catch (error) {
        // A failed poll is not a failed answer; the next tick tries again.
        logger.warn('Could not check for the Cat reply yet', { error }, 'AwaitCatReply');
      }

      if (Date.now() - startedAt > WINDOW_MS && !cancelled) {
        // The Cat answers even when it cannot think — a fallback reply is still
        // a reply — so running out of time means something is wrong upstream.
        // Give up quietly rather than leaving a spinner on the thread forever.
        logger.warn('Gave up waiting for the Cat', { parentId: awaitingParentId }, 'AwaitCatReply');
        stop();
      }
    };

    void check();
    timerRef.current = setInterval(check, INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    };
  }, [awaitingParentId, stop]);

  return { awaitingParentId, watchIfTagged };
}
