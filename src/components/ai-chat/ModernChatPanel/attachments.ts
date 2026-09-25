/**
 * COMPOSER ATTACHMENTS — what the "+" menu adds to a message, and how it
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
 * PDFs are still refused: no model on the free chain reads one without an
 * extraction step this app does not have yet.
 */

import { AI_MESSAGE_MAX_CHARS } from '@/lib/validation/ai';
import type { CatReference } from '@/config/cat-prompts';
import type { ChatImage } from '@/services/cat/chat-images';
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

export function isImageFile(file: { type: string }): boolean {
  return file.type.startsWith('image/');
}

/** Extensions the Cat can read as text. `accept` for the file input. */
export const TEXT_FILE_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.sql',
  '.sh',
  '.log',
  '.ini',
  '.toml',
  '.env.example',
] as const;

/** `image/*` first: without it a phone's photo library is greyed out in the picker. */
export const ATTACHMENT_ACCEPT = ['image/*', ...TEXT_FILE_EXTENSIONS].join(',');

/** Refuse before reading: a file this large cannot fit the message anyway. */
export const MAX_ATTACHMENT_BYTES = 512 * 1024;

export const ATTACHMENT_UNSUPPORTED_COPY =
  'Cat can read photos and text files (.txt, .md, .csv, .json, code). PDFs are not supported yet — paste the text instead.';

export function isReadableTextFile(file: { name: string; type: string }): boolean {
  const name = file.name.toLowerCase();
  if (TEXT_FILE_EXTENSIONS.some(ext => name.endsWith(ext))) {
    return true;
  }
  return file.type.startsWith('text/') || file.type === 'application/json';
}

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

export { parseUserMessage, type ParsedUserMessage } from '@/lib/chat/attachment-tags';
