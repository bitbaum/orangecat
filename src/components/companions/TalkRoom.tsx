'use client';

/**
 * The room: a companion's conversation as the page.
 *
 * A conversation looks the same everywhere in this app. The turns and the
 * composer are Cat's own components — every Cat-specific control in them
 * (actions, quick replies, model picker, clear, stop) is an optional prop, so
 * a companion simply passes none of them. This file is only the ROOM: full
 * height, a one-line header, past conversations, and the credits notice.
 */

import { useState } from 'react';
import Link from 'next/link';
import { APP_CONTENT_HEIGHT_CLASS } from '@/config/layout-chrome';
import { COMPANION_COPY } from '@/config/companions';
import { ROUTES } from '@/config/routes';
import { APP_LOCALE } from '@/utils/locale';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import Button from '@/components/ui/Button';
import { MessageBubble } from '@/components/ai-chat/ModernChatPanel/components/MessageBubble';
import { ChatInput } from '@/components/ai-chat/ModernChatPanel/components/ChatInput';
import type { Message } from '@/components/ai-chat/ModernChatPanel/types';
import { useCompanionTalk, type TalkThreadSummary, type TalkMessage } from './useCompanionTalk';

export interface TalkRoomProps {
  companion: {
    id: string;
    title: string;
    welcome_message: string | null;
  };
}

/**
 * A companion turn as the shared chat surface wants it. Everything beyond
 * these four fields on `Message` is Cat machinery and stays undefined.
 */
function asMessage(m: TalkMessage): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.created_at),
  };
}

function threadLabel(t: TalkThreadSummary): string {
  const when = new Date(t.last_message_at ?? t.created_at);
  const date = when.toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short' });
  return t.title ? `${date} · ${t.title}` : date;
}

export function TalkRoom({ companion }: TalkRoomProps) {
  const name = companion.title;
  const talk = useCompanionTalk(companion.id);
  const { formatAmountBtc } = useDisplayCurrency();
  const [showThreads, setShowThreads] = useState(false);
  const [draft, setDraft] = useState('');
  const room = COMPANION_COPY.room;

  return (
    <div className={`oc-chat-layout ${APP_CONTENT_HEIGHT_CLASS} bg-surface-page`}>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 text-sm">
        <Link
          href={ROUTES.AI_ASSISTANTS.VIEW(companion.id)}
          className="font-medium text-fg-primary"
        >
          {name}
        </Link>
        <nav className="flex items-center gap-4 text-fg-tertiary">
          <button
            type="button"
            className="hover:text-fg-primary"
            onClick={() => setShowThreads(v => !v)}
            aria-expanded={showThreads}
          >
            {room.pastConversations}
          </button>
          <Link
            href={`${ROUTES.AI_ASSISTANTS.VIEW(companion.id)}/memory`}
            className="hover:text-fg-primary"
          >
            {room.remembers(name)}
          </Link>
        </nav>
      </header>

      {showThreads && (
        <div className="mx-auto w-full max-w-2xl px-4 pb-2">
          <div className="rounded-md border border-subtle bg-surface-base p-2 text-sm">
            <button
              type="button"
              className="block w-full rounded px-2 py-1.5 text-left text-fg-primary hover:bg-surface-hover"
              onClick={() => {
                talk.startNewThread();
                setShowThreads(false);
              }}
            >
              {room.newConversation}
            </button>
            {talk.threads.map(t => (
              <button
                key={t.id}
                type="button"
                className={`block w-full rounded px-2 py-1.5 text-left hover:bg-surface-hover ${
                  t.id === talk.activeId ? 'text-fg-primary' : 'text-fg-secondary'
                }`}
                onClick={() => {
                  void talk.loadThread(t.id);
                  setShowThreads(false);
                }}
              >
                {threadLabel(t)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="oc-chat-scroll">
        <div className="mx-auto w-full max-w-2xl px-4">
          {talk.messages.length === 0 && !talk.loading && (
            <p className="pt-2 text-xs text-fg-muted">{COMPANION_COPY.disclosure(name)}</p>
          )}
          {!talk.loading && (
            <>
              {talk.messages.length === 0 && companion.welcome_message && (
                <MessageBubble
                  message={asMessage({
                    id: 'opening',
                    role: 'assistant',
                    content: companion.welcome_message,
                    created_at: new Date().toISOString(),
                  })}
                  isLast
                />
              )}
              {talk.messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={asMessage(m)}
                  isLast={i === talk.messages.length - 1}
                />
              ))}
              {talk.sending && (
                <div className="flex items-center gap-2 py-3" role="status">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-fg-secondary" />
                  <span className="sr-only">{room.thinking(name)}</span>
                </div>
              )}
            </>
          )}
          {talk.creditsNeeded && (
            <div className="mb-4 rounded-md border border-subtle bg-surface-raised p-3 text-sm">
              <p className="text-fg-primary">
                {room.notEnoughCredits} You need {formatAmountBtc(talk.creditsNeeded.required)} and
                have {formatAmountBtc(talk.creditsNeeded.balance)}.
              </p>
              <Link href={ROUTES.SETTINGS_AI} className="mt-2 inline-block">
                <Button variant="accent" size="sm">
                  {room.topUp}
                </Button>
              </Link>
            </div>
          )}
          {talk.error && <p className="mb-4 text-sm text-status-negative">{room.sendFailed}</p>}
        </div>
      </div>

      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={() => {
          const content = draft.trim();
          if (!content) {
            return;
          }
          setDraft('');
          void talk.send(content);
        }}
        isLoading={talk.sending || talk.loading}
        placeholder={room.composerPlaceholder(name)}
      />
    </div>
  );
}
