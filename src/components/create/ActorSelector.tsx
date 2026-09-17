'use client';

/**
 * "Who is this for?" — the owner selector on every create form.
 *
 * ADR-0004 D8. This used to be a Personal/Group dropdown that RENDERED NOTHING
 * for a user with no groups, and was mounted in exactly one branch of one
 * component, so it appeared on 1 of 13 entity types. Both are fixed here: it
 * renders for everyone, because ownership stops being an invisible default the
 * moment "someone else" is possible.
 *
 * The third option does not resolve to an actor — a person with no account has
 * none, and minting one is the alternative ADR-0004 rejects. It changes the
 * submit target instead; see ./owner.
 *
 * Created: 2026-06-03
 * Last Modified: 2026-09-07
 * Last Modified Summary: Owner selector — adds "Someone else", always renders.
 */

import { ChevronDown, User, Users, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  useMessagingActors,
  type MessagingActor,
} from '@/features/messaging/hooks/useMessagingActors';
import type { CreateOwner } from './owner';

interface ActorSelectorProps {
  value: CreateOwner;
  onChange: (owner: CreateOwner) => void;
  /** Hide the control even when alternatives exist (e.g. in edit mode). */
  disabled?: boolean;
  /** Whether this entity type can be drafted for a non-member at all. */
  allowSomeoneElse?: boolean;
  className?: string;
}

function ActorBadge({ actor }: { actor: MessagingActor }) {
  const Icon = actor.actor_type === 'group' ? Users : User;
  return (
    <span className="flex items-center gap-2">
      <Avatar className="h-5 w-5">
        <AvatarImage src={actor.avatar_url || undefined} />
        <AvatarFallback className="text-[8px]">
          <Icon className="h-2.5 w-2.5" />
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-fg-primary">{actor.name}</span>
    </span>
  );
}

export function ActorSelector({
  value,
  onChange,
  disabled,
  allowSomeoneElse = false,
  className,
}: ActorSelectorProps) {
  const { personalActor, groupActors, isLoading } = useMessagingActors();

  // Only genuinely nothing to choose between hides the control. Previously a
  // user with no groups saw nothing at all, which is why "create on behalf of"
  // read as a feature that did not exist.
  if (isLoading || (!allowSomeoneElse && groupActors.length === 0)) {
    return null;
  }

  const selectedGroup =
    value.kind === 'group' ? groupActors.find(a => a.actor_id === value.actorId) : undefined;

  const triggerLabel =
    value.kind === 'someone-else' ? (
      <span className="flex items-center gap-2">
        <UserPlus className="h-3.5 w-3.5 text-fg-secondary" />
        <span className="text-sm font-medium text-fg-primary">
          {value.name.trim() || 'Someone else'}
        </span>
      </span>
    ) : selectedGroup ? (
      <ActorBadge actor={selectedGroup} />
    ) : personalActor ? (
      <ActorBadge actor={personalActor} />
    ) : (
      <span className="text-sm font-medium text-fg-primary">You</span>
    );

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs text-fg-secondary', className)}>
      <span>This is for</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'flex items-center gap-1.5 rounded-md border border-subtle bg-surface-page px-2 py-1',
              'hover:bg-surface-raised/60 disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            {triggerLabel}
            <ChevronDown className="h-3.5 w-3.5 text-fg-tertiary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Who will own this</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onChange({ kind: 'me' })}
            className={cn('flex items-center gap-2', value.kind === 'me' && 'bg-surface-raised')}
          >
            {personalActor ? (
              <ActorBadge actor={personalActor} />
            ) : (
              <span className="text-sm font-medium text-fg-primary">You</span>
            )}
            <span className="ml-auto text-xs text-fg-secondary">Personal</span>
          </DropdownMenuItem>

          {groupActors.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-fg-secondary">
                Organizations
              </DropdownMenuLabel>
              {groupActors.map(actor => (
                <DropdownMenuItem
                  key={actor.actor_id}
                  onClick={() => onChange({ kind: 'group', actorId: actor.actor_id })}
                  className={cn(
                    'flex items-center gap-2',
                    value.kind === 'group' &&
                      value.actorId === actor.actor_id &&
                      'bg-surface-raised'
                  )}
                >
                  <ActorBadge actor={actor} />
                </DropdownMenuItem>
              ))}
            </>
          )}

          {allowSomeoneElse && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  onChange({
                    kind: 'someone-else',
                    name: value.kind === 'someone-else' ? value.name : '',
                  })
                }
                className={cn(
                  'flex items-center gap-2',
                  value.kind === 'someone-else' && 'bg-surface-raised'
                )}
              >
                <UserPlus className="h-4 w-4 text-fg-secondary" />
                <span className="text-sm font-medium text-fg-primary">Someone else…</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {value.kind === 'someone-else' && (
        <label className="flex items-center gap-2">
          <span className="sr-only">Their name</span>
          <input
            type="text"
            value={value.name}
            onChange={event => onChange({ kind: 'someone-else', name: event.target.value })}
            placeholder="Their name"
            className={cn(
              'rounded-md border border-subtle bg-surface-page px-2 py-1 text-sm text-fg-primary',
              'placeholder:text-fg-tertiary focus:outline-none focus:ring-2 focus:ring-accent-warm/40'
            )}
          />
        </label>
      )}
    </div>
  );
}
