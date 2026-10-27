/**
 * A picked PDF → what the composer attaches. The reading is
 * @bitbaum/chatkit/pdf (text when the PDF has a text layer, pictures of its
 * pages, four to a sheet, when it does not); this decides what the Cat gets
 * and what the person is told. pdf.js's runtime files are copied to
 * /public/pdfjs by `pnpm run pdf-assets`, which dev and build run first.
 */

import type { AttachmentReader, StagedAttachment } from '@bitbaum/chatkit';
import {
  PDF_MAX_BYTES,
  isPdfFile,
  readPdf,
  sheetName,
  type PdfReading,
} from '@bitbaum/chatkit/pdf';
import { CHAT_IMAGE_MAX_COUNT } from '@/services/cat/chat-images';
import type { ChatAttachment } from './attachments';

export interface PdfAttachResult {
  added: ChatAttachment[];
  /** Said plainly when not every page reached the Cat. */
  notice: string | null;
  error: string | null;
}

/** Where `pnpm run pdf-assets` puts pdf.js's worker and decoders. */
export const PDF_ASSETS_URL = '/pdfjs/';

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** What was attached, in the words the person reads under the composer. */
export function pdfNotice(fileName: string, reading: PdfReading): string | null {
  if (reading.kind === 'text') {
    return null;
  }
  if (reading.pagesShown < reading.pageCount) {
    return `Cat sees pages 1–${reading.pagesShown} of ${reading.pageCount} of "${fileName}". Send the rest in a second message.`;
  }
  return null;
}

export async function attachPdf(
  file: File,
  freeImageSlots: number,
  newId: () => string
): Promise<PdfAttachResult> {
  if (file.size > PDF_MAX_BYTES) {
    return {
      added: [],
      notice: null,
      error: `"${file.name}" is too large — Cat reads PDFs up to ${mb(PDF_MAX_BYTES)} MB.`,
    };
  }
  let reading: PdfReading;
  try {
    reading = await readPdf(file, { maxSheets: freeImageSlots, assetsUrl: PDF_ASSETS_URL });
  } catch {
    return {
      added: [],
      notice: null,
      error: `Couldn't open "${file.name}". If it has a password, remove it and try again.`,
    };
  }

  if (reading.kind === 'text') {
    return {
      added: [{ kind: 'file', id: newId(), name: file.name, content: reading.text }],
      notice: null,
      error: null,
    };
  }
  if (reading.sheets.length === 0) {
    return {
      added: [],
      notice: null,
      error:
        freeImageSlots <= 0
          ? `This message already has its pictures. Send it, then attach "${file.name}".`
          : `Couldn't read the pages of "${file.name}".`,
    };
  }
  return {
    added: reading.sheets.map(s => ({
      kind: 'image' as const,
      id: newId(),
      name: sheetName(file.name, s.firstPage, s.lastPage),
      dataUrl: s.dataUrl,
    })),
    notice: pdfNotice(file.name, reading),
    error: null,
  };
}

/**
 * The Cat's reader for chatkit's attach button (`composer.attach.readFile`):
 * a PDF is read here, anything else is left to chatkit. Photos and the text
 * of a PDF stage as chatkit attachments; the transport turns them back into
 * the Cat's own (useCatTransport). The limits are the same as before ChatApp:
 * pictures per message are CHAT_IMAGE_MAX_COUNT, shared with the photos
 * already staged, and what could not go is said under the box.
 */
export const readCatFile: AttachmentReader = async (file, ctx) => {
  if (!isPdfFile(file)) {
    return undefined;
  }
  ctx.progress(`Reading "${file.name}"…`);
  let n = 0;
  const pdf = await attachPdf(
    file,
    Math.min(CHAT_IMAGE_MAX_COUNT - ctx.images, ctx.room),
    () => `pdf-${++n}`
  );
  const attachments: StagedAttachment[] = [];
  for (const a of pdf.added) {
    if (a.kind === 'image') {
      attachments.push({
        kind: 'image',
        name: a.name,
        mimeType: /^data:([^;,]+)/.exec(a.dataUrl)?.[1] ?? 'image/jpeg',
        dataBase64: a.dataUrl.slice(a.dataUrl.indexOf(',') + 1),
        previewUrl: a.dataUrl,
      });
    } else if (a.kind === 'file') {
      attachments.push({ kind: 'text', name: a.name, content: a.content });
    }
  }
  const note = pdf.error ?? pdf.notice;
  return { attachments, ...(note ? { note } : {}) };
};
