/**
 * The share card through the real renderer (satori + resvg): it must come out
 * as a 1200×630 PNG with the cache header, with an icon face and with a
 * picture face — a renderer error mid-stream is a broken image in a chat.
 */

import { Package } from 'lucide-react';

// The real icons: the suite-wide lucide mock draws nothing.
vi.unmock('lucide-react');
import { iconNodeOf } from '@/lib/og/card-parts';
import { shareCardResponse } from '@/lib/og/share-card';

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

// A 1×1 transparent PNG.
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('shareCardResponse, rendered', () => {
  // The renderer loads its wasm with fetch when there is one; the suite-wide
  // fetch is a mock, so let it read the file from disk instead.
  beforeEach(() => {
    vi.stubGlobal('fetch', undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['an icon face', { image: null, icon: iconNodeOf(Package) }],
    ['a picture face', { image: PIXEL, icon: null }],
  ])(
    'draws %s as a 1200×630 PNG',
    async (_label, face) => {
      const response = shareCardResponse({
        kicker: 'Product',
        title: 'Old Road Bike, steel frame, 56 cm',
        maker: 'Cato',
        figure: 'CHF 240.00',
        line: 'A steel road bike from 1984, serviced this spring.',
        ...face,
      });
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=3600');
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
      expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 });
    },
    30000
  );
});
