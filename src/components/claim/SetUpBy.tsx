/**
 * The attribution that outlives the claim.
 *
 * While a page is unclaimed, the UnclaimedBand says who set it up. Once its
 * owner has taken it over, the band is gone — but "seen and known" was the
 * requirement, so the fact that someone else set it up stays on the page as
 * one quiet line. It is derived, not stored: `projects.user_id` is the
 * account that created the row, and it differs from the owner exactly when
 * the page was set up on someone's behalf.
 */

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export function SetUpBy({ stewardUsername }: { stewardUsername: string }) {
  return (
    <div className="border-b border-default bg-surface-raised">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2 text-xs text-fg-secondary sm:px-6 lg:px-8">
        <UserPlus className="h-3.5 w-3.5 shrink-0 text-fg-tertiary" aria-hidden="true" />
        <span>
          Set up by{' '}
          <Link
            href={ROUTES.PROFILES.VIEW(stewardUsername)}
            className="font-medium text-fg-primary underline underline-offset-2"
          >
            @{stewardUsername}
          </Link>
          , now run by its owner.
        </span>
      </div>
    </div>
  );
}
