/**
 * The share cards at /api/og/entity/[type]/[id] and /api/og/post/[id]
 * (full-path review 2026-11-13, create#2, media#4): eight of eleven kinds and
 * every wall post shared as the generic site card or as no image at all.
 *
 * What a card must do: say the thing's own title, who made it (never a minted
 * `user_<hex>` handle) and its one figure; and say NOTHING about anything a
 * signed-out stranger could not open — a draft, a private item, a
 * followers-only post — which get the plain brand card.
 */

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The real icons: a card with no picture draws its kind's icon.
vi.unmock('lucide-react');

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]> }));

vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(
      public element: ReactElement,
      public init: { width: number; height: number; headers: Record<string, string> }
    ) {}
  },
}));

/** A sessionless client over in-memory rows that honours eq / in filters. */
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({
    from: (table: string) => {
      const filters: Array<(row: Row) => boolean> = [];
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          filters.push(row => row[column] === value);
          return chain;
        },
        in: (column: string, values: unknown[]) => {
          filters.push(row => values.includes(row[column]));
          return chain;
        },
        maybeSingle: async () => ({
          data: (db.tables[table] ?? []).find(row => filters.every(f => f(row))) ?? null,
        }),
      };
      return chain;
    },
  }),
}));
vi.mock('@/services/currency/rates.server', () => ({
  convertBtcToOrNull: async (btc: number) => btc * 80000,
}));

import { GET as entityCard } from '@/app/api/og/entity/[type]/[id]/route';
import { GET as postCard } from '@/app/api/og/post/[id]/route';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';

const request = {} as Request;
const ID = '50878743-e277-462d-815e-7ee491d09c06';
const OWNER = '0b8f6c1e-0000-4000-8000-000000000001';

type CardResponse = {
  element: ReactElement;
  init: { width: number; height: number; headers: Record<string, string> };
};

