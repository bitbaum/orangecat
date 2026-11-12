/**
 * The other identities the signed-in person holds (ADR-0014), for surfaces
 * that offer a switch. Empty while loading, when there are none and when the
 * read fails: a menu works without them, so none of those is worth a message.
 */
import { useEffect, useState } from 'react';
import { fetchIdentityCircle, type IdentityMember } from '@/lib/identities/client';

export function useOtherIdentities(enabled: boolean): IdentityMember[] {
  const [others, setOthers] = useState<IdentityMember[]>([]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let alive = true;
    fetchIdentityCircle()
      .then(circle => {
        if (alive) {
          setOthers(circle.members.filter(m => !m.isCurrent));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabled]);

  return others;
}
