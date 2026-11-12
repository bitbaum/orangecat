'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { PageHeading } from '@/components/layout/PageHeading';
import { SearchTrigger } from '@/components/search/SearchTrigger';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/hooks/useAuth';

/**
 * The body of the root 404 (src/app/not-found.tsx, a server file so it can
 * set the document title).
 *
 * The search is the header's own palette, opened through SearchTrigger: a
 * second search box here would be a second search. The first action is one
 * the visitor can use — the dashboard only when signed in, since an anonymous
 * visitor sent there is bounced through /auth for a mistyped address.
 *
 * The failed address is read in the browser only. The production build
 * prerenders this page once, as `/_not-found`, and serves that HTML for every
 * unmatched address, so a path read during the server render would print
 * `/_not-found` and then mismatch on hydration.
 */
const subscribe = () => () => {};
const readPath = () => window.location.pathname;
const noPath = () => null;

export function NotFoundView() {
  const pathname = useSyncExternalStore(subscribe, readPath, noPath);
  const { user, hydrated } = useAuth();
  const signedIn = hydrated && !!user;

  return (
    <div className="oc-page flex items-center justify-center px-4">
      <div className="oc-surface w-full max-w-lg space-y-6 p-6">
        <div>
          <PageHeading className="text-balance text-center">This page doesn’t exist</PageHeading>
          {pathname && (
            <p className="mb-0 mt-3 break-all text-center text-sm text-fg-secondary">{pathname}</p>
          )}
        </div>

        <SearchTrigger className="h-11" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Button href={signedIn ? ROUTES.DASHBOARD.HOME : ROUTES.HOME} variant="primary">
            {signedIn ? 'Go to dashboard' : 'Go to home'}
          </Button>
          <Button href={ROUTES.DISCOVER} variant="outline">
            Browse Discover
          </Button>
        </div>

        <p className="mb-0 border-t border-default pt-4 text-center text-sm">
          <Link
            href={
              pathname
                ? `${ROUTES.FEEDBACK}?message=${encodeURIComponent(`Broken link: ${pathname}`)}`
                : ROUTES.FEEDBACK
            }
            className="inline-flex min-h-11 items-center font-medium text-fg-primary underline underline-offset-4"
          >
            Tell us what you were looking for
          </Link>
        </p>
      </div>
    </div>
  );
}
