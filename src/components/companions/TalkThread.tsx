'use client';

/**
 * The thread, read as a page: the companion's turns are the prose, the
 * person's turns are the margin notes. No bubbles, no avatars, no timestamps,
 * no chips — one voice is the page and the other is secondary, so the eye
 * knows the hierarchy without reading.
 */

import { useEffect, useRef } from 'react';
import { renderChatMarkdown } from '@/utils/markdown';
import { COMPANION_COPY } from '@/config/companions';
import type { TalkMessage } from './useCompanionTalk';

interface TalkThreadProps {
  name: string;
  messages: TalkMessage[];
  /** Shown as the companion's first line when the thread is empty. */
  opening?: string | null;
  thinking: boolean;
}

export function TypingDot({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-2" role="status" aria-label={label}>
      <span className="h-2 w-2 animate-pulse rounded-full bg-fg-secondary" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function TalkThread({ name, messages, opening, thinking }: TalkThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, thinking]);

  const showOpening = messages.length === 0 && !!opening;

  return (
    <div className="flex flex-col gap-6 py-6">
      {showOpening && (
        <div className="text-base leading-relaxed text-fg-primary">
          {renderChatMarkdown(opening!)}
        </div>
      )}
      {messages.length === 0 && !opening && (
        <p className="text-sm text-fg-tertiary">{COMPANION_COPY.room.emptyThread}</p>
      )}
      {messages.map(m =>
        m.role === 'assistant' ? (
          <div key={m.id} className="text-base leading-relaxed text-fg-primary">
            {renderChatMarkdown(m.content)}
          </div>
        ) : (
          <p
            key={m.id}
            className="whitespace-pre-wrap pl-4 text-sm leading-relaxed text-fg-secondary"
          >
            {m.content}
          </p>
        )
      )}
      {thinking && <TypingDot label={COMPANION_COPY.room.thinking(name)} />}
      <div ref={endRef} />
    </div>
  );
}
