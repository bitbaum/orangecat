'use client';

/**
 * One companion, one to one — the old room, inside the talk home. The turns
 * are the companion's own threads (useCompanionTalk: resume, 402 → top up),
 * drawn by chatkit. A companion made in a minute asks what it is for; that
 * question and its choices are the starters of its first chat.
 */

import { useState } from 'react';
import type { ChatMessageData } from '@bitbaum/chatkit/react';
import { COMPANION_COPY } from '@/config/companions';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { visibleReply } from '@/services/companions/memory-lines';
import type { CompanionRow } from '@/services/companions/talk-home';
import { useCompanionTalk } from '../useCompanionTalk';
import { outgoing, shownUserTurn } from './attachments';
import { ChatFrame } from './ChatFrame';
import { Face } from './CompanionFace';
import { DetailRow, TalkDetailsSheet } from './TalkDetailsSheet';
import { whenLabel } from './format';

export function CompanionChat({
  id,
  row,
  onBack,
  onActivity,
}: {
  id: string;
  row: CompanionRow | null;
  onBack: () => void;
  onActivity: () => void;
}) {
  const talk = useCompanionTalk(id);
  const { formatAmountBtc } = useDisplayCurrency();
  const [details, setDetails] = useState(false);
  const copy = COMPANION_COPY.talk;
  const name = row?.title ?? '…';

  const messages: ChatMessageData[] = talk.messages.map(m => ({
    id: m.id,
    role: m.role,
    ...(m.role === 'assistant' ? { content: visibleReply(m.content) } : shownUserTurn(m.content)),
  }));
  if (messages.length === 0 && row?.welcomeMessage && !talk.loading) {
    messages.unshift({ id: 'opening', role: 'assistant', content: row.welcomeMessage });
  }
  // Still waiting for its job: the starters ask it. A shelf bot has a job
  // from the start, so it never asks.
  const fresh = Boolean(row?.mine && !row.description);

  return (
    <>
      <ChatFrame
        title={name}
        face={<Face name={name} avatarUrl={row?.avatarUrl} size={32} />}
        onBack={onBack}
        onDetails={() => setDetails(true)}
        placeholder={copy.companion.placeholder(name)}
        messages={messages}
        live={talk.sending ? { status: copy.companion.working(name) } : null}
        sending={talk.sending}
        loading={talk.loading}
        onSend={(text, attachments) => {
          if ((!text.trim() && attachments.length === 0) || talk.sending) {
            return false;
          }
          const { content, images } = outgoing(text.trim(), attachments);
          // A send that did not go through leaves the words in the box: the
          // person retries with a tap, or takes the way out the chat offers.
          return talk.send(content, images).then(ok => {
            onActivity();
            return ok;
          });
        }}
        starters={fresh ? copy.starters.firstOptions : undefined}
        startersTitle={
          <div className="flex flex-col gap-1">
            {fresh && (
              <p className="mb-0 text-base text-fg-primary">{copy.starters.firstQuestion}</p>
            )}
            <p className="mb-0 text-xs text-fg-muted">{COMPANION_COPY.disclosure(name)}</p>
          </div>
        }
        aboveComposer={
          <>
            {talk.creditsNeeded && (
              <div className="mb-2 rounded-2xl border border-subtle bg-surface-raised p-3 text-sm">
                <p className="mb-2 text-fg-primary">
                  {COMPANION_COPY.room.notEnoughCredits} You need{' '}
                  {formatAmountBtc(talk.creditsNeeded.required)} and have{' '}
                  {formatAmountBtc(talk.creditsNeeded.balance)}.
                </p>
                <Button href={ROUTES.SETTINGS_AI} variant="primary" size="sm">
                  {COMPANION_COPY.room.topUp}
                </Button>
              </div>
            )}
            {talk.error && (
              <div className="mb-2 rounded-2xl border border-subtle bg-surface-raised p-3 text-sm">
                <p
                  className={`mb-0 ${talk.limitReached ? 'text-fg-primary' : 'text-status-negative'}`}
                >
                  {talk.limitReached ? talk.error : COMPANION_COPY.room.sendFailed}
                </p>
                {talk.limitReached && (
                  <Button href={ROUTES.SETTINGS_AI} variant="primary" size="sm" className="mt-2">
                    {COMPANION_COPY.room.liftLimit}
                  </Button>
                )}
              </div>
            )}
          </>
        }
      />
      <TalkDetailsSheet
        open={details}
        onClose={() => setDetails(false)}
        title={name}
        face={<Face name={name} avatarUrl={row?.avatarUrl} size={96} />}
        lines={[row?.description, COMPANION_COPY.disclosure(name)]}
      >
        <div className="flex flex-col">
          <DetailRow href={ROUTES.AI_ASSISTANTS.VIEW(id)}>{copy.companion.profile}</DetailRow>
          <DetailRow href={`${ROUTES.AI_ASSISTANTS.VIEW(id)}/memory`}>
            {copy.companion.memory(name)}
          </DetailRow>
          {row?.mine && (
            <DetailRow href={`${ENTITY_REGISTRY['ai_assistant'].createPath}?edit=${id}`}>
              {copy.companion.edit}
            </DetailRow>
          )}
          <DetailRow
            onClick={() => {
              talk.startNewThread();
              setDetails(false);
            }}
          >
            {COMPANION_COPY.room.newConversation}
          </DetailRow>
          {talk.threads.length > 0 && (
            <p className="mb-0 mt-3 px-4 text-xs uppercase tracking-wide text-fg-tertiary">
              {COMPANION_COPY.room.pastConversations}
            </p>
          )}
          {talk.threads.map(t => (
            <DetailRow
              key={t.id}
              onClick={() => {
                void talk.loadThread(t.id);
                setDetails(false);
              }}
            >
              <span className={t.id === talk.activeId ? 'text-fg-primary' : 'text-fg-secondary'}>
                {whenLabel(t.last_message_at ?? t.created_at)}
                {t.title ? ` · ${t.title}` : ''}
              </span>
            </DetailRow>
          ))}
        </div>
      </TalkDetailsSheet>
    </>
  );
}
