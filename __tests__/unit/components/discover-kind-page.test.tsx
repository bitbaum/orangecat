// @vitest-environment jsdom
/**
 * Discover, as the 2026-11-12 audit found it:
 *  - a kind's page was headed "Discover" — it did not say it was Products;
 *  - "1 products"; an empty kind rendered nothing below its chips;
 *  - a rail with five to eight cards hid the rest from sm up with no "See all";
 *  - links sent `?section=projects`, which the page ignored, and showed everything;
 *  - a failed search call was cached as an empty shelf ("That's everything").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/events/EventsNearYou', () => ({ default: () => <div>near you</div> }));

import { DiscoverScreen, countLabel } from '@/components/discover/DiscoverScreen';
import { parseDiscoverParams } from '@/services/discover/params';
import { DISCOVER_RAIL_VISIBLE } from '@/config/discover-tabs';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { countPublic, searchPublic, type PublicHit } from '@/services/search/public-search';
import type { DiscoverView } from '@/services/discover/view';

const hit = (type: PublicHit['type'], id: string) =>
  ({ type, id, title: `Thing ${id}`, href: `/x/${id}`, imageUrl: null, snippet: '' }) as PublicHit;

const browse = (over: Partial<Extract<DiscoverView, { mode: 'browse' }>>): DiscoverView => ({
  mode: 'browse',
  counts: { product: 1, project: 3 },
  type: 'product',
  hits: [hit('product', '1')],
  total: 1,
  hasMore: false,
  fallback: [],
  ...over,
});

describe('one kind’s page', () => {
  it('is headed with the kind, with the way back to Discover above it', () => {
    render(<DiscoverScreen params={{ q: '', type: 'product', page: 1 }} view={browse({})} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      ENTITY_REGISTRY.product.namePlural
    );
    expect(screen.getByRole('link', { name: 'Discover' }).getAttribute('href')).toBe(
      ROUTES.DISCOVER
    );
  });

  it('counts in the singular when there is one', () => {
    expect(countLabel('product', 1)).toBe(`1 ${ENTITY_REGISTRY.product.name.toLowerCase()}`);
    expect(countLabel('product', 3)).toBe(`3 ${ENTITY_REGISTRY.product.namePlural.toLowerCase()}`);
  });

  it('says a kind is empty and offers to list the first one', () => {
    render(
      <DiscoverScreen
        params={{ q: '', type: 'research', page: 1 }}
        view={browse({ type: 'research', hits: [], total: 0, fallback: [hit('product', '9')] })}
      />
    );
    expect(screen.getByText(/listed yet\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'List the first one' }).getAttribute('href')).toBe(
      ENTITY_REGISTRY.research.createPath
    );
    expect(screen.getByRole('heading', { name: 'Just listed' })).toBeTruthy();
  });

  it('puts "What’s on near you" above the events', () => {
    render(
      <DiscoverScreen
        params={{ q: '', type: 'event', page: 1 }}
        view={browse({ type: 'event', hits: [hit('event', 'e')] })}
      />
    );
    expect(screen.getByText('near you')).toBeTruthy();
  });
});

describe('the shelf', () => {
  it('offers "See all" on any rail longer than it shows', () => {
    const hits = ['1', '2', '3', '4', '5'].map(id => hit('product', id));
    render(
      <DiscoverScreen
        params={{ q: '', type: null, page: 1 }}
        view={{
          mode: 'shelf',
          counts: { product: 5 },
          fresh: [],
          rails: [{ type: 'product', hits, total: 5 }],
          more: [],
        }}
      />
    );
    expect(screen.getByRole('link', { name: /See all 5/ })).toBeTruthy();
  });

  it('shows from sm up exactly the number the CSS leaves visible', () => {
    const css = readFileSync(join(__dirname, '../../../src/app/globals.css'), 'utf8');
    expect(css).toContain(`.oc-discover-rail-item:nth-child(n + ${DISCOVER_RAIL_VISIBLE + 1})`);
  });

  it('keeps the row of kinds one line at every width', () => {
    const css = readFileSync(join(__dirname, '../../../src/app/globals.css'), 'utf8');
    const rule = css.slice(css.indexOf('.oc-discover-chips {'));
    expect(rule.slice(0, rule.indexOf('}'))).not.toContain('flex-wrap');
  });
});

describe('links into Discover', () => {
  it('reads the old `section` parameter as the kind', () => {
    expect(parseDiscoverParams({ section: 'projects' }).type).toBe('project');
    expect(parseDiscoverParams({ section: 'people' }).type).toBe('profile');
    expect(parseDiscoverParams({ type: 'products', section: 'projects' }).type).toBe('product');
  });
});

describe('a failed read is not an empty marketplace', () => {
  const failing = { rpc: async () => ({ data: null, error: { message: 'down' } }) } as never;

  it('throws when the caller caches what it shows', async () => {
    await expect(searchPublic(failing, { strict: true })).rejects.toThrow();
    await expect(countPublic(failing, { strict: true })).rejects.toThrow();
  });

  it('still answers "nothing" to callers that did not ask', async () => {
    expect(await searchPublic(failing)).toEqual({ hits: [], total: 0 });
    expect(await countPublic(failing)).toEqual({});
  });
});
