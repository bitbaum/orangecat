/**
 * What a shared link says about the page it points at.
 *
 * Next.js replaces a parent's `openGraph` and `twitter` objects instead of
 * merging them, and copies a page's own title and description into og:* and
 * twitter:* only where the inherited object has none. Measured on production
 * 2026-11-12 with a share-crawler user agent:
 *
 * - the root layout carried the homepage's og:title, og:description and
 *   og:url, so /about, /faq, /whitepaper and every page without its own
 *   openGraph shared as the homepage;
 * - /pay/cato, /pay, /blog, /steal, /ecosystem and /community
 *   set an openGraph with no image, which dropped the root card, and most of
 *   them were titled "OrangeCat - Your AI Economic Agent" on X;
 * - entity, profile, group, article and blog descriptions went out whole: an
 *   investment's was 1,477 characters, a product's carried "\n\n- " bullets;
 * - X titled every person and group "<name> — AI economic agent".
 */

import { metadata as rootMetadata } from '@/app/layout';
import { metadata as homeMetadata } from '@/app/page';
import { metadata as payLandingMetadata } from '@/app/(public)/pay/page';
import { generateMetadata as payLinkMetadata } from '@/app/(public)/pay/[username]/page';
import { metadata as blogMetadata } from '@/app/(public)/blog/page';
import { metadata as stealMetadata } from '@/app/(public)/steal/page';
import { metadata as ecosystemMetadata } from '@/app/(public)/ecosystem/page';
import { metadata as communityMetadata } from '@/app/(authenticated)/community/layout';
import { generateMetadata as profileMetadata } from '@/app/profiles/[username]/page';
import { generateMetadata as groupMetadata } from '@/app/groups/[slug]/page';
import { generateMetadata as articleMetadata } from '@/app/(public)/articles/[slug]/page';
import { generateMetadata as blogPostMetadata } from '@/app/(public)/blog/[slug]/page';
import { generateEntityMetadata } from '@/lib/seo/metadata';

import type { Metadata } from 'next';

// Rendering the layout is not under test; importing it must not start the
// fonts loader, the rate refresh or the app shell.
vi.mock('@/app/fonts', () => ({
  inter: { variable: '' },
  spaceGrotesk: { variable: '' },
  ibmPlexMono: { variable: '' },
}));
vi.mock('@/services/currency/rates.server', () => ({ getRenderRates: () => null }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: () => null }));
vi.mock('@/app/(public)/pay/[username]/PayPageClient', () => ({ PayPageClient: () => null }));
vi.mock('@/components/profile/ProfilePageClient', () => ({ default: () => null }));

vi.mock('@/domain/lightning-address/lnurl-service', () => ({
  resolveLnurlRecipient: vi.fn(async (username: string) =>
    username === 'cato' ? { userId: 'u-1', username: 'cato', displayName: 'Cato' } : null
  ),
}));

const LONG_TEXT =
  'High-quality A3 giclée print from my Bitcoin Art Series. Each print is hand-numbered and signed.\n\nDetails:\n- A3 format (29.7 × 42 cm)\n- Giclée on archival paper\n- '.repeat(
    6
  );

const rows: Record<string, unknown> = {};
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({ data: rows[table] ?? null }),
        maybeSingle: async () => ({ data: rows[table] ?? null }),
      };
      return chain;
    },
  }),
}));

vi.mock('@/services/articles/get-article', () => ({
  getArticleBySlug: async () => ({
    slug: 'the-united-states-should-dissolve-pq2r82',
    title: 'The United States should dissolve',
    excerpt: LONG_TEXT,
    visibility: 'public',
    coverImage: null,
    publishedAt: '2026-11-01T00:00:00Z',
    author: { name: 'Someone' },
  }),
  isCurrentUserArticleAuthor: async () => false,
}));

vi.mock('@/lib/blog', () => ({
  getBlogPost: () => ({
    title: 'The Fleet You Can Hear',
    excerpt: LONG_TEXT,
    date: '2026-11-01',
    author: 'OrangeCat Team',
    tags: [],
  }),
  getBlogPostSlugs: () => [],
}));

type Og = { title?: string; description?: string; url?: string; images?: unknown };

function og(m: Metadata): Og {
  return (m.openGraph ?? {}) as Og;
}
function tw(m: Metadata): Og {
  return (m.twitter ?? {}) as Og;
}
function imageUrls(images: unknown): string[] {
  const list = Array.isArray(images) ? images : images ? [images] : [];
  return list.map(i => (typeof i === 'string' ? i : String((i as { url: unknown }).url)));
}

