'use client';

/**
 * A group chat. Every bot line says who said it (chatkit `speaker`), the
 * status line says who is writing now, and a member that could not answer
 * shows a failed line in its own name rather than silence. The sheet lists
 * who is in the chat and lets the person rename it or delete it.
 */

import { useState } from 'react';
import type { ChatMessageData } from '@bitbaum/chatkit/react';
import { COMPANION_COPY } from '@/config/companions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { outgoing, shownTurn } from './attachments';
import { ChatFrame } from './ChatFrame';
import { Face, GroupFaces } from './CompanionFace';
import { RoomMembers } from './RoomMembers';
import { DetailRow, TalkDetailsSheet } from './TalkDetailsSheet';
import { nameWithJob } from './format';
import type { TalkHomeData } from './types';
import { useRoomTalk } from './useRoomTalk';

export function RoomChat({
  id,
  home,
  onBack,
  onActivity,
  onDeleted,
}: {
  id: string;
  home: TalkHomeData | null;
  onBack: () => void;
  onActivity: () => void;
  onDeleted: () => void;
}) {
  const talk = useRoomTalk(id);
  const [details, setDetails] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const copy = COMPANION_COPY.talk.room;
  const room = talk.room;
  const name = room?.title ?? '…';

  const messages: ChatMessageData[] = talk.lines.map(l => ({
    id: l.id,
    role: l.role,
    ...shownTurn(l.role, l.content),
    speaker:
      l.role === 'assistant' && l.speaker
        ? {
            name: nameWithJob(l.speaker, room?.members.find(m => m.id === l.memberId)?.job),
            id: l.memberId ?? undefined,
          }
        : undefined,
    failed: l.failed,
    failure: l.failure ? { message: l.failure } : undefined,
  }));

  return (
    <>
      <ChatFrame
        title={name}
        face={room ? <GroupFaces members={room.members} size={32} /> : <Face name="?" size={32} />}
        onBack={onBack}
        onDetails={() => setDetails(true)}
        placeholder={copy.placeholder(name)}
        messages={messages}
        live={talk.writing !== null ? { status: copy.working(talk.writing || '…') } : null}
        sending={talk.writing !== null}
        loading={talk.loading}
        onSend={(text, attachments) => {
          if (!text.trim() && attachments.length === 0) {
            return false;
          }
          const { content, images } = outgoing(text.trim(), attachments);
          void talk.send(content, images).then(onActivity);
          return true;
        }}
        onStop={talk.stop}
        showSpeakers
        startersTitle={
          room && (
            <p className="mb-0 text-base text-fg-secondary">
              {room.members.map(m => `@${m.name.replace(/\s+/g, '')}`).join(' · ')}
            </p>
          )
        }
        aboveComposer={
          talk.error ? <p className="mb-2 text-sm text-status-negative">{talk.error}</p> : null
        }
      />
      <TalkDetailsSheet
        open={details}
        onClose={() => setDetails(false)}
        title={name}
        face={room ? <GroupFaces members={room.members} size={96} /> : null}
        lines={[room ? COMPANION_COPY.talk.groupLine(room.members.length) : null]}
      >
        <form
          className="flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            const next = (title ?? name).trim();
            if (next && next !== name) {
              void talk.rename(next).then(onActivity);
            }
          }}
        >
          <Input
            value={title ?? name}
            onChange={e => setTitle(e.target.value)}
            aria-label={copy.rename}
            maxLength={100}
          />
          <Button type="submit" variant="outline">
            {copy.rename}
          </Button>
        </form>
        {room && (
          <RoomMembers
            members={room.members}
            home={home}
            onAdd={member => talk.addMember(member).then(onActivity)}
            onRemove={memberId => talk.removeMember(memberId).then(onActivity)}
          />
        )}
        <div className="flex flex-col">
          <DetailRow
            danger
            onClick={() => {
              if (window.confirm(copy.leaveConfirm)) {
                void talk.remove().then(ok => {
                  if (ok) {
                    setDetails(false);
                    onDeleted();
                  }
                });
              }
            }}
          >
            {copy.leave}
          </DetailRow>
        </div>
      </TalkDetailsSheet>
    </>
  );
}
