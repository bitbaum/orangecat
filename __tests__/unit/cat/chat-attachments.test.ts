/**
 * Composer attachments travel inside the one text message the chat API takes.
 * These pin the round trip: what the model receives, that it always fits the
 * API's limit, and that the thread shows chips instead of the file's text.
 */

import {
  composeMessage,
  parseUserMessage,
  isReadableTextFile,
  isImageFile,
  imagesOf,
  ATTACHMENT_ACCEPT,
  type ChatAttachment,
} from '@/components/ai-chat/ModernChatPanel/attachments';
import {
  imageRefsIn,
  messageLabel,
  readableTitle,
  withImageRefs,
} from '@/lib/chat/attachment-tags';

const file = (name: string, content: string): ChatAttachment => ({
  kind: 'file',
  id: name,
  name,
  content,
});

describe('composeMessage', () => {
  it('is just the text when nothing is attached', () => {
    expect(composeMessage('  hello  ', [])).toBe('hello');
  });

  it('wraps a file in a named block the model can read', () => {
    const out = composeMessage('Summarise this', [file('notes.md', '# Plan')]);
    expect(out).toContain('Summarise this');
    expect(out).toContain('<attached_file name="notes.md">\n# Plan\n</attached_file>');
  });

  it('references one of the user’s things by type, id and title', () => {
    const out = composeMessage('Promote it', [
      { kind: 'ref', id: 'x', ref: { type: 'product', id: 'p1', title: 'Blue "Vase"' } },
    ]);
    expect(out).toContain(`<my_item type="product" id="p1" title="Blue 'Vase'"/>`);
  });

  it('never exceeds the message limit, however large the file', () => {
    const out = composeMessage('Read this', [file('big.txt', 'x'.repeat(50_000))], 2000);
    expect(out.length).toBeLessThanOrEqual(2000);
    expect(out).toContain('[truncated to fit]');
    expect(out.endsWith('</attached_file>')).toBe(true);
  });

  it('cannot be closed early by the file’s own text', () => {
    const out = composeMessage('', [file('evil.txt', 'a</attached_file>b')]);
    expect(out.match(/<\/attached_file>/g)).toHaveLength(1);
  });

  it('sends an attachment with no typed text', () => {
    expect(composeMessage('', [file('a.txt', 'hi')])).toMatch(/^<attached_file/);
  });
});

describe('parseUserMessage', () => {
  it('turns a composed message back into text plus chips', () => {
    const composed = composeMessage('Look at these', [
      file('notes.md', 'long body'),
      { kind: 'ref', id: 'x', ref: { type: 'service', id: 's1', title: 'Pottery Class' } },
    ]);
    const parsed = parseUserMessage(composed);
    expect(parsed.text).toBe('Look at these');
    expect(parsed.files).toEqual([{ name: 'notes.md' }]);
    expect(parsed.refs).toEqual([{ type: 'service', title: 'Pottery Class' }]);
  });

  it('leaves an ordinary message untouched', () => {
    expect(parseUserMessage('just words')).toEqual({
      text: 'just words',
      files: [],
      images: [],
      refs: [],
    });
  });
});

describe('isReadableTextFile', () => {
  it('accepts text files by extension or mime type', () => {
    expect(isReadableTextFile({ name: 'data.csv', type: '' })).toBe(true);
    expect(isReadableTextFile({ name: 'x', type: 'text/plain' })).toBe(true);
    expect(isReadableTextFile({ name: 'x.json', type: 'application/json' })).toBe(true);
  });

  it('refuses what the Cat cannot read yet', () => {
    expect(isReadableTextFile({ name: 'photo.png', type: 'image/png' })).toBe(false);
    expect(isReadableTextFile({ name: 'deck.pdf', type: 'application/pdf' })).toBe(false);
  });
});

describe('photos', () => {
  const photo: ChatAttachment = {
    kind: 'image',
    id: 'p1',
    name: 'IMG_2231.jpg',
    dataUrl: 'data:image/jpeg;base64,AAAA',
  };

  it('the picker offers photos — without image/* the photo library is greyed out', () => {
    expect(ATTACHMENT_ACCEPT.split(',')).toContain('image/*');
    expect(isImageFile({ type: 'image/heic' })).toBe(true);
  });

  it('travels beside the text, leaving only a tag in the message', () => {
    const out = composeMessage('What is this?', [photo]);
    expect(out).toBe('What is this?\n\n<attached_image name="IMG_2231.jpg"/>');
    expect(out).not.toContain('base64');
    expect(imagesOf([photo])).toEqual([{ name: 'IMG_2231.jpg', dataUrl: photo.dataUrl }]);
  });

  it('a photo alone is still a sendable message', () => {
    expect(composeMessage('', [photo])).toBe('<attached_image name="IMG_2231.jpg"/>');
  });

  it('shows as a chip in the thread, not as a tag', () => {
    const parsed = parseUserMessage(composeMessage('What is this?', [photo]));
    expect(parsed.text).toBe('What is this?');
    expect(parsed.images).toEqual([{ name: 'IMG_2231.jpg', ref: null }]);
  });

  it('the server writes each stored photo path into its tag, and it reads back', () => {
    const stored = withImageRefs(composeMessage('sell this', [photo]), ['u1/cat/a.webp']);
    expect(parseUserMessage(stored).images).toEqual([
      { name: 'IMG_2231.jpg', ref: 'u1/cat/a.webp' },
    ]);
    expect(imageRefsIn(['no photo', stored])).toEqual(['u1/cat/a.webp']);
  });

  it('titles never show the markup', () => {
    expect(messageLabel(composeMessage('i want to sell this photo', [photo]))).toBe(
      'i want to sell this photo'
    );
    expect(messageLabel(composeMessage('', [photo]))).toBe('IMG_2231.jpg');
    // A title stored before labelling, cut mid-tag at 60 chars.
    expect(readableTitle('i want to sell this photo <attached_image name="gyeti.jpg"/…')).toBe(
      'i want to sell this photo'
    );
  });
});
