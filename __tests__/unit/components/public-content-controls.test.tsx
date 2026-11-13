// @vitest-environment jsdom
/**
 * Public content pages, measured on orangecat.ch at 390px with a touch
 * pointer (2026-11-12):
 *  - /blog: the newsletter input stayed 268px wide (a flex item does not
 *    shrink below its intrinsic width), so "Subscribe" ended at x=393 on a
 *    390px screen; only the 25px title line of a post card opened the post;
 *    "Subscribe via RSS" was 36px tall. The success line said "Watch your
 *    inbox" though nothing sends mail to the list.
 *  - /study-bitcoin: three coming-soon paths had a "Learn More" link to "#"
 *    that did nothing; the one live path claimed "1-2 hours · 5 lessons" for a
 *    single guide page under a "Structured courses" heading; the level filters
 *    were 36px tall with no aria-pressed;
 *    "Get Started", "Visit" and "Read" were orange text on white (2.3:1).
 *  - "Start" / "See yours" on every capability card were 36px (min-h-9),
 *    changelog date permalinks 15px, /ecosystem's Solon links 20px.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/lib/blog', () => ({
  getPublishedPosts: () => [],
  getFeaturedPost: () => null,
  getAllTags: () => [],
}));
vi.mock('@/lib/development/records', () => ({ loadOrangeCatProfile: async () => ({}) }));
vi.mock('@bitbaum/bip-kit', () => ({
  linkDevelopment: () => ({
    changes: [{ anchor: 'c-2026-11-12', date: '2026-11-12', lines: [{ text: 'x', advances: [] }] }],
  }),
}));
vi.mock('@/services/ai/studio-map-fetcher', () => ({ fetchStudioMapForCat: async () => null }));

import NewsletterSignup from '@/components/blog/NewsletterSignup';
import { BlogPostCard } from '@/components/blog/BlogPostCard';
import BlogPage from '@/app/(public)/blog/page';
import StudyBitcoinPage from '@/app/(public)/study-bitcoin/page';
import { LEARNING_PATHS, QUICK_RESOURCES } from '@/app/(public)/study-bitcoin/config';
import { ResourceCard } from '@/app/(public)/study-bitcoin/ResourceCard';
import { CapabilityMap } from '@/components/map/CapabilityMap';
import ChangelogPage from '@/app/(public)/changelog/page';
import EcosystemPage from '@/app/(public)/ecosystem/page';

const TAP = /\bmin-h-11\b/;

describe('/blog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('the newsletter input can shrink, so Subscribe stays inside its card', () => {
    render(<NewsletterSignup source="blog" />);
    expect(screen.getByRole('textbox', { name: 'Email address' }).className).toMatch(/\bmin-w-0\b/);
  });

  it('a signup does not promise mail that nothing sends', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }))
    );
    render(<NewsletterSignup source="blog" />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    const status = await screen.findByRole('status');
    expect(status.textContent).not.toMatch(/inbox/i);
    expect(status.textContent).toMatch(/on the list/);
  });

  it('the whole post card opens the post, and the link is named by its title', () => {
    render(
      <BlogPostCard
        post={{
          slug: 'a-post',
          title: 'A post',
          excerpt: 'What it says',
          date: '2026-11-12',
          readTime: '3 min',
          tags: ['bitcoin'],
          author: 'OrangeCat',
          featured: false,
        }}
      />
    );
    const link = screen.getByRole('link', { name: 'A post' });
    expect(link.getAttribute('href')).toBe('/blog/a-post');
    expect(link.className).toMatch(/\bafter:absolute\b/);
    expect(link.className).toMatch(/\bafter:inset-0\b/);
    // The ::after is positioned against the card, not the heading.
    const card = link.closest('h2')!.parentElement!;
    expect(card.className).toMatch(/\brelative\b/);
    expect(within(card).getByText('What it says')).toBeTruthy();
  });

  it('"Subscribe via RSS" is 44px tall', () => {
    render(<BlogPage />);
    expect(screen.getByRole('link', { name: /Subscribe via RSS/ }).className).toMatch(TAP);
  });
});

describe('/study-bitcoin', () => {
  it('the level filter is one segmented control: 44px cells that say which is chosen', () => {
    render(<StudyBitcoinPage />);
    const group = screen.getByRole('group', { name: 'Level' });
    const cells = within(group).getAllByRole('button');
    expect(cells.map(c => c.textContent)).toEqual(['All', 'Beginner', 'Intermediate', 'Advanced']);
    for (const cell of cells) {
      expect(cell.className).toMatch(TAP);
    }
    expect(cells.map(c => c.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    fireEvent.click(cells[2]);
    expect(cells.map(c => c.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ]);
  });

  it('a coming-soon path is not a dead link, and no path claims lessons or hours', () => {
    const { container } = render(<StudyBitcoinPage />);
    expect(container.querySelector('a[href="#"]')).toBeNull();
    expect(screen.queryByText(/Learn More/)).toBeNull();
    expect(container.textContent).not.toMatch(/\blessons?\b|\bhours?\b/);
    // One guide page is not "structured courses".
    expect(container.textContent).not.toMatch(/courses/i);

    for (const path of LEARNING_PATHS) {
      const card = screen.getByRole('heading', { name: path.title }).parentElement!;
      const links = within(card).queryAllByRole('link');
      if (path.status === 'available') {
        expect(links.map(l => l.getAttribute('href'))).toEqual([path.href]);
        expect(links[0].className).toMatch(/\btext-on-accent\b/);
      } else {
        expect(links).toHaveLength(0);
        expect(within(card).getByText('Coming Soon')).toBeTruthy();
      }
    }
  });

  it('resource links are ink, not orange text', () => {
    for (const resource of QUICK_RESOURCES) {
      const { unmount } = render(
        <ResourceCard resource={resource} featured={Boolean(resource.featured)} />
      );
      for (const link of screen.getAllByRole('link')) {
        expect(link.className).not.toMatch(/text-bitcoinOrange/);
        expect(link.className).toMatch(/\btext-fg-primary\b/);
      }
      unmount();
    }
  });
});

describe('standalone links on the other public pages', () => {
  it('"Start" and "See yours" on every capability card are 44px tall', () => {
    render(<CapabilityMap />);
    const links = [
      ...screen.getAllByRole('link', { name: /^Start/ }),
      ...screen.getAllByRole('link', { name: 'See yours' }),
    ];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.className).toMatch(TAP);
    }
  });

  it('a changelog date permalink is 44px tall without moving its line', async () => {
    render(await ChangelogPage());
    const permalink = document.querySelector('a[href="#c-2026-11-12"]')!;
    expect(permalink.className).toMatch(/\binline-flex\b/);
    expect(permalink.className).toMatch(TAP);
    expect(permalink.className).toMatch(/-my-3\b/);
  });

  it("/ecosystem's Solon links are 44px tall", async () => {
    render(await EcosystemPage());
    for (const name of ['Solon decisions', 'Live governed state']) {
      const link = screen.getByRole('link', { name });
      expect(link.className).toMatch(/\binline-flex\b/);
      expect(link.className).toMatch(TAP);
    }
  });
});
