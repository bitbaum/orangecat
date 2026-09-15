'use client';

/**
 * One textarea, one button. Enter sends, Shift+Enter breaks a line. The send
 * button is the only accent on the page.
 */

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import Button from '@/components/ui/Button';
import { COMPANION_COPY } from '@/config/companions';

interface TalkComposerProps {
  name: string;
  disabled?: boolean;
  onSend: (content: string) => Promise<void> | void;
}

export function TalkComposer({ name, disabled = false, onSend }: TalkComposerProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(async () => {
    const content = value.trim();
    if (!content || disabled) {
      return;
    }
    setValue('');
    if (ref.current) {
      ref.current.style.height = 'auto';
    }
    await onSend(content);
    ref.current?.focus();
  }, [value, disabled, onSend]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form
      className="flex items-end gap-2 border-t border-subtle bg-surface-base px-3 py-3"
      onSubmit={e => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={e => {
          setValue(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
        }}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={COMPANION_COPY.room.composerPlaceholder(name)}
        aria-label={COMPANION_COPY.room.composerPlaceholder(name)}
        disabled={disabled}
        className="min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-base leading-relaxed text-fg-primary placeholder:text-fg-tertiary focus:outline-none"
      />
      <Button
        type="submit"
        variant="accent"
        size="sm"
        disabled={disabled || value.trim().length === 0}
        aria-label={COMPANION_COPY.room.send}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </form>
  );
}
