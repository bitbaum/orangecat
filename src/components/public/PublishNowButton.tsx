'use client';

/**
 * Publish, from the page the owner is looking at.
 *
 * The owner bar said "Publish it to go live" and offered only Edit, so a host
 * previewing their draft event had to find the form, find the status, and
 * save — while the link they meant to send took nobody's ticket. One tap now.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket } from 'lucide-react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { ENTITY_STATUS } from '@/config/database-constants';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { entityEvents } from '@/lib/analytics';
import type { EntityType } from '@/config/entity-registry';

export function PublishNowButton({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(API_ROUTES.ENTITIES.STATUS(entityType, entityId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: ENTITY_STATUS.ACTIVE }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(apiErrorMessage(body, 'Could not publish. Try again, or use Edit.'));
      }
      entityEvents.published(entityType, entityId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish. Try again, or use Edit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={publish} disabled={busy}>
        <Rocket className="h-3.5 w-3.5" />
        {busy ? 'Publishing…' : 'Publish'}
      </Button>
      {error && (
        <span role="alert" className="w-full text-sm text-status-negative">
          {error}
        </span>
      )}
    </>
  );
}