/** The words a card draws; '' for the plain brand card (a mark, no words). */
async function cardText(response: Promise<unknown>): Promise<string> {
  const { element } = (await response) as CardResponse;
  return renderToStaticMarkup(element)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const entity = (type: string, id = ID) =>
  entityCard(request, { params: Promise.resolve({ type, id }) });
const post = (id = ID) => postCard(request, { params: Promise.resolve({ id }) });

beforeEach(() => {
  db.tables = {
    [DATABASE_TABLES.PROFILES]: [
      { id: OWNER, name: 'DJ Lukas', username: 'lukas', avatar_url: null, created_at: null },
    ],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 404 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the entity card', () => {
  it('says the title, the maker and the price of a published service', async () => {
    db.tables[getTableName('service')] = [
      {
        id: ID,
        user_id: OWNER,
        status: 'active',
        title: 'DJ set for your party',
        description: 'Four hours of disco and house. Bring your own crowd.',
        hourly_rate: 150,
        currency: 'CHF',
      },
    ];
    const text = await cardText(entity('service'));
    expect(text).toContain('DJ set for your party');
    expect(text).toContain('Service · by DJ Lukas');
    expect(text).toContain('CHF 150.00 / hour');
    expect(text).toContain('Four hours of disco and house.');
  });

  it('draws the kind’s icon when the item has no picture of its own', async () => {
    db.tables[getTableName('service')] = [
      { id: ID, user_id: OWNER, status: 'active', title: 'DJ set for your party' },
    ];
    const { element } = (await entity('service')) as CardResponse;
    const markup = renderToStaticMarkup(element);
    expect(markup).toMatch(/<svg[^>]*viewBox="0 0 24 24"[^>]*>\s*<(path|rect|circle)/);
    expect(markup).not.toContain('<img');
  });

  it('is drawn at 1200×630 and cached an hour, like every card', async () => {
    db.tables[getTableName('product')] = [
      { id: ID, user_id: OWNER, status: 'active', title: 'Old Road Bike', price: 240 },
    ];
    const { init } = (await entity('product')) as CardResponse;
    expect(init.width).toBe(1200);
    expect(init.height).toBe(630);
    expect(init.headers['cache-control']).toBe('public, max-age=3600, s-maxage=3600');
  });

  it('prices in CHF when the seller set no currency', async () => {
    db.tables[getTableName('product')] = [
      { id: ID, user_id: OWNER, status: 'active', title: 'Old Road Bike', price: 240 },
    ];
    expect(await cardText(entity('product'))).toContain('CHF 240.00');
  });

  it('never prints a minted handle as the maker', async () => {
    db.tables[DATABASE_TABLES.PROFILES] = [
      { id: OWNER, name: null, username: 'user_df091395b2ca', avatar_url: null },
    ];
    db.tables[getTableName('product')] = [
      { id: ID, user_id: OWNER, status: 'active', title: 'Flash Sheet PDF', price: 12 },
    ];
    const text = await cardText(entity('product'));
    expect(text).toContain('Flash Sheet PDF');
    expect(text).not.toContain('user_df091395b2ca');
    expect(text).not.toContain(' by ');
  });

  it('gives an event its date and city', async () => {
    db.tables[getTableName('event')] = [
      {
        id: ID,
        user_id: OWNER,
        status: 'published',
        title: 'Open Bob',
        start_date: '2026-12-05T19:00:00.000Z',
        timezone: 'Europe/Zurich',
        venue_name: 'Rote Fabrik',
        venue_city: 'Zurich',
      },
    ];
    const text = await cardText(entity('event'));
    expect(text).toContain('December 5, 2026 · Zurich');
  });

  it('states a goal and never an amount raised', async () => {
    db.tables[getTableName('cause')] = [
      {
        id: ID,
        user_id: OWNER,
        status: 'active',
        title: 'Ceramics Workshop Fund',
        goal_amount: 5000,
        total_raised: 40,
        currency: 'CHF',
      },
    ];
    const text = await cardText(entity('cause'));
    expect(text).toContain('Goal CHF 5,000.00');
    expect(text).not.toContain('40');
  });

  it('shows the item’s own picture when it can be drawn', async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(png, { headers: { 'content-type': 'image/png' } }))
    );
    db.tables[getTableName('product')] = [
      {
        id: ID,
        user_id: OWNER,
        status: 'active',
        title: 'Old Road Bike',
        images: ['https://supabase.orangecat.ch/storage/v1/object/public/bike.png'],
      },
    ];
    const { element } = (await entity('product')) as CardResponse;
    expect(renderToStaticMarkup(element)).toContain('src="data:image/png;base64,');
  });

  it.each([
    ['a draft product', 'product', { status: 'draft', title: 'Secret Drop' }],
    ['a private companion', 'ai_assistant', { is_public: false, title: 'Secret Drop' }],
    ['a cancelled loan', 'loan', { is_public: true, status: 'cancelled', title: 'Secret Drop' }],
    [
      'a private wishlist',
      'wishlist',
      { is_active: true, visibility: 'private', title: 'Secret Drop' },
    ],
    ['a draft event', 'event', { status: 'draft', title: 'Secret Drop' }],
  ] as const)('is the plain brand card for %s', async (_label, type, row) => {
    db.tables[getTableName(type)] = [{ id: ID, user_id: OWNER, ...row }];
    expect(await cardText(entity(type))).toBe('');
  });

  it('is the plain brand card for a kind with its own card or no public page', async () => {
    for (const type of ['project', 'group', 'wallet', 'document', 'nonsense']) {
      expect(await cardText(entity(type))).toBe('');
    }
  });

  it('is the plain brand card for an id that is not one', async () => {
    expect(await cardText(entity('product', 'Satoshi Nakamoto - official'))).toBe('');
  });
});

describe('the post card', () => {
  const words =
    'Opening the record shop on Saturday at ten, first fifty visitors get a free tote bag and a coffee from the corner';

  beforeEach(() => {
    db.tables[DATABASE_TABLES.TIMELINE_EVENTS] = [
      {
        id: ID,
        visibility: 'public',
        is_deleted: false,
        title: null,
        description: `${words}\n\nSecond paragraph.`,
        actor_id: OWNER,
      },
    ];
  });

  it('says who wrote a public post and its first words', async () => {
    const text = await cardText(post());
    expect(text).toContain('Post · by DJ Lukas');
    expect(text).toContain('Opening the record shop on Saturday at ten');
    expect(text).toContain('…');
    expect(text).not.toContain('Second paragraph');
  });

  it.each(['followers', 'private'])('is the plain brand card for a %s post', async visibility => {
    db.tables[DATABASE_TABLES.TIMELINE_EVENTS][0].visibility = visibility;
    expect(await cardText(post())).toBe('');
  });

  it('is the plain brand card for a deleted post', async () => {
    db.tables[DATABASE_TABLES.TIMELINE_EVENTS][0].is_deleted = true;
    expect(await cardText(post())).toBe('');
  });
});
