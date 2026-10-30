'use client';

/**
 * Start a group chat: pick two to six of the companions on the list (yours,
 * the ones you talk to, the fleet's) and go. The title is theirs to earn —
 * it is made of their names until the person renames it.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@bitbaum/chatkit/react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import { MAX_ROOM_MEMBERS, MIN_ROOM_MEMBERS } from '@/services/companions/rooms/plan';
import { logger } from '@/utils/logger';
import { matchesQuery } from './format';
import { PickRow, memberPicks } from './memberPicks';
import type { TalkHomeData } from './types';

export function NewRoomSheet({
  open,
  home,
  onClose,
}: {
  open: boolean;
  home: TalkHomeData | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const copy = COMPANION_COPY.talk.room;
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picks = useMemo(() => memberPicks(home), [home]);
  const shown = picks.filter(p => matchesQuery(`${p.name} ${p.job ?? ''}`, query));
  const enough = chosen.length >= MIN_ROOM_MEMBERS && chosen.length <= MAX_ROOM_MEMBERS;

  function toggle(key: string) {
    setChosen(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : prev.length < MAX_ROOM_MEMBERS
          ? [...prev, key]
          : prev
    );
  }

  async function start() {
    if (!enough || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const members = chosen.map(k => picks.find(p => p.key === k)?.member).filter(Boolean);
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.ROOMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      });
      const json = (await res.json()) as { data?: { id: string }; error?: { message?: string } };
      if (!res.ok || !json.data?.id) {
        throw new Error(json.error?.message || COMPANION_COPY.room.sendFailed);
      }
      setChosen([]);
      onClose();
      router.push(ROUTES.AI_ASSISTANTS.TALK_ROOM(json.data.id));
    } catch (err) {
      logger.error('room create failed', err, 'NewRoomSheet');
      setError(err instanceof Error ? err.message : COMPANION_COPY.room.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={copy.title} closeLabel={COMPANION_COPY.talk.close}>
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
          {shown.map(p => (
            <li key={p.key}>
              <PickRow pick={p} checked={chosen.includes(p.key)} onPick={() => toggle(p.key)} />
            </li>
          ))}
        </ul>
        <p className="mb-0 text-sm text-fg-secondary">
          {error ?? (enough ? COMPANION_COPY.talk.groupLine(chosen.length) : copy.needTwo)}
        </p>
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={!enough || busy}
          onClick={() => void start()}
        >
          {copy.next}
        </Button>
      </div>
    </Sheet>
  );
}
