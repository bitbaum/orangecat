/**
 * A picked PDF → what the composer attaches. The reading is
 * @bitbaum/chatkit/pdf (text when the PDF has a text layer, pictures of its
 * pages, four to a sheet, when it does not); this decides what the Cat gets
 * and what the person is told. pdf.js's runtime files are copied to
 * /public/pdfjs by `pnpm run pdf-assets`, which dev and build run first.
 */

import { PDF_MAX_BYTES, readPdf, sheetName, type PdfReading } from '@bitbaum/chatkit/pdf';
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
