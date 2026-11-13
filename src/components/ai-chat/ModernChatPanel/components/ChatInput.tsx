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
import type { ComposerVoice } from '@bitbaum/chatkit/react';
import '@bitbaum/chatkit/styles.css';
import { cn } from '@/lib/utils';
import { CAT_HUB_COPY } from '@/config/cat-hub';
import { CHAT_CONTENT_MAX_WIDTH_CLASS } from '@/config/layout-chrome';
import { CHAT_VOICE } from '@/hooks/useDictation';

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
  /** The microphone. Defaults to the Cat's (server transcription, signed in). */
  voice?: ComposerVoice;
}

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
  voice = CHAT_VOICE,
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
          voice={voice}
          labels={{ send: sendLabel, stop: 'Stop generating', voice: 'Dictate your message' }}
        />
      </div>
    </div>
  );
}
