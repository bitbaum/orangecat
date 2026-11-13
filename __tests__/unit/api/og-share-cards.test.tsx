/**
 * What the share cards at /api/og/{project,profile,group} say (QA 2026-11-12):
 * - the project card said "Back it in Bitcoin" on projects nobody can pay yet;
 * - profile and group cards cut the text at 180 characters, mid-word;
 * - a profile or group that does not exist got a card built from the URL,
 *   so any made-up name rendered as an official-looking OrangeCat card;
 * - the group card showed "/slug" under "@", a path that 404s.
 */

import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const rows = vi.hoisted(() => ({ byTable: {} as Record<string, unknown> }));
const resolveSellerReceiveInfo = vi.hoisted(() => vi.fn());

vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(
      public element: ReactElement,
      public init: unknown
    ) {}
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: rows.byTable[table] ?? null }) }),
      }),
    }),
  }),
}));
vi.mock('@/domain/payments', () => ({ resolveSellerReceiveInfo }));
vi.mock('@/services/loki/studio-project', () => ({ getStudioProject: async () => null }));

import { GET as projectCard } from '@/app/api/og/project/[id]/route';
import { GET as profileCard } from '@/app/api/og/profile/[username]/route';
import { GET as groupCard } from '@/app/api/og/group/[slug]/route';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';

const request = {} as Request;

/** The text a card draws, or null for the plain brand card (a mark, no words). */
async function cardText(response: Promise<unknown>): Promise<string> {
  const { element } = (await response) as { element: ReactElement };
  return renderToStaticMarkup(element)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BACKING = 'Back it in Bitcoin';

beforeEach(() => {
  rows.byTable = {};
  resolveSellerReceiveInfo.mockReset();
});

describe('the project card', () => {
  const ID = '50878743-e277-462d-815e-7ee491d09c06';
  const ctx = { params: Promise.resolve({ id: ID }) };

  beforeEach(() => {
    rows.byTable[getTableName('project')] = {
      title: "Paul's Flower Shop in Zurich",
      description: 'Paul is opening a flower shop in Zurich.',
      status: 'active',
      cover_image_url: null,
      logo_url: null,
      user_id: 'user-1',
    };
    rows.byTable[DATABASE_TABLES.PROFILES] = { name: 'Cato', username: 'cato' };
  });

  it('says how to back it when a wallet receives', async () => {
    resolveSellerReceiveInfo.mockResolvedValue({ method: 'lightning_address', address: 'a@b.c' });
    expect(await cardText(projectCard(request, ctx))).toContain(BACKING);
    expect(resolveSellerReceiveInfo).toHaveBeenCalledWith('project', ID);
  });

  it('does not offer backing when nothing can receive', async () => {
    resolveSellerReceiveInfo.mockResolvedValue(null);
    const text = await cardText(projectCard(request, ctx));
    expect(text).toContain('Paul is opening a flower shop in Zurich.');
    expect(text).not.toContain(BACKING);
  });

  it('does not offer backing when the lookup fails', async () => {
    resolveSellerReceiveInfo.mockRejectedValue(new Error('down'));
    expect(await cardText(projectCard(request, ctx))).not.toContain(BACKING);
  });
});

const MARCO_BIO =
  '28-jähriger Maschinenbauingenieur, der den Sprung in die Selbständigkeit gewagt hat. ' +
  'Ich betreibe einen kleinen Makerspace in Basel — mit 3D-Druckern, Lasercuttern und einer ' +
  'CNC-Fräse. Hier verkaufe ich meine Arbeit und biete Kurse an.';

describe('the profile card', () => {
  const ctx = (username: string) => ({ params: Promise.resolve({ username }) });

  it('says one sentence of the bio, not 180 characters cut mid-word', async () => {
    rows.byTable[DATABASE_TABLES.PROFILES] = {
      name: 'Marco Rossi',
      username: 'marcorossi',
      bio: MARCO_BIO,
      avatar_url: null,
    };
    const text = await cardText(profileCard(request, ctx('marcorossi')));
    expect(text).toContain('Marco Rossi');
    expect(text).toContain(
      '28-jähriger Maschinenbauingenieur, der den Sprung in die Selbständigkeit gewagt hat.'
    );
    expect(text).not.toContain('CNC-Fr');
  });

  it('is the plain brand card for a name nobody has', async () => {
    const text = await cardText(profileCard(request, ctx('Satoshi Nakamoto - official')));
    expect(text).toBe('');
  });
});

describe('the group card', () => {
  const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it('says one line and no path that 404s', async () => {
    rows.byTable[DATABASE_TABLES.GROUPS] = {
      name: 'Zurich Record Shop',
      description: `A new record shop in the heart of Zurich, dedicated to the vinyl culture. ${'More. '.repeat(40)}`,
      avatar_url: null,
    };
    const text = await cardText(groupCard(request, ctx('zurich-record-shop')));
    expect(text).toContain('Zurich Record Shop');
    expect(text).toContain(
      'A new record shop in the heart of Zurich, dedicated to the vinyl culture.'
    );
    expect(text).not.toContain('More.');
    expect(text).not.toContain('/zurich-record-shop');
  });

  it('is the plain brand card for a group that does not exist', async () => {
    const text = await cardText(groupCard(request, ctx('Official Bitcoin Refund Desk')));
    expect(text).toBe('');
  });
});
