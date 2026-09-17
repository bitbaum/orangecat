/**
 * The RSS parser feeding the syndication sweep. Fixtures mirror what the fleet
 * feeds actually emit (Loki /rss.xml shape) — plain tags, CDATA blocks,
 * and entity-encoded text — plus the malformed shapes the parser must shrug
 * off rather than throw on, because a bad feed must never fail the cron tick.
 */
import { parseRssItems } from '@/services/syndication/rss';

const FLEET_SHAPED_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Loki Thoughts</title>
    <link>https://loki.orangecat.ch/thoughts</link>
    <item>
      <title>Load Through the Seam &amp; Beyond</title>
      <link>https://loki.orangecat.ch/thoughts/load-through-the-seam</link>
      <guid isPermaLink="true">https://loki.orangecat.ch/thoughts/load-through-the-seam</guid>
      <pubDate>Thu, 20 Aug 2026 00:00:00 GMT</pubDate>
      <description><![CDATA[An audit of <em>The Two Halves</em>, joined.]]></description>
    </item>
    <item>
      <title>One Star &#8212; the baseline</title>
      <link>https://loki.orangecat.ch/thoughts/one-star</link>
      <pubDate>not a date</pubDate>
    </item>
  </channel>
</rss>`;

describe('parseRssItems', () => {
  it('parses the fleet feed shape: entities, CDATA, guid attribute, pubDate', () => {
    const items = parseRssItems(FLEET_SHAPED_FEED);
    expect(items).toHaveLength(2);

    expect(items[0]).toEqual({
      title: 'Load Through the Seam & Beyond',
      link: 'https://loki.orangecat.ch/thoughts/load-through-the-seam',
      guid: 'https://loki.orangecat.ch/thoughts/load-through-the-seam',
      description: 'An audit of <em>The Two Halves</em>, joined.',
      publishedAt: '2026-08-20T00:00:00.000Z',
    });
  });

  it('falls back to the link as guid, decodes numeric entities, drops bad dates', () => {
    const [, second] = parseRssItems(FLEET_SHAPED_FEED);
    expect(second.guid).toBe(second.link);
    expect(second.title).toBe('One Star — the baseline');
    // "not a date" must be omitted, never NaN-serialized — the publish schema
    // would reject the whole item over it.
    expect(second.publishedAt).toBeUndefined();
  });

  it('omits items missing a title or link instead of guessing', () => {
    const xml = `<rss><channel>
      <item><title>No link here</title></item>
      <item><link>https://example.com/no-title</link></item>
      <item><title>Complete</title><link>https://example.com/ok</link></item>
    </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Complete');
  });

  it('returns [] on garbage rather than throwing', () => {
    expect(parseRssItems('')).toEqual([]);
    expect(parseRssItems('not xml at all')).toEqual([]);
    expect(parseRssItems('<rss><item><title>unterminated')).toEqual([]);
  });
});
