'use client';

/**
 * Take a live entity offline (back to draft, or cancelled where draft is not
 * a move it can make), through the generic status endpoint. Shared by the
 * owner bar's Unpublish button and the Delete dialog for types the database
 * only lets you delete as drafts (events).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { takeDownStatus } from '@/config/entity-status';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/** The button label for each take-down move. */
export function takeOfflineLabel(entityType: EntityType, status: string | null | undefined) {
  const next = takeDownStatus(status);
  if (!next) {
    return null;
  }
  return next === 'draft'
    ? 'Unpublish'
    : `Cancel ${ENTITY_REGISTRY[entityType].name.toLowerCase()}`;
}

export function useTakeOffline(entityType: EntityType, entityId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const meta = ENTITY_REGISTRY[entityType];

  async function takeOffline(status: string | null | undefined): Promise<boolean> {
    const next = takeDownStatus(status);
    if (!next) {
      return false;
    }
    setBusy(true);
    try {
      const res = await fetch(API_ROUTES.ENTITIES.STATUS(entityType, entityId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          apiErrorMessage(body, `Couldn't take this ${meta.name.toLowerCase()} offline.`)
        );
      }
      toast.success(next === 'draft' ? `${meta.name} unpublished` : `${meta.name} cancelled`, {
        description:
          next === 'draft'
            ? 'It is a draft again, visible only to you. You can delete it now.'
            : 'It is offline. Move it back to draft to delete it.',
      });
      router.refresh();
      return true;
    } catch (err) {
      toast.error(`Couldn't take this ${meta.name.toLowerCase()} offline`, {
        description: err instanceof Error ? err.message : undefined,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { takeOffline, busy };
}
