'use client';

/**
 * One of the fleet's bots, one to one. The product answers over the shared
 * /api/ask contract; the thread stays in this browser (useFleetTalk), and the
 * sheet says so, with the way to the product itself for everything it does
 * beyond a chat.
 */

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { COMPANION_COPY } from '@/config/companions';
import type { FleetBot } from '@/services/companions/rooms/fleet';
import { ChatFrame } from './ChatFrame';
import { Face } from './CompanionFace';
import { DetailRow, TalkDetailsSheet } from './TalkDetailsSheet';
import { useFleetTalk } from './useFleetTalk';

export function FleetChat({
  slug,
  bot,
  onBack,
  onPreview,
}: {
  slug: string;
  bot: FleetBot | null;
  onBack: () => void;
  onPreview: (slug: string, preview: string | null) => void;
}) {
  const talk = useFleetTalk(slug);
  const [details, setDetails] = useState(false);
  const copy = COMPANION_COPY.talk;
  const name = bot?.name ?? slug;
  const host = bot ? new URL(bot.url).host : '';

  const last = talk.messages.filter(m => !m.failed).at(-1)?.content ?? null;
  useEffect(() => {
    onPreview(slug, last);
  }, [slug, last, onPreview]);

  return (
    <>
      <ChatFrame
        title={name}
        face={<Face name={name} avatarUrl={bot?.mark} size={32} />}
        onBack={onBack}
        onDetails={() => setDetails(true)}
        placeholder={copy.fleet.placeholder(name)}
        messages={talk.messages}
        live={talk.sending ? { status: copy.fleet.working(name) } : null}
        sending={talk.sending}
        onSend={talk.send}
        onStop={talk.stop}
        onRetry={talk.retry}
        startersTitle={
          <div className="flex flex-col gap-2">
            {bot?.job && <p className="mb-0 text-base text-fg-primary">{bot.job}</p>}
            {bot && (
              <a
                href={bot.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1 text-base text-fg-primary underline underline-offset-4"
              >
                {copy.fleet.open(name)}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
            <p className="mb-0 text-xs text-fg-muted">{copy.fleet.keptHere}</p>
          </div>
        }
        footnote={host ? copy.fleetLine(host) : copy.fleetUnreachable}
      />
      <TalkDetailsSheet
        open={details}
        onClose={() => setDetails(false)}
        title={name}
        face={<Face name={name} avatarUrl={bot?.mark} size={96} />}
        lines={[
          bot?.what,
          host ? copy.fleetLine(host) : copy.fleetUnreachable,
          copy.fleet.keptHere,
        ]}
      >
        <div className="flex flex-col">
          {bot && <DetailRow href={bot.url}>{copy.fleet.open(name)}</DetailRow>}
          <DetailRow
            onClick={() => {
              talk.clear();
              setDetails(false);
            }}
          >
            {COMPANION_COPY.room.newConversation}
          </DetailRow>
        </div>
      </TalkDetailsSheet>
    </>
  );
}
