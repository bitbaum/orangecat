/**
 * COMPOSER ATTACHMENTS — what the "+" menu adds to a message, and how it
 * travels.
 *
 * The chat API takes one text message (catChatBodySchema), so an attachment is
 * serialised INTO that message as a tagged block the model reads naturally and
 * the thread can turn back into a chip:
 *
 *   <attachment name="notes.md">…file text…</attachment>
 *   <ref type="product" id="…" title="Loki Pro — 30-day pass"/>
 *
 * Text files only, for an honest reason: every model on the free chain reads
 * text, few read images, and none reads a PDF without an extraction step this
 * app does not have yet. The picker says so rather than accepting a file the
 * Cat would silently ignore.
 */

import { AI_MESSAGE_MAX_CHARS } from '@/lib/validation/ai';
import type { CatReference } from '@/config/cat-prompts';

export type ChatAttachment =
  | { kind: 'file'; id: string; name: string; content: string }
  | { kind: 'ref'; id: string; ref: CatReference };

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

export const ATTACHMENT_ACCEPT = TEXT_FILE_EXTENSIONS.join(',');

/** Refuse before reading: a file this large cannot fit the message anyway. */
export const MAX_ATTACHMENT_BYTES = 512 * 1024;

export const ATTACHMENT_UNSUPPORTED_COPY =
  'Cat can read text files for now (.txt, .md, .csv, .json, code). Images and PDFs are not supported yet — paste the text instead.';

export function isReadableTextFile(file: { name: string; type: string }): boolean {
  const name = file.name.toLowerCase();
  if (TEXT_FILE_EXTENSIONS.some(ext => name.endsWith(ext))) {
    return true;
  }
  return file.type.startsWith('text/') || file.type === 'application/json';
}

const attr = (v: string): string => v.replace(/"/g, "'").replace(/[<>]/g, '');

/** Prevents file text from closing its own block early. */
const escapeBody = (v: string): string => v.replace(/<\/attachment>/gi, '</ attachment>');

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
    .map(
      a => `<ref type="${attr(a.ref.type)}" id="${attr(a.ref.id)}" title="${attr(a.ref.title)}"/>`
    );
  const files = attachments.filter(
    (a): a is Extract<ChatAttachment, { kind: 'file' }> => a.kind === 'file'
  );

  const head = [text.trim(), ...refs].filter(Boolean).join('\n\n');
  if (files.length === 0) {
    return head;
  }

  const wrappers = files.map(f => ({
    open: `<attachment name="${attr(f.name)}">\n`,
    close: '\n</attachment>',
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

export interface ParsedUserMessage {
  text: string;
  files: Array<{ name: string }>;
  refs: Array<{ type: string; title: string }>;
}

const FILE_BLOCK = /<attachment name="([^"]*)">[\s\S]*?<\/attachment>/g;
const REF_TAG = /<ref type="([^"]*)" id="[^"]*" title="([^"]*)"\/>/g;

/** The inverse, for display: the typed text, plus chips for what was attached. */
export function parseUserMessage(content: string): ParsedUserMessage {
  const files = [...content.matchAll(FILE_BLOCK)].map(m => ({ name: m[1] }));
  const refs = [...content.matchAll(REF_TAG)].map(m => ({ type: m[1], title: m[2] }));
  const text = content.replace(FILE_BLOCK, '').replace(REF_TAG, '').trim();
  return { text, files, refs };
}
