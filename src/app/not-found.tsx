'use client';

import { NotFound as NotFoundPage } from '@/components/ui/NotFound';
import { useAuth } from '@/hooks/useAuth';

/**
 * The site-wide 404: the one not-found page (components/ui/NotFound.tsx) for
 * a URL that matches no route. A route that knows what kind was missing has
 * its own `not-found.tsx` naming it.
 */
export default function NotFound() {
  // The dashboard is offered only to someone who can open it; a visitor who
  // typed a wrong URL should not be bounced through sign-in.
  const { user, hydrated } = useAuth();
  return <NotFoundPage signedIn={hydrated && !!user} />;
}
