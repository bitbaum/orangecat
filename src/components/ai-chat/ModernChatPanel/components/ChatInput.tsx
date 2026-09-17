/**
 * CHAT INPUT — composer pinned to the bottom of the panel.
 *
 * Best-in-class composer affordances (benchmarked against ChatGPT/Claude/Grok/
 * Gemini): model selector at the point of typing, and voice dictation in-bar.
 * The model selector renders here in the focus variant (the dedicated Cat page),
 * where the header — which carries it in the embedded variant — isn't shown.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Send, Square, Trash2 } from 'lucide-react';
import { CAT_HUB_COPY } from '@/config/cat-hub';
import { CHAT_CONTENT_MAX_WIDTH_CLASS } from '@/config/layout-chrome';
import { DictationButton } from '@/components/ui/DictationButton';
import { ModelSelector } from './ModelSelector';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onStop?: () => void;
  variant?: 'default' | 'focus';
  hasMessages?: boolean;
  onClearChat?: () => void;
  /** Model picker — surfaced at the composer in the focus variant. */
  selectedModel?: string;
  onModelSelect?: (model: string) => void;
  /**
   * Prompt text. Defaults to Cat's. The only thing that was hard-wired to one
   * surface in here — every Cat-specific control above is already an optional
   * prop, which is what makes this composer the one the whole app uses.
   */
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  onStop,
  variant = 'focus',
  hasMessages,
  onClearChat,
  selectedModel,
  onModelSelect,
  placeholder = CAT_HUB_COPY.composerPlaceholder,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isFocus = variant === 'focus';
  const showModelSelector = isFocus && !!onModelSelect && !!selectedModel;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  // Keyed on `value` (not the onChange event) so the textarea also resizes
  // when it changes programmatically — cleared after send, or grown after a
  // dictated transcript is inserted — not just while the user is typing.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Dictation appends to whatever is already typed, so voice + keyboard mix.
  const handleTranscript = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    onChange(value.trim() ? `${value.trim()} ${trimmed}` : trimmed);
    inputRef.current?.focus();
  };

  const showClear = isFocus && hasMessages && !!onClearChat;
  const canSend = !!value.trim() && !isLoading;

  return (
    <div className={cn(isFocus ? 'oc-chat-composer-wrap' : 'border-t border-subtle p-4')}>
      <div className={cn('mx-auto w-full', CHAT_CONTENT_MAX_WIDTH_CLASS)}>
        {/* One integrated control: textarea on top, a single control row below
            (model picker + clear on the left, dictation + send on the right). */}
        <div className={cn('oc-chat-composer', !isFocus && 'rounded-md')}>
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="oc-chat-composer-input"
          />

          <div className="oc-chat-composer-controls">
            <div className="flex min-w-0 items-center gap-0.5">
              {showModelSelector && (
                <ModelSelector
                  selectedModel={selectedModel}
                  onSelect={onModelSelect}
                  disabled={isLoading}
                  openUp
                  subtle
                />
              )}
              {showClear && (
                <button
                  type="button"
                  onClick={onClearChat}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-shrink-0 items-center gap-0.5">
              <DictationButton
                onTranscript={handleTranscript}
                size="sm"
                disabled={isLoading}
                ariaLabel="Dictate your message"
              />
              {isLoading && onStop ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-fg-primary text-fg-inverted transition-opacity hover:opacity-90"
                  aria-label="Stop generating"
                  title="Stop generating"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={!canSend}
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors',
                    canSend
                      ? 'bg-fg-primary text-fg-inverted hover:opacity-90'
                      : 'cursor-not-allowed text-fg-secondary'
                  )}
                  aria-label="Send message"
                  title="Send message (Enter)"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
