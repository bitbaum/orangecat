'use client';

/**
 * CHAT INPUT — the composer for the app's conversations that are not the
 * Cat chat: the companion room, and the dashboard's door into the Cat.
 *
 * The box itself is `@bitbaum/chatkit`'s `Composer`: auto-growing input, Enter
 * sends and Shift+Enter breaks the line, 16px text so a phone never zooms, and
 * a microphone that never goes dead. The Cat chat itself is chatkit's whole
 * `ChatApp` (ModernChatPanel), whose composer is the same `Composer`.
 *
 * `placement` decides where it lives, not how it looks: `bottom` pins it under
 * a thread; `inline` drops the pinning chrome so a page can place it in its
 * own column.
 */

import { Composer } from '@bitbaum/chatkit/react';
import type { ComposerSendResult } from '@bitbaum/chatkit';
import '@bitbaum/chatkit/styles.css';
import { cn } from '@/lib/utils';
import { CAT_HUB_COPY } from '@/config/cat-hub';
import { CHAT_CONTENT_MAX_WIDTH_CLASS } from '@/config/layout-chrome';
import { API_ROUTES } from '@/config/api-routes';
import { transcribeWithRoute } from '@/hooks/useDictation';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => ComposerSendResult | Promise<ComposerSendResult>;
  isLoading: boolean;
  onStop?: () => void;
  /** `inline` = inside the page's own column; `bottom` = pinned under the thread. */
  placement?: 'bottom' | 'inline';
  /** Prompt text. Defaults to Cat's. */
  placeholder?: string;
  ariaLabel?: string;
  sendLabel?: string;
  autoFocus?: boolean;
  sendBlockedReason?: string | null;
}

/** One transcription route for every microphone in the app; see useDictation. */
const transcribe = transcribeWithRoute(API_ROUTES.CAT.TRANSCRIBE);

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  onStop,
  placement = 'bottom',
  placeholder = CAT_HUB_COPY.composerPlaceholder,
  ariaLabel = placeholder,
  sendLabel = 'Send message',
  autoFocus,
  sendBlockedReason,
}: ChatInputProps) {
  const isInline = placement === 'inline';

  return (
    <div
      className={cn(
        '[--ck-accent:hsl(var(--text-primary))] [--ck-on-accent:hsl(var(--text-inverted))]',
        isInline ? 'w-full' : 'oc-chat-composer-wrap'
      )}
    >
      <div className={cn('mx-auto w-full', !isInline && CHAT_CONTENT_MAX_WIDTH_CLASS)}>
        <Composer
          value={value}
          onValueChange={onChange}
          // The page owns the draft; it reads it when told.
          onSend={() => onSend()}
          placeholder={placeholder}
          ariaLabel={ariaLabel}
          sendBlockedReason={sendBlockedReason}
          sending={isLoading}
          onStop={onStop}
          autoFocus={autoFocus ?? isInline}
          voice={{ prefer: 'server', transcribe }}
          labels={{ send: sendLabel, stop: 'Stop generating', voice: 'Dictate your message' }}
        />
      </div>
    </div>
  );
}
