'use client';

/**
 * In place of the email and password forms when the signed-in account is an
 * identity (ADR-0014). It has no address a person can read and no password,
 * and that is what keeps it reachable from the main account only. Saving an
 * address or a password here would separate it from the other identities for
 * good (D6a), so the forms are not offered; this says why, and what to do to
 * give the identity to someone instead.
 */
import { UserRound } from 'lucide-react';
import { IDENTITIES_COPY } from '@/config/identities';

export function SettingsIdentityAccountNote() {
  return (
    <div>
      <h3 className="mb-4 flex items-center text-lg font-semibold text-fg-primary">
        <UserRound className="mr-2 h-6 w-6" />
        {IDENTITIES_COPY.identityAccountTitle}
      </h3>
      <p className="mb-3 text-fg-secondary">{IDENTITIES_COPY.identityAccountBody}</p>
      <p className="mb-0 text-fg-secondary">{IDENTITIES_COPY.identityAccountHandOver}</p>
    </div>
  );
}
