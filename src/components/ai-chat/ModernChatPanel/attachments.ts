/**
 * COMPOSER ATTACHMENTS — what goes with a message (chatkit's staged photos
 * and files, and the person's own things from "Your things"), and how it
 * travels.
 *
 * The chat API takes one text message (catChatBodySchema), so an attachment is
 * serialised INTO that message as a tagged block the thread can turn back into
 * a chip. The tag NAMES carry the meaning, deliberately: explaining them in the
 * system prompt cost every turn tokens against Groq's per-request budget, for
 * the few turns that carry an attachment.
 *
 *   <attached_file name="notes.md">…file text…</attached_file>
 *   <my_item type="product" id="…" title="Loki Pro — 30-day pass"/>
 *   <attached_image name="IMG_2231.jpg"/>
 *
 * Photos are the exception to "inside the message": pixels do not fit a 10k
 * text cap, so they travel beside it (`images` on the request, see
 * services/cat/chat-images.ts) and the server routes the turn to a model that
 * can see. The tag stays in the text so the thread shows what was sent.
 *
 * PDFs never travel as PDFs (no model on the free chain reads one). They are
 * read in the browser by @bitbaum/chatkit/pdf: a PDF with text becomes an
 * <attached_file>, one of slide pictures becomes photos of its pages, four to
 * a sheet — see pdfAttachments.ts.
 */

import { AI_MESSAGE_MAX_CHARS } from '@/lib/validation/ai';
import type { CatReference } from '@/config/cat-prompts';
import {
  CHAT_IMAGE_MAX_COUNT,
  CHAT_IMAGE_MAX_EDGE_PX,
  type ChatImage,
} from '@/services/cat/chat-images';
import { fileBlockOpen, imageTag, refTag } from '@/lib/chat/attachment-tags';

export type ChatAttachment =
  | { kind: 'file'; id: string; name: string; content: string }
  | { kind: 'image'; id: string; name: string; dataUrl: string }
  | { kind: 'ref'; id: string; ref: CatReference };

/** The photos to send beside the message. */
export function imagesOf(attachments: ChatAttachment[]): ChatImage[] {
  return attachments
    .filter((a): a is Extract<ChatAttachment, { kind: 'image' }> => a.kind === 'image')
    .map(a => ({ name: a.name, dataUrl: a.dataUrl }));
}

/** Characters of one text file the Cat reads (inlined into the message). */
export const MAX_ATTACHMENT_CHARS = 512 * 1024;

/**
 * What chatkit's attach button may stage for the Cat (ChatApp `composer.attach`):
 * photos up to the chat route's count, shrunk in the browser to the edge a
 * vision model reads; text files up to what the message can carry. chatkit
 * owns the pickers (Camera · Photos · Files, one input each) and refuses a
 * PDF with ATTACHMENT_UNSUPPORTED_COPY before anything is read.
 */
export const CAT_ATTACH_LIMITS = {
  maxFiles: CHAT_IMAGE_MAX_COUNT,
  maxTextChars: MAX_ATTACHMENT_CHARS,
  maxImageBytes: 1.5 * 1024 * 1024,
  maxImageEdge: CHAT_IMAGE_MAX_EDGE_PX,
} as const;

export const ATTACHMENT_UNSUPPORTED_COPY =
  'Cat can read photos, PDFs and text files (.txt, .md, .csv, .json, code). This kind of file it cannot open yet — export it as a PDF or paste the text.';

/** Prevents file text from closing its own block early. */
const escapeBody = (v: string): string => v.replace(/<\/attached_file>/gi, '</ attached_file>');

const TRUNCATED_NOTE = '\n…[truncated to fit]';

/**
 * The message the API receives: the typed text, then each attachment as a
 * block. File contents are cut to fit AI_MESSAGE_MAX_CHARS rather than letting
 * the request fail validation after the user pressed send.
 */
export function composeMessage(
  text: string,
  attachments: ChatAttachment[],
  maxChars: number = AI_MESSAGE_MAX_CHARS
): string {
  const refs = attachments
    .filter((a): a is Extract<ChatAttachment, { kind: 'ref' }> => a.kind === 'ref')
    .map(a => refTag(a.ref));
  const images = imagesOf(attachments).map(i => imageTag(i.name));
  const files = attachments.filter(
    (a): a is Extract<ChatAttachment, { kind: 'file' }> => a.kind === 'file'
  );

  const head = [text.trim(), ...refs, ...images].filter(Boolean).join('\n\n');
  if (files.length === 0) {
    return head;
  }

  const wrappers = files.map(f => ({
    open: fileBlockOpen(f.name),
    close: '\n</attached_file>',
    body: escapeBody(f.content),
  }));
  const overhead =
    head.length +
    wrappers.reduce((n, w) => n + w.open.length + w.close.length + 2, 0) +
    files.length * TRUNCATED_NOTE.length;
  const perFile = Math.max(0, Math.floor((maxChars - overhead) / files.length));

  const blocks = wrappers.map(w => {
    const body = w.body.length > perFile ? `${w.body.slice(0, perFile)}${TRUNCATED_NOTE}` : w.body;
    return `${w.open}${body}${w.close}`;
  });
  return [head, ...blocks].filter(Boolean).join('\n\n');
}
