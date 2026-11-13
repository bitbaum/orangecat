'use client';

/**
 * Unpublish (or cancel), from the page the owner is looking at: the
 * counterpart of PublishNowButton. Rendered for types the database only
 * deletes as drafts, so a live one always has a way back.
 */

import { EyeOff, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { EntityType } from '@/config/entity-registry';
import { takeOfflineLabel, useTakeOffline } from './useTakeOffline';

export function TakeOfflineButton({
  entityType,
  entityId,
  entityStatus,
}: {
  entityType: EntityType;
  entityId: string;
  entityStatus: string;
}) {
  const { takeOffline, busy } = useTakeOffline(entityType, entityId);
  const label = takeOfflineLabel(entityType, entityStatus);
  if (!label) {
    return null;
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => void takeOffline(entityStatus)}
      disabled={busy}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
