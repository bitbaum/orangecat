'use client';

/**
 * The other identities this person holds, as rows of the user menu (ADR-0014
 * D8). One tap switches. Renders nothing for a person with a single identity,
 * so the menu is unchanged for everyone who has not added one.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { IDENTITIES_COPY } from '@/config/identities';
import {
  fetchIdentityCircle,
  switchToIdentity,
  type IdentityMember,
} from '@/lib/identities/client';

export function IdentitySwitcherRows() {
  const [others, setOthers] = useState<IdentityMember[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchIdentityCircle()
      .then(circle => {
        if (alive) {
          setOthers(circle.members.filter(m => !m.isCurrent));
        }
      })
      // The menu works without this section; a failed read is not worth a toast.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (others.length === 0) {
    return null;
  }

  const handleSwitch = async (id: string) => {
    setBusyId(id);
    const error = await switchToIdentity(id);
    toast.error(error);
    setBusyId(null);
  };

  return <IdentitySwitcherList others={others} busyId={busyId} onSwitch={handleSwitch} />;
}

interface IdentitySwitcherListProps {
  others: IdentityMember[];
  busyId: string | null;
  onSwitch: (id: string) => void;
}

/** The rows themselves, with no data of their own. */
export function IdentitySwitcherList({ others, busyId, onSwitch }: IdentitySwitcherListProps) {
  return (
    <>
      <div className="border-t border-border-subtle my-1" />
      <div className="py-2" role="group" aria-label={IDENTITIES_COPY.switchLabel}>
        <p className="mb-0 px-4 pb-1 pt-2 text-xs font-medium text-fg-secondary">
          {IDENTITIES_COPY.switchLabel}
        </p>
        {others.map(member => (
          <button
            key={member.id}
            type="button"
            role="menuitem"
            onClick={() => onSwitch(member.id)}
            disabled={busyId !== null}
            className="group flex w-full items-center px-4 py-3 text-sm outline-none transition-all duration-200 hover:bg-muted focus:bg-muted/40 focus:ring-2 focus:ring-inset focus:ring-ring disabled:opacity-60 dark:focus:bg-muted"
          >
            <span className="oc-icon-tile mr-4 h-10 w-10 shrink-0 overflow-hidden text-sm font-medium text-fg-secondary">
              {busyId === member.id ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- free-form user URL on any host; next/image throws outside images.remotePatterns
                <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                (member.name || member.username || '?').slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-semibold text-fg-primary">
                {member.name || member.username || 'Unnamed'}
              </span>
              <span className="block truncate text-sm text-fg-secondary">
                {member.isHolder ? `${IDENTITIES_COPY.main} · ` : ''}
                {member.username ? `@${member.username}` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
