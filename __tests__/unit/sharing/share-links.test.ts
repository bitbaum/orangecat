/**
 * The external links behind "Share": the same ids, order, verbs and URLs as
 * `shareLinks` in @bitbaum/bip-kit, so swapping this copy for the package is
 * one line. Every URL is the service's documented share endpoint.
 */
import { defaultShareLinkLabels, shareLinks } from '@/components/sharing/shareLinks';

const url = 'https://orangecat.ch/post/abc';
const byId = (links: ReturnType<typeof shareLinks>) =>
  Object.fromEntries(links.map(l => [l.id, l.href]));

describe('shareLinks', () => {
  it('returns every service, in bip-kit order, labelled with a verb', () => {
    const links = shareLinks({ url, title: 'Hello' });
    expect(links.map(l => l.id)).toEqual([
      'x',
      'linkedin',
      'bluesky',
      'hackernews',
      'whatsapp',
      'telegram',
      'email',
    ]);
    for (const link of links) {
      expect(link.label).toMatch(/^(Share|Submit|Send|Email)\b/);
    }
  });

  it('builds each documented endpoint with the URL and title encoded', () => {
    const hrefs = byId(shareLinks({ url, title: 'A & B', summary: 'Two lines' }));
    const u = encodeURIComponent(url);
    expect(hrefs.x).toBe(`https://x.com/intent/tweet?text=A%20%26%20B&url=${u}`);
    expect(hrefs.linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`);
    expect(hrefs.bluesky).toBe(`https://bsky.app/intent/compose?text=A%20%26%20B%20${u}`);
    expect(hrefs.hackernews).toBe(`https://news.ycombinator.com/submitlink?u=${u}&t=A%20%26%20B`);
    expect(hrefs.whatsapp).toBe(`https://wa.me/?text=A%20%26%20B%20${u}`);
    expect(hrefs.telegram).toBe(`https://t.me/share/url?url=${u}&text=A%20%26%20B`);
    expect(hrefs.email).toBe(
      `mailto:?subject=A%20%26%20B&body=${encodeURIComponent(`Two lines\n\n${url}`)}`
    );
  });

  it('shares the bare link when there is no title', () => {
    expect(byId(shareLinks({ url, title: '  ' })).whatsapp).toBe(
      `https://wa.me/?text=${encodeURIComponent(url)}`
    );
  });

  it('takes replacement labels and keeps the rest', () => {
    const links = shareLinks({ url, title: 't', labels: { x: 'Poste auf X' } });
    expect(links[0].label).toBe('Poste auf X');
    expect(links[1].label).toBe(defaultShareLinkLabels.linkedin);
  });

  it('refuses a relative URL rather than building broken links', () => {
    expect(() => shareLinks({ url: '/post/abc', title: 't' })).toThrow(/absolute URL/);
  });
});
