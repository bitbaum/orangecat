'use client';

/**
 * The talk home: the list on the left, the open chat on the right; on a phone
 * one or the other, the address deciding which. The list is loaded once and
 * refreshed after every turn, so the last line and the order stay true.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import { APP_CONTENT_HEIGHT_CLASS } from '@/config/layout-chrome';
import { ROUTES } from '@/config/routes';
import type { CompanionRow } from '@/services/companions/talk-home';
import { logger } from '@/utils/logger';
import { CatChat } from './CatChat';
import { CompanionChat } from './CompanionChat';
import { FleetChat } from './FleetChat';
import { NewCompanionSheet } from './NewCompanionSheet';
import { NewRoomSheet } from './NewRoomSheet';
import { RoomChat } from './RoomChat';
import { TalkList } from './TalkList';
import { targetFromParams, type TalkHomeData } from './types';

interface Envelope<T> {
  data?: T;
}

export function TalkHome() {
  const router = useRouter();
  const params = useSearchParams();
  const target = targetFromParams(params);
  const [home, setHome] = useState<TalkHomeData | null>(null);
  const [fleetPreviews, setFleetPreviews] = useState<Record<string, string | null>>({});
  const [sheet, setSheet] = useState<'companion' | 'room' | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.TALK);
      const json = (await res.json()) as Envelope<TalkHomeData>;
      if (res.ok && json.data) {
        setHome(json.data);
      }
    } catch (err) {
      logger.error('talk home failed to load', err, 'TalkHome');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A companion opened from a link, not yet on the list: fetch its name so
  // the header and the list can show it (RLS decides whether it exists).
  const companionId = target?.kind === 'companion' ? target.id : null;
  const known = companionId ? home?.companions.find(c => c.id === companionId) : undefined;
  useEffect(() => {
    if (!companionId || !home || known) {
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.BY_ID(companionId));
      const json = (await res.json().catch(() => ({}))) as Envelope<Record<string, unknown>>;
      if (cancelled || !res.ok || !json.data) {
        return;
      }
      const a = json.data;
      const row: CompanionRow = {
        id: companionId,
        title: String(a.title ?? ''),
        description: (a.description as string | null) ?? null,
        avatarUrl: (a.avatar_url as string | null) ?? null,
        welcomeMessage: (a.welcome_message as string | null) ?? null,
        mine: false,
        lastAt: null,
        preview: null,
      };
      setHome(h =>
        h && !h.companions.some(c => c.id === row.id)
          ? { ...h, companions: [...h.companions, row] }
          : h
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [companionId, home, known]);

  const back = useCallback(() => router.push(ROUTES.AI_ASSISTANTS.TALK), [router]);
  const onPreview = useCallback(
    (slug: string, preview: string | null) =>
      setFleetPreviews(p => (p[slug] === preview ? p : { ...p, [slug]: preview })),
    []
  );

  let conversation: React.ReactNode = null;
  if (target?.kind === 'cat') {
    conversation = <CatChat onBack={back} />;
  } else if (target?.kind === 'companion') {
    conversation = (
      <CompanionChat
        key={target.id}
        id={target.id}
        row={known ?? null}
        onBack={back}
        onActivity={() => void load()}
      />
    );
  } else if (target?.kind === 'fleet') {
    conversation = (
      <FleetChat
        key={target.slug}
        slug={target.slug}
        bot={home?.fleet.bots.find(b => b.slug === target.slug) ?? null}
        onBack={back}
        onPreview={onPreview}
      />
    );
  } else if (target?.kind === 'room') {
    conversation = (
      <RoomChat
        key={target.id}
        id={target.id}
        home={home}
        onBack={back}
        onActivity={() => void load()}
        onDeleted={() => {
          void load();
          back();
        }}
      />
    );
  }

  return (
    <div className={`flex min-h-0 ${APP_CONTENT_HEIGHT_CLASS}`}>
      <aside
        className={`${target ? 'hidden lg:flex' : 'flex'} min-h-0 w-full flex-col border-subtle lg:w-80 lg:shrink-0 lg:border-r`}
      >
        <TalkList
          home={home}
          open={target}
          fleetPreviews={fleetPreviews}
          onNewCompanion={() => setSheet('companion')}
          onNewRoom={() => setSheet('room')}
        />
      </aside>
      <section
        className={`${target ? 'flex' : 'hidden lg:flex'} relative min-h-0 min-w-0 flex-1 flex-col`}
      >
        {conversation ?? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <p className="mb-0 max-w-prose text-base text-fg-secondary">
              {COMPANION_COPY.talk.empty.body}
            </p>
          </div>
        )}
      </section>
      <NewCompanionSheet open={sheet === 'companion'} onClose={() => setSheet(null)} />
      <NewRoomSheet open={sheet === 'room'} home={home} onClose={() => setSheet(null)} />
    </div>
  );
}
