/**
 * What goes with a message in the companions home: the Cat's attachment
 * pipeline, reused whole. chatkit stages a photo, a text file or a PDF
 * (`COMPANION_ATTACH` is the Cat's limits and PDF reader); the text travels
 * inside the message as tagged blocks and the photos beside it, the way the
 * Cat chat sends them; a stored line comes back as the same chips.
 */

import type { Attachment, AttachOptions } from '@bitbaum/chatkit';
import type { ChatMessageData } from '@bitbaum/chatkit/react';
import {
  CAT_ATTACH_LIMITS,
  composeMessage,
  fromComposer,
  imagesOf,
} from '@/components/ai-chat/ModernChatPanel/attachments';
import { readCatFile } from '@/components/ai-chat/ModernChatPanel/pdfAttachments';
import { COMPANION_COPY } from '@/config/companions';
import { catUserTurn } from '@/lib/chat/cat-messages';
import { isImageMime } from '@bitbaum/chatkit';
import type { ChatImage } from '@/services/cat/chat-images';

export const COMPANION_ATTACH: AttachOptions = { ...CAT_ATTACH_LIMITS, readFile: readCatFile };

/**
 * A fleet bot's contract takes text as `context` and no pixels: a photo is
 * turned away with the reason, a text file or a PDF goes through.
 */
export function fleetAttach(name: string): AttachOptions {
  return {
    ...CAT_ATTACH_LIMITS,
    readFile: (file, ctx) =>
      isImageMime(file.type)
        ? { attachments: [], note: COMPANION_COPY.talk.attach.noPhotos(name) }
        : readCatFile(file, ctx),
  };
}

/** The message as the API takes it: text with the file blocks, photos beside. */
export function outgoing(
  text: string,
  attachments: readonly Attachment[]
): { content: string; images: ChatImage[] | undefined } {
  const list = fromComposer(attachments);
  const images = imagesOf(list);
  return { content: composeMessage(text, list), images: images.length ? images : undefined };
}

/** A stored user line as the thread shows it: the words, with chips for what went with them. */
export function shownUserTurn(
  content: string
): Pick<ChatMessageData, 'content' | 'attachments' | 'chips'> {
  return catUserTurn(content);
}

/** Any stored line as the thread shows it; a bot's words are shown as they are. */
export function shownTurn(
  role: 'user' | 'assistant',
  content: string
): Pick<ChatMessageData, 'content' | 'attachments' | 'chips'> {
  return role === 'user' ? catUserTurn(content) : { content };
}
