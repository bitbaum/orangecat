'use client';

/**
 * The conversation as the screen, the same for a companion, a fleet bot and
 * a group chat: chatkit's ChatScreen with a frosted header (back on a phone ·
 * the face and the name · details), the thread, and the composer with the
 * microphone. Only the words and the data differ; the frame never does.
 */

import type { ReactNode } from 'react';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import {
  ChatScreen,
  ChatThread,
  Composer,
  type ChatMessageData,
  type LiveTurn,
  type Starter,
} from '@bitbaum/chatkit/react';
import '@bitbaum/chatkit/styles.css';
import { ChatStarters } from '@bitbaum/chatkit/react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import { transcribeWithRoute } from '@/hooks/useDictation';

/** One transcription route for every microphone in the app; see useDictation. */
const transcribe = transcribeWithRoute(API_ROUTES.CAT.TRANSCRIBE);

export function ChatFrame({
  title,
  face,
  onBack,
  onDetails,
  placeholder,
  messages,
  live,
  sending,
  onSend,
  onStop,
  onRetry,
  starters,
  startersTitle,
  showSpeakers,
  aboveComposer,
  footnote,
  loading,
}: {
  title: string;
  face: ReactNode;
  onBack: () => void;
  onDetails: () => void;
  placeholder: string;
  messages: ChatMessageData[];
  live: LiveTurn | null;
  sending: boolean;
  onSend: (text: string) => boolean | Promise<boolean>;
  onStop?: () => void;
  onRetry?: () => void;
  starters?: readonly Starter[];
  startersTitle?: ReactNode;
  showSpeakers?: boolean;
  aboveComposer?: ReactNode;
  footnote?: ReactNode;
  loading?: boolean;
}) {
  const copy = COMPANION_COPY.talk;
  return (
    <ChatScreen
      fill="parent"
      header={
        <>
          <button
            type="button"
            className="ck-glass lg:hidden"
            aria-label={copy.back}
            onClick={onBack}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ck-glass flex items-center gap-2 pl-1 pr-3"
            onClick={onDetails}
            aria-label={`${title} · ${copy.details}`}
          >
            {face}
            <span className="max-w-[40vw] truncate text-base font-medium">{title}</span>
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="ck-glass" aria-label={copy.details} onClick={onDetails}>
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      }
      composer={
        <>
          {aboveComposer}
          <Composer
            onSend={text => onSend(text)}
            placeholder={placeholder}
            sending={sending}
            onStop={onStop}
            voice={{ transcribe }}
            attach={false}
          />
        </>
      }
      footnote={footnote}
    >
      <ChatThread
        messages={messages}
        live={live}
        loading={loading}
        onStop={onStop}
        onRetry={onRetry}
        onReply={text => void onSend(text)}
        showSpeakers={showSpeakers}
        share={false}
        empty={
          starters && starters.length > 0 ? (
            <div className="flex flex-col gap-3">
              {startersTitle}
              <ChatStarters starters={starters} onPick={text => void onSend(text)} />
            </div>
          ) : (
            startersTitle
          )
        }
      />
    </ChatScreen>
  );
}