function expectTrimmed(text: unknown) {
  expect(typeof text).toBe('string');
  expect((text as string).length).toBeLessThanOrEqual(160);
  expect(text).not.toMatch(/\n/);
  expect((text as string).endsWith('…')).toBe(true);
}

describe('the root layout', () => {
  it('carries nothing that belongs to one page in openGraph or twitter', () => {
    // Anything here is what every page without its own openGraph shares as.
    expect(Object.keys(rootMetadata.openGraph ?? {}).sort()).toEqual([
      'locale',
      'siteName',
      'type',
    ]);
    expect(Object.keys(rootMetadata.twitter ?? {})).toEqual(['card']);
  });

  it('leaves the homepage its own share card and address', () => {
    expect(og(homeMetadata).title).toBe(homeMetadata.title);
    expect(og(homeMetadata).url).toMatch(/^https?:\/\/[^/]+\/$/);
    expect(tw(homeMetadata).title).toBe(og(homeMetadata).title);
    expect(homeMetadata.alternates?.types).toEqual(rootMetadata.alternates?.types);
  });
});

describe('pages that set their own openGraph', () => {
  it.each([
    ['/pay', payLandingMetadata],
    ['/blog', blogMetadata],
    ['/steal', stealMetadata],
    ['/ecosystem', ecosystemMetadata],
    ['/community', communityMetadata],
  ])('%s has a preview image, its own address, and one title on every network', (path, m) => {
    expect(imageUrls(og(m).images)).toHaveLength(1);
    expect(tw(m).images).toEqual(og(m).images);
    expect(og(m).url?.endsWith(path)).toBe(true);
    expect(tw(m).title).toBe(og(m).title);
    expect(tw(m).description).toBe(og(m).description);
    // Naming a canonical replaces the root's alternates; the feed must stay.
    expect(m.alternates?.types).toEqual(rootMetadata.alternates?.types);
  });

  it('a pay link shows the person being paid, on X as everywhere else', async () => {
    const m = await payLinkMetadata({
      params: Promise.resolve({ username: 'cato' }),
      searchParams: Promise.resolve({}),
    });
    expect(og(m).title).toBe('Pay Cato — OrangeCat');
    expect(tw(m).title).toBe(og(m).title);
    expect(imageUrls(og(m).images)[0]).toMatch(/\/api\/og\/profile\/cato$/);
    expect(tw(m).images).toEqual(og(m).images);
    expect(og(m).url).toMatch(/\/pay\/cato$/);
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});

describe('descriptions are cut where the page says, not mid-word by the reader', () => {
  it('for every entity type', () => {
    const m = generateEntityMetadata({
      type: 'product',
      id: 'p-1',
      title: 'Bitcoin Art Print',
      description: LONG_TEXT,
    });
    expectTrimmed(m.description);
    expect(og(m).description).toBe(m.description);
    expect(tw(m).description).toBe(m.description);
  });

  it('for an article and a blog post', async () => {
    const article = await articleMetadata({ params: Promise.resolve({ slug: 'x' }) });
    const post = await blogPostMetadata({ params: Promise.resolve({ slug: 'x' }) });
    for (const m of [article, post]) {
      expectTrimmed(m.description);
      expect(og(m).description).toBe(m.description);
      expect(tw(m).description).toBe(m.description);
    }
  });
});

describe('people and groups', () => {
  it('a profile is titled the same on X as everywhere else, with a trimmed bio', async () => {
    rows.profiles = { name: 'Marco Rossi', bio: LONG_TEXT, avatar_url: null, username: 'marco' };
    const m = await profileMetadata({ params: Promise.resolve({ username: 'marco' }) });
    expect(og(m).title).toBe('Marco Rossi on OrangeCat');
    expect(tw(m).title).toBe(og(m).title);
    expectTrimmed(m.description);
  });

  it('a group is titled the same on X as everywhere else, with a trimmed description', async () => {
    rows.groups = { name: 'Zurich Record Shop', description: LONG_TEXT, visibility: 'public' };
    const m = await groupMetadata({ params: Promise.resolve({ slug: 'zurich-record-shop' }) });
    expect(og(m).title).toBe('Zurich Record Shop — OrangeCat');
    expect(tw(m).title).toBe(og(m).title);
    expectTrimmed(m.description);
  });
});
