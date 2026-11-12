'use client';

import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { TIMELINE_SURFACE } from '@/config/timeline';

/**
 * What sits where the composer would, for a visitor who is not signed in. The
 * timeline above and below stays readable; writing is one sign-in away, and
 * signing in comes back to this page. One shape for every timeline a signed-out
 * visitor can read: a profile's, a project's, the community feed.
 */
export default function SignInToPost() {
  const router = useRouter();

  return (
    <div className="rounded-md border border-dashed border-subtle bg-surface-page px-4 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mb-0 font-medium text-fg-primary">Sign in to post</p>
          <p className="mb-0 text-sm text-fg-secondary">
            You need to be signed in to write on this timeline.
          </p>
        </div>
        <Button
          onClick={() => {
            // Read at click time: a profile's tab lives in the query (?tab=),
            // and the way back should land on it. `from` is the param /auth
            // reads (useAuthForm.ts); this once said `redirect`, which nothing
            // reads, so signing in always landed on /dashboard instead.
            const here = window.location.pathname + window.location.search;
            router.push(`${ROUTES.AUTH}?from=${encodeURIComponent(here)}`);
          }}
          className={TIMELINE_SURFACE.buttonPrimary}
        >
          Sign in
        </Button>
      </div>
    </div>
  );
}
