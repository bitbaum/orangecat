'use client';

/**
 * One member of a person's circle (ADR-0014): face, name, handle, then the one
 * thing you can do with it. Deleting sits on its own line under the row, so a
 * name never shares its width with two buttons.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IDENTITIES_COPY } from '@/config/identities';
import type { IdentityMember } from '@/lib/identities/client';
import { IdentityHandover } from './IdentityHandover';

const quietAction =
  'min-h-11 text-sm text-fg-secondary underline-offset-4 hover:underline disabled:opacity-50';

interface IdentityRowProps {
  member: IdentityMember;
  /** The member an action is running for, if any. Every action waits on it. */
  busyId: string | null;
  /** Whether this row is asking "really delete?". */
  confirming: boolean;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirm: (id: string | null) => void;
  /** Something about the circle changed elsewhere; read it again. */
  onChanged: () => void;
}

export function IdentityRow({
  member,
  busyId,
  confirming,
  onSwitch,
  onDelete,
  onConfirm,
  onChanged,
}: IdentityRowProps) {
  const [handing, setHanding] = useState(false);
  // An open offer is always shown: it is the one thing here that is waiting
  // on someone else, and the way to withdraw it must not be behind a tap.
  const showHandover = handing || Boolean(member.handoverOpen);
  return (
    <li className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <Avatar className="h-10 w-10 shrink-0">
        {/* Only with a picture: the image element draws a broken frame
            without one and squeezes the initial out of the circle. */}
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
        <AvatarFallback className="text-sm font-medium text-fg-secondary">
          {(member.name || member.username || '?').slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg-primary">
          {member.name || member.username || 'Unnamed'}
        </span>
        {/* The label leads, so it is what survives a long handle. */}
        <span className="block truncate text-sm text-fg-secondary">
          {member.isHolder ? `${IDENTITIES_COPY.main} · ` : ''}
          {member.username ? `@${member.username}` : ''}
        </span>
      </span>
      {member.isCurrent ? (
        <span className="shrink-0 text-sm text-fg-secondary">{IDENTITIES_COPY.current}</span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0"
          onClick={() => onSwitch(member.id)}
          disabled={busyId !== null}
        >
          {busyId === member.id && !confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            IDENTITIES_COPY.switchTo
          )}
        </Button>
      )}
      {/* Deleting is its own line under the row, so the name above
          never shares its width with two buttons. */}
      {!member.isHolder && !member.isCurrent && (
        <span className="flex w-full items-center justify-end gap-2">
          {confirming ? (
            <>
              <span className="mr-auto text-sm text-fg-primary">
                {IDENTITIES_COPY.confirmRemove}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => onConfirm(null)}
                disabled={busyId === member.id}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                className="min-h-11"
                onClick={() => onDelete(member.id)}
                disabled={busyId === member.id}
              >
                {busyId === member.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  IDENTITIES_COPY.remove
                )}
              </Button>
            </>
          ) : (
            <>
              {!showHandover && (
                <button
                  type="button"
                  className={`mr-auto ${quietAction}`}
                  onClick={() => setHanding(true)}
                  disabled={busyId !== null}
                >
                  {IDENTITIES_COPY.handOver}
                </button>
              )}
              <button
                type="button"
                className={quietAction}
                onClick={() => onConfirm(member.id)}
                disabled={busyId !== null}
              >
                {IDENTITIES_COPY.removeThis}
              </button>
            </>
          )}
        </span>
      )}
      {!member.isHolder && !member.isCurrent && showHandover && (
        <IdentityHandover
          identityId={member.id}
          open={Boolean(member.handoverOpen)}
          onChanged={onChanged}
        />
      )}
    </li>
  );
}
