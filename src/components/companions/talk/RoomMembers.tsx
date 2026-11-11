'use client';

/**
 * Who is in a group chat, with "Add member" as the last row (adding is the
 * last row, never a button somewhere else) and one Remove per row while the
 * group stays a group (two or more).
 */

import { useMemo, useState } from 'react';
import { Sheet } from '@bitbaum/chatkit/react';
import { COMPANION_COPY } from '@/config/companions';
import { MAX_ROOM_MEMBERS, MIN_ROOM_MEMBERS } from '@/services/companions/rooms/plan';
import type { NewRoomMember, RoomMember } from '@/services/companions/rooms/types';
import { Face } from './CompanionFace';
import { matchesQuery, nameWithJob } from './format';
import { PickRow, memberPicks, pickKeyOf } from './memberPicks';
import type { TalkHomeData } from './types';

export function RoomMembers({
  members,
  home,
  onAdd,
  onRemove,
}: {
  members: RoomMember[];
  home: TalkHomeData | null;
  onAdd: (member: NewRoomMember) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
}) {
  const copy = COMPANION_COPY.talk.room;
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const seated = useMemo(() => new Set(members.map(pickKeyOf)), [members]);
  const candidates = memberPicks(home).filter(
    p => !seated.has(p.key) && matchesQuery(`${p.name} ${p.job ?? ''}`, query)
  );
  const canRemove = members.length > MIN_ROOM_MEMBERS;
  const canAdd = members.length < MAX_ROOM_MEMBERS;

  return (
    <div className="flex flex-col">
      <p className="mb-0 px-4 text-xs uppercase tracking-wide text-fg-tertiary">{copy.members}</p>
      {members.map(m => (
        <div key={m.id} className="flex min-h-[56px] items-center gap-3 px-4">
          <Face name={m.name} avatarUrl={m.avatarUrl} size={40} />
          <span className="min-w-0 flex-1 truncate text-base text-fg-primary">
            {nameWithJob(m.name, m.job)}
          </span>
          {canRemove && (
            <button
              type="button"
              className="min-h-[44px] shrink-0 px-2 text-sm text-fg-secondary hover:text-fg-primary"
              onClick={() => void onRemove(m.id)}
            >
              {copy.remove}
            </button>
          )}
        </div>
      ))}
      {canAdd && (
        <button
          type="button"
          className="flex min-h-[48px] w-full items-center rounded-2xl px-4 text-left text-base text-fg-primary hover:bg-surface-hover"
          onClick={() => setAdding(true)}
        >
          {copy.addMember}
        </button>
      )}
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title={copy.addMember}
        closeLabel={COMPANION_COPY.talk.close}
      >
        <div className="flex flex-col gap-3 p-4">
          <label className="flex h-11 items-center gap-2 rounded-full bg-surface-raised px-4">
            <span className="text-base text-fg-tertiary">{copy.to}</span>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={copy.searchBots}
              aria-label={copy.searchBots}
              className="min-w-0 flex-1 bg-transparent text-base text-fg-primary outline-none placeholder:text-fg-tertiary"
            />
          </label>
          <ul className="max-h-[50vh] overflow-y-auto">
            {candidates.map(p => (
              <li key={p.key}>
                <PickRow
                  pick={p}
                  onPick={() => {
                    setAdding(false);
                    void onAdd(p.member);
                  }}
                />
              </li>
            ))}
            {candidates.length === 0 && (
              <li className="px-2 py-6 text-center text-sm text-fg-secondary">
                {copy.nobodyToAdd}
              </li>
            )}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}
