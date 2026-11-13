// The real icons: the suite-wide lucide mock draws nothing.
vi.unmock('lucide-react');

import { Package } from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ENTITY_CARD_TYPES } from '@/lib/og/entity-card-data';
import { firstImage, iconNodeOf, loadCardImage, makerName } from '@/lib/og/card-parts';
import { firstWords } from '@/lib/og/post-card-data';

describe('makerName', () => {
  it('prints a chosen name, else a chosen handle', () => {
    expect(makerName({ name: 'Cato', username: 'cato' })).toBe('Cato');
    expect(makerName({ name: '  ', username: 'cato' })).toBe('@cato');
  });

  it('never prints a handle the platform minted', () => {
    expect(makerName({ name: null, username: 'user_df091395b2ca' })).toBeNull();
    expect(makerName({ name: 'user_df091395b2ca', username: 'user_df091395b2ca' })).toBeNull();
    expect(makerName(null)).toBeNull();
  });
});

describe('iconNodeOf', () => {
  it('reads the shapes of a lucide icon without rendering it', () => {
    const node = iconNodeOf(Package);
    expect(node?.length).toBeGreaterThan(0);
    expect(node?.[0]?.[0]).toBe('path');
  });

  it('draws every kind that has a card', () => {
    for (const type of ENTITY_CARD_TYPES) {
      expect(iconNodeOf(ENTITY_REGISTRY[type].icon), type).not.toBeNull();
    }
  });

  it('is null for something that is not an icon', () => {
    expect(iconNodeOf(null)).toBeNull();
  });
});

describe('loadCardImage', () => {
  const respond = (type: string, status = 200) =>
    vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), { status, headers: { 'content-type': type } })
    );

  it('turns a drawable image into a data URI', async () => {
    expect(await loadCardImage('https://x.test/a.jpg', respond('image/jpeg'))).toBe(
      'data:image/jpeg;base64,AQID'
    );
  });

  it('refuses what the renderer cannot draw or cannot reach', async () => {
    expect(await loadCardImage('https://x.test/a.webp', respond('image/webp'))).toBeNull();
    expect(await loadCardImage('https://x.test/a.png', respond('image/png', 404))).toBeNull();
    expect(await loadCardImage('http://x.test/a.png', respond('image/png'))).toBeNull();
    expect(await loadCardImage(null, respond('image/png'))).toBeNull();
    const failing = vi.fn(async () => {
      throw new Error('timeout');
    });
    expect(await loadCardImage('https://x.test/a.png', failing)).toBeNull();
  });
});

describe('firstImage', () => {
  it('takes the first https URL among arrays and strings', () => {
    expect(firstImage([], null, ['', 'https://a.test/1.png'], 'https://b.test/2.png')).toBe(
      'https://a.test/1.png'
    );
    expect(firstImage('/relative.png', undefined)).toBeNull();
  });
});

describe('firstWords', () => {
  it('is the first line, cut on a word', () => {
    expect(firstWords('Hello there\nsecond')).toBe('Hello there');
    const cut = firstWords('word '.repeat(60));
    expect(cut.length).toBeLessThanOrEqual(110);
    expect(cut.endsWith('word…')).toBe(true);
  });
});
