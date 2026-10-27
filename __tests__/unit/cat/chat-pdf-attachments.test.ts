/**
 * A PDF picked in the Cat chat must reach the Cat — as text when it has text,
 * as pictures of its pages when it does not — and the person must be told
 * when only part of it went. Found 2026-10-27: a 17-slide investor deck was
 * refused outright ("PDFs are not supported yet").
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const readPdf = vi.fn();
vi.mock('@bitbaum/chatkit/pdf', () => ({
  PDF_MAX_BYTES: 40 * 1024 * 1024,
  isPdfFile: (f: { name: string; type: string }) =>
    f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  readPdf: (...args: unknown[]) => readPdf(...args),
  sheetName: (name: string, a: number, b: number) =>
    a === b ? `${name} · page ${a}` : `${name} · pages ${a}–${b}`,
}));

import {
  attachPdf,
  readCatFile,
  pdfNotice,
  PDF_ASSETS_URL,
} from '@/components/ai-chat/ModernChatPanel/pdfAttachments';

const file = (name: string, size = 1000) => ({ name, size, type: 'application/pdf' }) as File;
let n = 0;
const newId = () => `id${++n}`;

beforeEach(() => {
  readPdf.mockReset();
  n = 0;
});

describe('attachPdf', () => {
  it('attaches a text PDF as a file the Cat reads', async () => {
    readPdf.mockResolvedValue({ kind: 'text', text: '--- page 1 ---\nHello', pageCount: 1 });
    const r = await attachPdf(file('report.pdf'), 5, newId);
    expect(r.error).toBeNull();
    expect(r.added).toEqual([
      { kind: 'file', id: 'id1', name: 'report.pdf', content: '--- page 1 ---\nHello' },
    ]);
    expect(readPdf).toHaveBeenCalledWith(expect.anything(), {
      maxSheets: 5,
      assetsUrl: PDF_ASSETS_URL,
    });
  });

  it('attaches a slide deck as pictures of its pages, named by page', async () => {
    readPdf.mockResolvedValue({
      kind: 'pages',
      pageCount: 5,
      pagesShown: 5,
      sheets: [
        { firstPage: 1, lastPage: 4, dataUrl: 'data:image/jpeg;base64,AAA' },
        { firstPage: 5, lastPage: 5, dataUrl: 'data:image/jpeg;base64,BBB' },
      ],
    });
    const r = await attachPdf(file('deck.pdf'), 5, newId);
    expect(r.added.map(a => (a.kind === 'image' ? a.name : a.kind))).toEqual([
      'deck.pdf · pages 1–4',
      'deck.pdf · page 5',
    ]);
    expect(r.notice).toBeNull();
  });

  it('says which pages went when the message runs out of pictures', () => {
    expect(pdfNotice('deck.pdf', { kind: 'pages', pageCount: 17, pagesShown: 8, sheets: [] })).toBe(
      'Cat sees pages 1–8 of 17 of "deck.pdf". Send the rest in a second message.'
    );
  });

  it('refuses a PDF over the limit without opening it', async () => {
    const r = await attachPdf(file('huge.pdf', 41 * 1024 * 1024), 5, newId);
    expect(r.error).toMatch(/too large/);
    expect(readPdf).not.toHaveBeenCalled();
  });

  it('words a PDF that cannot be opened', async () => {
    readPdf.mockRejectedValue(new Error('PasswordException'));
    const r = await attachPdf(file('locked.pdf'), 5, newId);
    expect(r.added).toEqual([]);
    expect(r.error).toMatch(/password/);
  });

  it('asks to send first when no picture slot is left', async () => {
    readPdf.mockResolvedValue({ kind: 'pages', pageCount: 3, pagesShown: 0, sheets: [] });
    const r = await attachPdf(file('deck.pdf'), 0, newId);
    expect(r.error).toMatch(/already has its pictures/);
  });
});

describe("readCatFile — the Cat's reader behind chatkit's attach button", () => {
  const ctx = (images = 0, room = 5) => ({
    images,
    room,
    progress: vi.fn(),
    limits: {} as never,
    notes: {} as never,
  });

  it('leaves everything that is not a PDF to chatkit', async () => {
    const c = ctx();
    expect(await readCatFile({ name: 'a.png', type: 'image/png' } as File, c)).toBeUndefined();
    expect(readPdf).not.toHaveBeenCalled();
    expect(c.progress).not.toHaveBeenCalled();
  });

  it('stages a text PDF as a text attachment, saying it is reading', async () => {
    readPdf.mockResolvedValue({ kind: 'text', text: 'Hello', pageCount: 1 });
    const c = ctx();
    const r = await readCatFile(file('report.pdf'), c);
    expect(c.progress).toHaveBeenCalledWith('Reading "report.pdf"…');
    expect(r).toEqual({ attachments: [{ kind: 'text', name: 'report.pdf', content: 'Hello' }] });
  });

  it('stages sheets as images with a preview, and says when pages were left out', async () => {
    readPdf.mockResolvedValue({
      kind: 'pages',
      pageCount: 17,
      pagesShown: 8,
      sheets: [{ firstPage: 1, lastPage: 4, dataUrl: 'data:image/jpeg;base64,AAA' }],
    });
    const r = await readCatFile(file('deck.pdf'), ctx());
    expect(r?.attachments).toEqual([
      {
        kind: 'image',
        name: 'deck.pdf · pages 1–4',
        mimeType: 'image/jpeg',
        dataBase64: 'AAA',
        previewUrl: 'data:image/jpeg;base64,AAA',
      },
    ]);
    expect(r?.note).toBe(
      'Cat sees pages 1–8 of 17 of "deck.pdf". Send the rest in a second message.'
    );
  });

  it('counts the photos already staged, and the room chatkit has left', async () => {
    readPdf.mockResolvedValue({ kind: 'pages', pageCount: 3, pagesShown: 0, sheets: [] });
    await readCatFile(file('deck.pdf'), ctx(2, 5));
    expect(readPdf).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ maxSheets: 3 })
    );
    await readCatFile(file('deck.pdf'), ctx(0, 1));
    expect(readPdf).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ maxSheets: 1 })
    );
  });

  it('turns a refusal into the note and stages nothing', async () => {
    readPdf.mockRejectedValue(new Error('PasswordException'));
    const r = await readCatFile(file('locked.pdf'), ctx());
    expect(r?.attachments).toEqual([]);
    expect(r?.note).toMatch(/password/);
  });
});
