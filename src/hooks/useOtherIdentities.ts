/**
 * The other identities the signed-in person holds (ADR-0014), for surfaces
 * that offer a switch. Empty while loading, when there are none and when the
 * read fails: a menu works without them, so none of those is worth a message.
 *
 * Read again when the circle changes in this tab (IDENTITIES_CHANGED_EVENT)
 * and when the tab comes back into view, so a deleted, handed-over or new
 * identity, and what waits in each, is not stale until a reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IDENTITIES_CHANGED_EVENT,
  fetchIdentityCircle,
  type IdentityMember,
} from '@/lib/identities/client';

export function useOtherIdentities(enabled: boolean): IdentityMember[] {
  const [others, setOthers] = useState<IdentityMember[]>([]);
  const alive = useRef(true);

  const load = useCallback(() => {
    fetchIdentityCircle()
      .then(circle => {
        if (alive.current) {
          setOthers(circle.canManage ? circle.members.filter(m => !m.isCurrent) : []);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!enabled) {
      setOthers([]);
      return;
    }
    load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };
    window.addEventListener(IDENTITIES_CHANGED_EVENT, load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      window.removeEventListener(IDENTITIES_CHANGED_EVENT, load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, load]);

  return others;
}
