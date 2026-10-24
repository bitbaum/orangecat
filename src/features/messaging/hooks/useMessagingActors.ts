/**
 * Hook to fetch actors the user can send messages as
 *
 * @module features/messaging/hooks/useMessagingActors
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';

export interface MessagingActor {
  actor_id: string;
  actor_type: 'user' | 'group';
  name: string;
  avatar_url: string | null;
  is_personal: boolean;
}

interface UseMessagingActorsResult {
  actors: MessagingActor[];
  isLoading: boolean;
  error: string | null;
  personalActor: MessagingActor | null;
  groupActors: MessagingActor[];
  retry: () => void;
}

export function useMessagingActors(): UseMessagingActorsResult {
  const { user } = useAuth();
  const userId = user?.id;
  const [actors, setActors] = useState<MessagingActor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setActors([]);
    if (!userId) {
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchActors = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(API_ROUTES.MESSAGES.ACTORS, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch messaging actors');
        }

        const data = await response.json();
        if (!Array.isArray(data.data?.actors)) {
          throw new Error('The identities response was incomplete');
        }
        if (!cancelled) {
          setActors(data.data.actors);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        logger.error('Failed to fetch messaging actors', { error: err }, 'MessagingActors');
        setError(err instanceof Error ? err.message : 'Unknown error');
        setActors([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchActors();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, attempt]);

  const personalActor = actors.find(a => a.is_personal) || null;
  const groupActors = actors.filter(a => !a.is_personal);

  return {
    actors,
    isLoading,
    error,
    personalActor,
    groupActors,
    retry,
  };
}
