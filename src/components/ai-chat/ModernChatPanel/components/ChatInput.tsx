/**
 * CHAT INPUT — the one composer the whole app uses.
 *
 * One integrated control, laid out the way ChatGPT/Claude/Grok taught people to
 * read it: the text on top, attachments under it, and a single control row —
 * "+" and the model on the left, dictation and send on the right.
 *
 * `placement` decides where it lives, not how it looks: `bottom` pins it under
 * the thread; `inline` drops the pinning chrome so the Cat's empty state can
 * centre it in its column (it moves to the bottom on the first send).
 *
 * Every Cat-specific control is an optional prop, which is what lets TalkRoom
 * and the Cat share this file: no `onAttachmentsChange`, no "+" menu.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Package, Send, Square, Trash2, X } from 'lucide-react';
import { CAT_HUB_COPY } from '@/config/cat-hub';
import { CHAT_CONTENT_MAX_WIDTH_CLASS } from '@/config/layout-chrome';
import { DictationButton } from '@/components/ui/DictationButton';
import type { CatReference } from '@/config/cat-prompts';
import { ModelSelector } from './ModelSelector';
import { ComposerAddMenu, referenceLabel } from './ComposerAddMenu';
import {
  ATTACHMENT_UNSUPPORTED_COPY,
  MAX_ATTACHMENT_BYTES,
  isImageFile,
  isReadableTextFile,
  type ChatAttachment,
} from '../attachments';
import { shrinkToFit } from '@/services/images/upload';
import { CHAT_IMAGE_MAX_COUNT, CHAT_IMAGE_MAX_EDGE_PX } from '@/services/cat/chat-images';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  onStop?: () => void;
  variant?: 'default' | 'focus';
  /** `inline` = inside the empty state's column; `bottom` = pinned under the thread. */
  placement?: 'bottom' | 'inline';
  hasMessages?: boolean;
  onClearChat?: () => void;
  /** Model picker — surfaced at the composer in the focus variant. */
  selectedModel?: string;
  onModelSelect?: (model: string) => void;
  /** Attachments for the next message. Omit `onAttachmentsChange` to hide "+". */
  attachments?: ChatAttachment[];
  onAttachmentsChange?: (next: ChatAttachment[]) => void;
  /** The user's own things the "+" menu can reference. */
  attachable?: CatReference[];
  /** Prompt text. Defaults to Cat's. */
  placeholder?: string;
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** A phone photo is 3–12 MB; a model reads a 1568px re-encode just as well. */
const PHOTO_MAX_BYTES = 1.5 * 1024 * 1024;

