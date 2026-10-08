'use client';

/**
 * CHAT INPUT — the one composer the whole app uses, on the fleet's composer.
 *
 * The box itself is `@bitbaum/chatkit`'s `Composer`: auto-growing input, Enter
 * sends and Shift+Enter breaks the line, Stop in the send slot while a turn
 * runs, 16px text so a phone never zooms, and a microphone that never goes
 * dead. Those were written here once and fixed in chatkit separately; every
 * fix to them now lands in one place for every product.
 *
 * What stays here is OrangeCat's own, in chatkit's slots: the "+" menu that
 * attaches the person's own things (a project, an offer) or a file, the
 * attachment previews, the model picker, and Clear. OrangeCat keeps its
 * attachments itself — chatkit has no model for "a reference to my project" —
 * and tells the composer how many it holds (`heldAttachments`), so a message
 * that is only a photo or a reference can still be sent.
 *
 * `placement` decides where it lives, not how it looks: `bottom` pins it under
 * the thread; `inline` drops the pinning chrome so the Cat's empty state can
 * centre it in its column (it moves to the bottom on the first send).
 *
 * Every Cat-specific control is an optional prop, which is what lets TalkRoom
 * and the Cat share this file: no `onAttachmentsChange`, no "+" menu.
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Composer } from '@bitbaum/chatkit/react';
import '@bitbaum/chatkit/styles.css';
import { cn } from '@/lib/utils';
import { CAT_HUB_COPY } from '@/config/cat-hub';
import { CHAT_CONTENT_MAX_WIDTH_CLASS } from '@/config/layout-chrome';
import { API_ROUTES } from '@/config/api-routes';
import { transcribeWithRoute } from '@/hooks/useDictation';
import type { CatReference } from '@/config/cat-prompts';
import { ModelSelector } from './ModelSelector';
import { ComposerAddMenu } from './ComposerAddMenu';
import { ComposerAttachments, readPhoto } from './ComposerAttachments';
import {
  ATTACHMENT_UNSUPPORTED_COPY,
  MAX_ATTACHMENT_BYTES,
  isImageFile,
  isReadableTextFile,
  type ChatAttachment,
} from '../attachments';
import { CHAT_IMAGE_MAX_COUNT } from '@/services/cat/chat-images';

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

/** One transcription route for every microphone in the app; see useDictation. */
const transcribe = transcribeWithRoute(API_ROUTES.CAT.TRANSCRIBE);

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
  const [attachError, setAttachError] = useState<string | null>(null);
  const isFocus = variant === 'focus';
  const isInline = placement === 'inline';
  const showModelSelector = isFocus && !!onModelSelect && !!selectedModel;

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
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange?.(attachments.filter(a => a.id !== id));
  };

  return (
    <div
      className={cn(
        isInline ? 'w-full' : isFocus ? 'oc-chat-composer-wrap' : 'border-t border-subtle p-4'
      )}
    >
      <div className={cn('mx-auto w-full', !isInline && CHAT_CONTENT_MAX_WIDTH_CLASS)}>
        <Composer
          value={value}
          onValueChange={onChange}
          // The page owns the draft and the attachments; it reads both when told.
          onSend={() => onSend()}
          placeholder={placeholder}
          ariaLabel={placeholder}
          sending={isLoading}
          onStop={onStop}
          autoFocus={isInline}
          // OrangeCat's own attachments, shown in `header`. Counted so a message
          // that is only a photo or a reference can still be sent.
          heldAttachments={attachments.length}
          attachmentOnlyText="(attached)"
          voice={{ prefer: 'server', transcribe }}
          header={
            attachments.length > 0 ? (
              <ComposerAttachments attachments={attachments} onRemove={removeAttachment} />
            ) : undefined
          }
          tools={
            <>
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
            </>
          }
          trailing={
            isFocus && !!onClearChat && hasMessages ? (
              <button
                type="button"
                onClick={onClearChat}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                aria-label="Clear chat"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : undefined
          }
          labels={{ send: 'Send message', stop: 'Stop generating', voice: 'Dictate your message' }}
        />

        {attachError && (
          <p className="mt-2 px-1 text-xs text-status-negative" role="alert">
            {attachError}
          </p>
        )}
      </div>
    </div>
  );
}
