'use client';

import React from 'react';
import { Send } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { Message } from '@/features/messaging/types';
import { useMessageComposer } from './useMessageComposer';
import { MessageActorSelector } from './MessageActorSelector';
import MentionSuggestions from '@/components/mentions/MentionSuggestions';
import { textareaSurface } from '@/components/mentions/caret';
import { useMentionAutocomplete } from '@/hooks/useMentionAutocomplete';

interface MessageComposerProps {
  conversationId: string;
  onMessageSent: (message: Message) => void;
  onMessageFailed?: (tempId: string, errorMessage?: string) => void;
  onMessageConfirmed?: (tempId: string, realMessage: Message) => void;
}

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
    handleKeyDown,
    handleTextareaChange,
  } = useMessageComposer({ conversationId, onMessageSent, onMessageFailed, onMessageConfirmed });

  const mentions = useMentionAutocomplete({
    surface: textareaSurface(textareaRef),
    disabled: isSending,
  });

  // Order matters: the menu sees the key first, because Enter means "pick this
  // person" while it is open and "send the message" the rest of the time.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (mentions.handleKeyDown(event)) {
      return;
    }
    handleKeyDown(event);
  };

  const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleTextareaChange(event);
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

      <form onSubmit={handleSubmit} className="flex items-end gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <MentionSuggestions
            items={mentions.items}
            activeIndex={mentions.activeIndex}
            onPick={mentions.pick}
            onHover={mentions.setActiveIndex}
            placement="above"
            idPrefix="dm-mention"
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onClick={mentions.refresh}
            onBlur={mentions.close}
            role="combobox"
            aria-expanded={mentions.open}
            aria-controls="dm-mention-listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              mentions.open ? `dm-mention-option-${mentions.activeIndex}` : undefined
            }
            aria-label="Message"
            placeholder="Type a message..."
            className={cn(
              'w-full resize-none rounded-md border border-subtle py-2.5 pl-3 pr-3 text-base sm:py-3 sm:pl-4 sm:pr-4 sm:text-base',
              'bg-surface-page text-fg-primary',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-interactive',
              'max-h-32 min-h-11',
              'placeholder:text-fg-tertiary',
              isSending && 'opacity-50 cursor-not-allowed'
            )}
            rows={1}
            disabled={isSending}
          />
        </div>

        <Button
          type="submit"
          size="sm"
          className={cn(
            'rounded-md bg-fg-primary px-3 py-2.5 text-fg-inverted hover:bg-fg-primary/90 sm:px-4 sm:py-3',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200 flex-shrink-0',
            'min-w-11 sm:min-w-[auto]'
          )}
          disabled={!content.trim() || isSending}
          aria-label="Send message"
        >
          {isSending ? (
            <div className="h-4 w-4 animate-spin rounded-sm border-2 border-surface-page border-t-transparent sm:h-5 sm:w-5" />
          ) : (
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </Button>
      </form>

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
