/**
 * The band that says whose page this is.
 *
 * ADR-0005 D4. A page owned by an unclaimed actor is real, public and
 * fundable-looking — so it MUST say, unmissably, that it belongs to someone who
 * has not accepted it yet, and who set it up. That answers the creator's
 * requirement ("it should obviously state that this is not for me even though I
 * set it up"), gives the recipient their door in, and turns every visitor into
 * someone who might nudge her.
 *
 * It deliberately does not look like a warning. Nothing is wrong: a friend made
 * a page for someone, and that someone has not seen it yet.
 */

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export function UnclaimedBand({
  ownerName,
  stewardUsername,
  claimToken,
}: {
  /** The person this belongs to, e.g. "Maria". */
  ownerName: string;
  /** Who set it up. Omitted rather than guessed if unknown. */
  stewardUsername?: string | null;
  /**
   * Present only for the recipient's own link. A visitor gets the explanation
   * without a take-it-over button they have no right to press — the token is
   * the capability, and it belongs in the link she was sent, not on a public
   * page anyone can open.
   */
  claimToken?: string | null;
}) {
  return (
    <div className="border-b border-default bg-surface-raised">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <span className="flex items-center gap-2 text-sm text-fg-secondary">
          <UserPlus className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
          <span>
            {stewardUsername ? (
              <>
                Set up by{' '}
                <Link
                  href={ROUTES.PROFILES.VIEW(stewardUsername)}
                  className="font-medium text-fg-primary underline underline-offset-2"
                >
                  @{stewardUsername}
                </Link>{' '}
                for <span className="font-medium text-fg-primary">{ownerName}</span> —{' '}
              </>
            ) : (
              <>
                This belongs to <span className="font-medium text-fg-primary">{ownerName}</span>{' '}
                —{' '}
              </>
            )}
            {ownerName} hasn’t taken it over yet, so it can’t receive funds.
            {stewardUsername ? ` Until then, @${stewardUsername} keeps it up to date.` : ''}
          </span>
        </span>

        {claimToken && (
          <Link href={ROUTES.CLAIM(claimToken)}>
            <Button variant="accent" size="sm">
              Take it over
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
