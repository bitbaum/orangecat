/**
 * A wall post's preview: a public post carries its author and words to X,
 * WhatsApp and search engines; any other post carries nothing — not its text,
 * not its author, not a card — because metadata travels with the link to
 * people the post was never shown to.
 */
import {
  buildPostMetadata,
  isPublicPost,
  NON_PUBLIC_POST_TITLE,
  postPreview,
  postUrl,
} from '@/lib/seo/post-metadata';

const SITE = 'https://orangecat.ch';
const SECRET = 'Meet me at the old mill at nine, bring the keys';

const post = (visibility: string) => ({
  id: '11111111-2222-3333-4444-555555555555',
  visibility,
  text: `${SECRET}\n\nSecond paragraph here.`,
  authorName: 'Ada Lovelace',
  authorUsername: 'ada',
  publishedAt: '2026-11-01T10:00:00.000Z',
});

describe('isPublicPost', () => {
  it('is true only for public', () => {
    expect(isPublicPost('public')).toBe(true);
    for (const v of ['followers', 'private', '', null, undefined, 'PUBLIC']) {
      expect(isPublicPost(v)).toBe(false);
    }
  });
});

describe('buildPostMetadata', () => {
  it('gives a public post a title from the author and its first line, and a canonical URL', () => {
    const meta = buildPostMetadata(post('public'), SITE);
    expect(meta.title).toBe(`Ada Lovelace: “${SECRET}”`);
    expect(meta.description).toBe(`${SECRET} Second paragraph here.`);
    expect(meta.alternates?.canonical).toBe(`${SITE}/post/${post('public').id}`);
    expect(meta.robots).toBeUndefined();
    expect(meta.openGraph).toMatchObject({
      type: 'article',
      url: `${SITE}/post/${post('public').id}`,
      publishedTime: '2026-11-01T10:00:00.000Z',
      authors: ['Ada Lovelace'],
    });
    expect(meta.twitter).toMatchObject({ card: 'summary' });
  });

  it.each(['followers', 'private'])('puts none of a %s post into metadata', visibility => {
    const meta = buildPostMetadata(post(visibility), SITE);
    expect(meta).toEqual({ title: NON_PUBLIC_POST_TITLE, robots: { index: false, follow: false } });
    const serialized = JSON.stringify(meta);
    expect(serialized).not.toContain('old mill');
    expect(serialized).not.toContain('Ada');
    expect(serialized).not.toContain('Second paragraph');
  });

  it('says nothing about a post the reader cannot see', () => {
    expect(buildPostMetadata(null, SITE)).toEqual({
      title: NON_PUBLIC_POST_TITLE,
      robots: { index: false, follow: false },
    });
  });
});

describe('postPreview', () => {
  it('clips a long first line on a word and keeps the description short', () => {
    const long = 'word '.repeat(100).trim();
    const { title, description } = postPreview({ ...post('public'), text: long });
    expect(title.length).toBeLessThan(90);
    expect(title.endsWith('…”')).toBe(true);
    expect(description.length).toBeLessThanOrEqual(200);
  });

  it('falls back to the handle and to a neutral title when there are no words', () => {
    expect(postPreview({ ...post('public'), authorName: '', text: '' }).title).toBe('Post by @ada');
  });
});

describe('postUrl', () => {
  it('is one URL whatever the site URL ends with', () => {
    expect(postUrl(`${SITE}/`, 'abc')).toBe(`${SITE}/post/abc`);
    expect(postUrl(SITE, 'abc')).toBe(`${SITE}/post/abc`);
  });
});
