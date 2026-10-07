'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';

export function useProjectFavorite(projectId: string) {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  useEffect(() => {
    if (!projectId || !user) {
      setIsFavorited(false);
      return;
    }

    const checkFavoriteStatus = async () => {
      try {
        const response = await fetch(API_ROUTES.PROJECTS.FAVORITE(projectId));
        if (response.ok) {
          const result = await response.json();
          setIsFavorited(result.data?.isFavorited || false);
        }
      } catch (error) {
        logger.error(
          'Failed to check favorite status',
          { projectId, error },
          'ProjectFavoriteButton'
        );
      }
    };

    checkFavoriteStatus();
  }, [projectId, user]);

  const handleToggleFavorite = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to favorite projects');
      return;
    }

    const previousState = isFavorited;
    setIsFavorited(!isFavorited);
    setIsTogglingFavorite(true);

    try {
      const method = previousState ? 'DELETE' : 'POST';
      const response = await fetch(API_ROUTES.PROJECTS.FAVORITE(projectId), { method });

      if (!response.ok) {
        throw new Error('Failed to toggle favorite');
      }

      const result = await response.json();
      setIsFavorited(result.data?.isFavorited ?? !previousState);
      toast.success(result.data?.isFavorited ? 'Added to favorites' : 'Removed from favorites');
    } catch (error) {
      setIsFavorited(previousState);
      logger.error('Failed to toggle favorite', { projectId, error }, 'ProjectFavoriteButton');
      toast.error('Failed to update favorite. Please try again.');
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [projectId, user, isFavorited]);

  return {
    user,
    isFavorited,
    isTogglingFavorite,
    handleToggleFavorite,
  };
}
