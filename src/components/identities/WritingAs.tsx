'use client';

/**
 * Which of your names you are writing as (ADR-0015 D5, ADR-0014).
 *
 * Each identity is a whole account with its own inbox, so this list of
 * conversations belongs to one name only. The row says which, shows what is
 * waiting in the others, and switches. It is drawn only for somebody who
 * holds more than one name and may switch between them; for everyone else
 * there is nothing to choose and nothing is shown.
 *
 * Nothing here reaches a conversation: the other people in it see the name
 * you write as and no trace of the others.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROUTES } from '@/config/routes';
import {
  IDENTITIES_CHANGED_EVENT,
  fetchIdentityCircle,
  switchToIdentity,
  type IdentityCircle,
  type IdentityMember,
} from '@/lib/identities/client';

/** What a member is called here: its name, else its handle. */
export function memberLabel(member: Pick<IdentityMember, 'name' | 'username'>): string {
  return member.name?.trim() || (member.username ? `@${member.username}` : 'Unnamed');
}

/**
 * What the row has to show, or null when there is no choice to make: the
 * name in use and the others, those with something waiting first.
 */
export function writingAsChoice(
  circle: IdentityCircle | null
): { current: IdentityMember; others: IdentityMember[]; waiting: number } | null {
  if (!circle || !circle.canManage) {
    return null;
  }
  const current = circle.members.find(m => m.isCurrent);
  const others = circle.members
    .filter(m => !m.isCurrent)
    .sort((a, b) => (b.waiting ?? 0) - (a.waiting ?? 0));
  if (!current || others.length === 0) {
    return null;
  }
  return { current, others, waiting: others.reduce((sum, m) => sum + (m.waiting ?? 0), 0) };
}

function Face({ member }: { member: IdentityMember }) {
  return (
    <Avatar className="h-6 w-6">
      <AvatarImage src={member.avatarUrl || undefined} />
      <AvatarFallback>
        <User className="h-3.5 w-3.5" />
      </AvatarFallback>
    </Avatar>
  );
}

export function WritingAs() {
  const [circle, setCircle] = useState<IdentityCircle | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetchIdentityCircle().then(
        loaded => live && setCircle(loaded),
        // A row that cannot be read is left out: the conversations still work.
        () => undefined
      );
    void load();
    window.addEventListener(IDENTITIES_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(IDENTITIES_CHANGED_EVENT, load);
    };
  }, []);

  const choice = writingAsChoice(circle);
  if (!choice) {
    return null;
  }

  const become = async (member: IdentityMember) => {
    setProblem(null);
    setSwitching(member.id);
    // On success the tab reloads on Messages as that name and this never returns.
    const failed = await switchToIdentity(member.id, ROUTES.MESSAGES);
    setSwitching(null);
    setProblem(failed);
  };

  return (
    <div className="px-3 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-fg-secondary transition-colors hover:bg-surface-raised"
          >
            <Face member={choice.current} />
            <span className="min-w-0 flex-1 truncate">
              Writing as{' '}
              <span className="font-medium text-fg-primary">{memberLabel(choice.current)}</span>
            </span>
            {choice.waiting > 0 && (
              <span
                className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-fg-primary"
                aria-label={`${choice.waiting} waiting in your other names`}
              >
                {choice.waiting > 99 ? '99+' : choice.waiting}
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Switch to another of your names</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {choice.others.map(member => (
            <DropdownMenuItem
              key={member.id}
              disabled={switching !== null}
              onClick={() => void become(member)}
              className="flex min-h-11 cursor-pointer items-center gap-2"
            >
              <Face member={member} />
              <span className="min-w-0 flex-1 truncate">{memberLabel(member)}</span>
              {(member.waiting ?? 0) > 0 && (
                <span className="text-xs text-fg-secondary">{member.waiting} waiting</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {problem && (
        <p role="alert" className="mb-0 px-2 pt-1 text-sm text-status-negative">
          {problem}
        </p>
      )}
    </div>
  );
}
