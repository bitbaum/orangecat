// @vitest-environment jsdom
/**
 * "Made on OrangeCat" shows Discover's own "Just listed" rows, in Discover's
 * cards, and nothing typed by hand. With nothing to show it is absent.
 */
import { render, screen } from '@testing-library/react';

const listed = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/services/discover/view', () => ({ loadJustListed: listed.load }));
vi.mock('@/components/discover/DiscoverRail', () => ({
  DiscoverRailTrack: ({ hits }: { hits: Array<{ id: string; title: string; href: string }> }) => (
    <ul>
      {hits.map(hit => (
        <li key={hit.id}>
          <a href={hit.href}>{hit.title}</a>
        </li>
      ))}
    </ul>
  ),
}));

import MakersSection from '@/components/home/sections/MakersSection';
import { HOME_MAKERS_COPY } from '@/config/landing-page';
import { ROUTES } from '@/config/routes';

describe('MakersSection', () => {
  it('shows what Discover lists, each a link to its public page', async () => {
    listed.load.mockResolvedValue([
      { type: 'product', id: 'p1', title: 'Sourdough loaf', href: '/products/p1' },
    ]);
    render(await MakersSection());
    expect(screen.getByRole('heading', { name: HOME_MAKERS_COPY.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sourdough loaf' })).toHaveAttribute(
      'href',
      '/products/p1'
    );
    expect(screen.getByRole('link', { name: HOME_MAKERS_COPY.seeAll })).toHaveAttribute(
      'href',
      ROUTES.DISCOVER
    );
  });

  it('is absent when there is nothing public to show', async () => {
    listed.load.mockResolvedValue([]);
    expect(await MakersSection()).toBeNull();
  });
});
