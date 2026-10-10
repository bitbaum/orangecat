import { describe, expect, it } from 'vitest';
import {
  composeShareText,
  parseShareIntent,
  shareIntentUrl,
  SHARE_INTENT_PATH,
} from '@/config/share';

const params = (q: Record<string, string>) => new URLSearchParams(q);

describe('share intent', () => {
  it('builds the link a button carries, and reads it back', () => {
    const href = shareIntentUrl('https://orangecat.ch/', {
      url: 'https://loki.orangecat.ch/thoughts/the-fleet-in-your-ear',
      title: 'The Fleet in Your Ear',
    });
    expect(href.startsWith(`https://orangecat.ch${SHARE_INTENT_PATH}?`)).toBe(true);
    const back = parseShareIntent(new URL(href).searchParams);
    expect(back).toEqual({
      url: 'https://loki.orangecat.ch/thoughts/the-fleet-in-your-ear',
      title: 'The Fleet in Your Ear',
    });
  });

  it('shares only web pages', () => {
    expect(parseShareIntent(params({}))).toBeNull();
    expect(parseShareIntent(params({ url: 'javascript:alert(1)' }))).toBeNull();
    expect(parseShareIntent(params({ url: 'not a url' }))).toBeNull();
    expect(parseShareIntent(params({ url: 'http://example.org/a' }))?.url).toBe(
      'http://example.org/a'
    );
  });

  it('composes the post: the reader’s line or the title, then the link on its own line', () => {
    expect(composeShareText({ url: 'https://x.y/z', title: 'Z' })).toBe('Z\n\nhttps://x.y/z');
    expect(composeShareText({ url: 'https://x.y/z', title: 'Z', text: 'Read this' })).toBe(
      'Read this\n\nhttps://x.y/z'
    );
    expect(composeShareText({ url: 'https://x.y/z' })).toBe('https://x.y/z');
  });

  it('trims and bounds what it carries', () => {
    const long = 'a'.repeat(400);
    const intent = parseShareIntent(params({ url: 'https://x.y/', title: `  ${long}  ` }));
    expect(intent?.title?.length).toBe(200);
    expect(parseShareIntent(params({ url: 'https://x.y/', title: '   ' }))).toEqual({
      url: 'https://x.y/',
    });
  });
});
