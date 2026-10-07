/**
 * One rule for every image a person uploads.
 *
 * Three services each wrote their own. The avatar — the most uploaded image —
 * had the strictest: a hard 5MB refusal and no resize, so an ordinary phone
 * photo failed as an avatar and worked as an article cover. The profile picker
 * accepted `image/*`, so an iPhone HEIC passed the picker and then failed with
 * a raw MIME list. Extensions came from the file NAME, so a re-encoded photo
 * was stored under the wrong one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareImageForUpload } from '@/services/images/upload';

const MB = 1024 * 1024;

function fakeFile(type: string, sizeBytes: number, name = 'photo'): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: sizeBytes });
  return f;
}

/** A canvas that re-encodes anything into a tiny blob of the requested type. */
function stubCanvas() {
  vi.stubGlobal('createImageBitmap', async () => ({ width: 4000, height: 3000, close() {} }));
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }),
      toBlob: (cb: (b: Blob) => void, type: string) => cb(new Blob(['y'], { type })),
    }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('prepareImageForUpload', () => {
  it('shrinks an oversized photo instead of refusing it, and names it by what it now is', async () => {
    stubCanvas();
    const r = await prepareImageForUpload(fakeFile('image/jpeg', 12 * MB, 'IMG_0001.JPG'), {
      maxBytes: 5 * MB,
    });
    expect(r).toMatchObject({ ok: true, contentType: 'image/webp', ext: 'webp' });
  });

  it('takes the extension from the content type, never the file name', async () => {
    const r = await prepareImageForUpload(fakeFile('image/png', 1024, 'screenshot.HEIC'));
    expect(r).toMatchObject({ ok: true, contentType: 'image/png', ext: 'png' });
  });

  it('passes a photo under the limit through untouched', async () => {
    const file = fakeFile('image/jpeg', 1024);
    const r = await prepareImageForUpload(file);
    expect(r.ok && r.payload).toBe(file);
  });

  it('refuses a HEIC in words a person can act on, not a MIME list', async () => {
    const r = await prepareImageForUpload(fakeFile('image/heic', 1024));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/JPEG, PNG, WebP, or GIF/);
    expect(!r.ok && r.error).not.toMatch(/image\//);
  });

  it('refuses an oversized GIF against the limit it was given', async () => {
    const r = await prepareImageForUpload(fakeFile('image/gif', 12 * MB), { maxBytes: 10 * MB });
    expect(!r.ok && r.error).toMatch(/over 10MB/);
  });
});

describe('every upload and picker goes through the one rule', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        return sources(p);
      }
      return /\.tsx?$/.test(name) ? [p] : [];
    });
  }
  const files = sources('src');

  it('walks a real tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('every service that uploads to storage prepares the image first', () => {
    const uploaders = files.filter(f => /\.upload\(fileName,/.test(readFileSync(f, 'utf8')));
    expect(uploaders.length).toBeGreaterThanOrEqual(3);
    const unprepared = uploaders.filter(
      f => !/prepareImageForUpload\(/.test(readFileSync(f, 'utf8'))
    );
    expect(unprepared).toEqual([]);
  });

  it('no image picker writes its own accept list', () => {
    const own = files.filter(f => /accept=["']image\//.test(readFileSync(f, 'utf8')));
    expect(own).toEqual([]);
  });
});
