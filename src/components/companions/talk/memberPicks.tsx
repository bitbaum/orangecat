'use client';

/**
 * Who can be seated in a group chat, as rows with one anatomy — used by the
 * new-group sheet and by "Add member" on an existing one.
 */

import { Check } from 'lucide-react';
import type { NewRoomMember } from '@/services/companions/rooms/types';
import { Face } from './CompanionFace';
import { nameWithJob } from './format';
import type { TalkHomeData } from './types';

export interface MemberPick {
  key: string;
  name: string;
  job: string | null;
  avatarUrl: string | null;
  member: NewRoomMember;
}

export function memberPicks(home: TalkHomeData | null): MemberPick[] {
  if (!home) {
    return [];
  }
  return [
    ...home.companions.map(c => ({
      key: `c:${c.id}`,
      name: c.title,
      job: c.description,
      avatarUrl: c.avatarUrl,
      member: { assistantId: c.id },
    })),
    ...home.fleet.bots.map(b => ({
      key: `f:${b.slug}`,
      name: b.name,
      job: b.job,
      avatarUrl: b.mark,
      member: { fleetSlug: b.slug },
    })),
  ];
}

/** The pick's key as a room member would carry it, so "already seated" can be told. */
export function pickKeyOf(member: {
  assistantId: string | null;
  fleetSlug: string | null;
}): string {
  return member.assistantId ? `c:${member.assistantId}` : `f:${member.fleetSlug ?? ''}`;
}

export function PickRow({
  pick,
  checked,
  onPick,
}: {
  pick: MemberPick;
  /** Undefined: a plain row that acts on tap; true/false: a checkbox row. */
  checked?: boolean;
  onPick: () => void;
}) {
  const toggle = checked !== undefined;
  return (
    <button
      type="button"
      role={toggle ? 'checkbox' : undefined}
      aria-checked={toggle ? checked : undefined}
      onClick={onPick}
      className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-2 text-left hover:bg-surface-hover"
    >
      <Face name={pick.name} avatarUrl={pick.avatarUrl} size={40} />
      <span className="min-w-0 flex-1 truncate text-base text-fg-primary">
        {nameWithJob(pick.name, pick.job)}
      </span>
      {toggle && (
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            checked ? 'border-fg-primary bg-fg-primary text-fg-inverted' : 'border-subtle'
          }`}
          aria-hidden="true"
        >
          {checked && <Check className="h-4 w-4" />}
        </span>
      )}
    </button>
  );
}