/** Downscale in the browser and hand back a data URL, or null if unreadable. */
async function readPhoto(file: File): Promise<string | null> {
  const blob = await shrinkToFit(file, {
    maxDimension: CHAT_IMAGE_MAX_EDGE_PX,
    maxBytes: PHOTO_MAX_BYTES,
  });
  if (!blob) {
    return null;
  }
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

export function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  onStop,
  variant = 'focus',
  placement = 'bottom',
  hasMessages,
  onClearChat,
  selectedModel,
  onModelSelect,
  attachments = [],
  onAttachmentsChange,
  attachable = [],
  placeholder = CAT_HUB_COPY.composerPlaceholder,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const isFocus = variant === 'focus';
  const isInline = placement === 'inline';
  const showModelSelector = isFocus && !!onModelSelect && !!selectedModel;

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

  // The centred composer IS the page's call to action — put the cursor in it.
  useEffect(() => {
    if (isInline) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [isInline]);

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

  const handleFiles = async (files: FileList) => {
    if (!onAttachmentsChange) {
      return;
    }
    setAttachError(null);
    const added: ChatAttachment[] = [];
    let photos = attachments.filter(a => a.kind === 'image').length;
    for (const file of Array.from(files)) {
      if (isImageFile(file)) {
        if (photos >= CHAT_IMAGE_MAX_COUNT) {
          setAttachError(`Up to ${CHAT_IMAGE_MAX_COUNT} photos per message.`);
          continue;
        }
        const dataUrl = await readPhoto(file);
        if (!dataUrl) {
          setAttachError(`Couldn't read "${file.name}" as a photo — try a JPEG or PNG.`);
          continue;
        }
        added.push({ kind: 'image', id: newId(), name: file.name, dataUrl });
        photos += 1;
        continue;
      }
      if (!isReadableTextFile(file)) {
        setAttachError(ATTACHMENT_UNSUPPORTED_COPY);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError(`"${file.name}" is too large — Cat reads files up to 512 KB.`);
        continue;
      }
      try {
        added.push({ kind: 'file', id: newId(), name: file.name, content: await file.text() });
      } catch {
        setAttachError(`Couldn't read "${file.name}".`);
      }
    }
    if (added.length > 0) {
      onAttachmentsChange([...attachments, ...added]);
      inputRef.current?.focus();
    }
  };

  const handleReference = (ref: CatReference) => {
    if (!onAttachmentsChange) {
      return;
    }
    const already = attachments.some(
      a => a.kind === 'ref' && a.ref.id === ref.id && a.ref.type === ref.type
    );
    if (!already) {
      onAttachmentsChange([...attachments, { kind: 'ref', id: newId(), ref }]);
    }
    inputRef.current?.focus();
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange?.(attachments.filter(a => a.id !== id));
  };

  const canSend = (!!value.trim() || attachments.length > 0) && !isLoading;

  return (
    <div
      className={cn(
        isInline ? 'w-full' : isFocus ? 'oc-chat-composer-wrap' : 'border-t border-subtle p-4'
      )}
    >
      <div className={cn('mx-auto w-full', !isInline && CHAT_CONTENT_MAX_WIDTH_CLASS)}>
        <div className={cn('oc-chat-composer', !isFocus && 'rounded-md')}>
          <textarea
            ref={inputRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={isInline ? 2 : 1}
            className="oc-chat-composer-input"
            aria-label={placeholder}
          />

          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 px-1 pb-1" aria-label="Attached">
              {attachments.map(a => (
                <li key={a.id} className="oc-chat-attachment">
                  {a.kind === 'image' ? (
                    // A data URL has nothing for next/image to optimise.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.dataUrl}
                      alt=""
                      className="h-6 w-6 flex-shrink-0 rounded object-cover"
                    />
                  ) : a.kind === 'file' ? (
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-fg-secondary" />
                  ) : (
                    <Package className="h-3.5 w-3.5 flex-shrink-0 text-fg-secondary" />
                  )}
                  <span className="min-w-0 truncate">
                    {a.kind === 'ref' ? a.ref.title : a.name}
                  </span>
                  {a.kind === 'ref' && (
                    <span className="flex-shrink-0 text-fg-tertiary">
                      {referenceLabel(a.ref.type)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.id)}
                    className="-mr-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
                    aria-label={`Remove ${a.kind === 'ref' ? a.ref.title : a.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="oc-chat-composer-controls">
            <div className="flex min-w-0 items-center gap-0.5">
              {onAttachmentsChange && (
                <ComposerAddMenu
                  attachable={attachable}
                  onFiles={files => void handleFiles(files)}
                  onReference={handleReference}
                  disabled={isLoading}
                />
              )}
              {showModelSelector && (
                <ModelSelector
                  selectedModel={selectedModel}
                  onSelect={onModelSelect}
                  disabled={isLoading}
                  openUp={!isInline}
                  subtle
                />
              )}
            </div>

            <div className="flex flex-shrink-0 items-center gap-0.5">
              {isFocus && !!onClearChat && hasMessages && (
                <button
                  type="button"
                  onClick={onClearChat}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
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
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-fg-primary text-fg-inverted transition-opacity hover:opacity-90"
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
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                    canSend
                      ? 'bg-fg-primary text-fg-inverted hover:opacity-90'
                      : 'cursor-not-allowed bg-surface-raised text-fg-tertiary'
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

        {attachError && (
          <p className="mt-2 px-1 text-xs text-status-negative" role="alert">
            {attachError}
          </p>
        )}
      </div>
    </div>
  );
}
