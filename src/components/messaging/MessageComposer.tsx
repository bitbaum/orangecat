'use client';

import React, { useEffect } from 'react';
import { Composer } from '@bitbaum/chatkit/react';
import '@bitbaum/chatkit/styles/chat.css';
import Button from '@/components/ui/Button';
import type { Message } from '@/features/messaging/types';
import { useMessageComposer } from './useMessageComposer';
import { MessageActorSelector } from './MessageActorSelector';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { insertCatMention } from './insert-cat-mention';
import MentionSuggestions from '@/components/mentions/MentionSuggestions';
import { textareaSurface } from '@/components/mentions/caret';
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';
import { CHAT_VOICE } from '@/hooks/useDictation';

interface MessageComposerProps {
  conversationId: string;
  onMessageSent: (message: Message) => void;
  onMessageFailed?: (tempId: string, errorMessage?: string) => void;
  onMessageConfirmed?: (tempId: string, realMessage: Message) => void;
}

/**
 * The box under a conversation. It is `@bitbaum/chatkit`'s `Composer` — the
 * same box as the Cat's — so a direct message gets the microphone (speak,
 * and the words land in the box), Enter-to-send and auto-grow from the
 * package instead of a hand-made `<textarea>` (owner, 2026-11-04: "no way to
 * send a voice message"). What stays here is what only Messages has: the
 * @mention menu, "Ask Cat", and sending as one of your groups.
 */
export default function MessageComposer({
  conversationId,
  onMessageSent,
  onMessageFailed,
  onMessageConfirmed,
}: MessageComposerProps) {
  const {
    content,
    isSending,
    textareaRef,
    selectedActor,
    selectedActorId,
    setSelectedActorId,
    showActorSelector,
    personalActor,
    groupActors,
    typingText,
    handleSubmit,
    handleTextChange,
  } = useMessageComposer({ conversationId, onMessageSent, onMessageFailed, onMessageConfirmed });

  const mentions = useMentionAutocomplete({
    surface: textareaSurface(textareaRef),
    disabled: isSending,
  });

  // The mention menu is a combobox on the box chatkit renders.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.setAttribute('role', 'combobox');
    el.setAttribute('aria-autocomplete', 'list');
    el.setAttribute('aria-controls', 'dm-mention-listbox');
    el.setAttribute('aria-expanded', String(mentions.open));
    if (mentions.open) {
      el.setAttribute('aria-activedescendant', `dm-mention-option-${mentions.activeIndex}`);
    } else {
      el.removeAttribute('aria-activedescendant');
    }
  }, [textareaRef, mentions.open, mentions.activeIndex]);

  // Order matters: the menu sees the key first, because Enter means "pick this
  // person" while it is open and "send the message" the rest of the time. The
  // capture phase runs before the Composer's own Enter-to-send.
  const onKeyDownCapture = (event: React.KeyboardEvent) => {
    if (mentions.handleKeyDown(event)) {
      event.stopPropagation();
    }
  };

  const onValueChange = (text: string) => {
    handleTextChange(text);
    mentions.refresh();
  };

  return (
    <div className="shrink-0 border-t border-subtle bg-surface-page p-3 sm:p-4">
      {showActorSelector && selectedActor && (
        <MessageActorSelector
          selectedActor={selectedActor}
          selectedActorId={selectedActorId}
          personalActor={personalActor}
          groupActors={groupActors}
          onSelectActor={setSelectedActorId}
        />
      )}

      <div
        className="relative [--ck-accent:hsl(var(--text-primary))] [--ck-on-accent:hsl(var(--text-inverted))]"
        onKeyDownCapture={onKeyDownCapture}
        onClickCapture={mentions.refresh}
        onBlurCapture={mentions.close}
      >
        <MentionSuggestions
          items={mentions.items}
          activeIndex={mentions.activeIndex}
          onPick={mentions.pick}
          onHover={mentions.setActiveIndex}
          placement="above"
          idPrefix="dm-mention"
        />
        <Composer
          value={content}
          onValueChange={onValueChange}
          inputRef={textareaRef}
          onSend={async () => {
            await handleSubmit();
          }}
          placeholder="Message — type @cat to bring Cat in"
          ariaLabel="Message"
          sending={isSending}
          density="compact"
          voice={CHAT_VOICE}
          labels={{ send: 'Send message', voice: 'Speak your message' }}
          tools={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertCatMention(textareaRef.current)}
              disabled={isSending}
              className="min-h-9 flex-shrink-0 gap-1.5 px-3"
              aria-label="Ask Cat in this conversation"
              title="Bring Cat into this conversation — everyone here sees its answer"
            >
              <BrandMarkIcon size={18} />
              <span className="hidden sm:inline">Ask Cat</span>
            </Button>
          }
        />
      </div>

      {typingText && (
        <div className="mt-2 text-xs text-fg-secondary flex items-center gap-1">
          <span className="inline-flex gap-0.5">
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-sm bg-fg-secondary"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-sm bg-fg-secondary"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="h-1.5 w-1.5 animate-bounce rounded-sm bg-fg-secondary"
              style={{ animationDelay: '300ms' }}
            />
          </span>
          <span>{typingText}</span>
        </div>
      )}
    </div>
  );
}
