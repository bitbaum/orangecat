'use client';

/**
 * Save a project to come back to.
 *
 * This was the top of ProjectDonationSection, a second payment box beside the
 * page's shared payment section. That box showed the project's legacy
 * address ("Address verified and monitored" — nothing verified it) while the
 * shared section paid whatever wallet resolution found, so a page could show
 * one address and pay another. Legacy addresses are now linked wallets
 * (migration 20261007170000), the shared section is the one way to pay, and
 * this is what remains: the favourite.
 */

import { Heart, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useProjectFavorite } from './useProjectFavorite';

export function ProjectFavoriteButton({ projectId }: { projectId: string }) {
  const { user, isFavorited, isTogglingFavorite, handleToggleFavorite } =
    useProjectFavorite(projectId);

  if (!user) {
    return (
      <Button href={`${ROUTES.AUTH}?from=favorite`} variant="outline" className="gap-2">
        <Heart className="h-4 w-4" aria-hidden="true" />
        Sign in to save
      </Button>
    );
  }

  return (
    <Button
      onClick={handleToggleFavorite}
      disabled={isTogglingFavorite}
      variant="outline"
      className="gap-2"
      aria-pressed={isFavorited}
    >
      {isTogglingFavorite ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} aria-hidden="true" />
      )}
      {isFavorited ? 'Saved to favorites' : 'Save to favorites'}
    </Button>
  );
}
