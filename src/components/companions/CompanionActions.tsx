'use client';

/**
 * The three things you can do from a companion's profile: Talk, Clone, and
 * (for the owner) Edit. Talk is the only accent on the page.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';

interface CompanionActionsProps {
  id: string;
  isOwner: boolean;
  isSignedIn: boolean;
  isPublic: boolean;
  conversations: number;
  clonedFrom?: string | null;
}

export function CompanionActions({
  id,
  isOwner,
  isSignedIn,
  isPublic,
  conversations,
  clonedFrom,
}: CompanionActionsProps) {
  const router = useRouter();
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const copy = COMPANION_COPY.actions;
  const talkHref = `${ROUTES.AI_ASSISTANTS.VIEW(id)}/talk`;
  const signInHref = `${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(talkHref)}`;
  const editHref = `${ENTITY_REGISTRY['ai_assistant'].createPath}?edit=${id}`;

  const clone = async () => {
    setCloning(true);
    setCloneError(null);
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.CLONE(id), { method: 'POST' });
      const json = (await res.json()) as { data?: { id: string }; error?: { message: string } };
      if (!res.ok || !json.data?.id) {
        throw new Error(json.error?.message || 'Could not clone');
      }
      router.push(`${ENTITY_REGISTRY['ai_assistant'].createPath}?edit=${json.data.id}`);
    } catch (err) {
      logger.error('Clone failed', err, 'CompanionActions');
      setCloneError(err instanceof Error ? err.message : 'Could not clone');
      setCloning(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={isSignedIn ? talkHref : signInHref}>
          <Button variant="accent">{copy.talk}</Button>
        </Link>
        {isSignedIn ? (
          <Button
            variant="outline"
            onClick={() => void clone()}
            disabled={cloning}
            title={copy.cloneHint}
          >
            {cloning ? copy.cloning : copy.clone}
          </Button>
        ) : (
          <Link href={signInHref}>
            <Button variant="outline" title={copy.cloneHint}>
              {copy.clone}
            </Button>
          </Link>
        )}
        {isOwner && (
          <Link href={editHref}>
            <Button variant="ghost">{copy.edit}</Button>
          </Link>
        )}
      </div>
      <p className="text-xs text-fg-tertiary">
        {isPublic ? copy.publicBadge : copy.privateBadge}
        {conversations > 0 ? ` · ${conversations} conversations` : ''}
        {clonedFrom ? (
          <>
            {' · '}
            <Link href={ROUTES.AI_ASSISTANTS.VIEW(clonedFrom)} className="hover:text-fg-primary">
              {copy.clonedFrom} another companion
            </Link>
          </>
        ) : null}
      </p>
      {cloneError && <p className="text-xs text-status-negative">{cloneError}</p>}
    </div>
  );
}
