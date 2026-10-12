vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import {
  FIXTURE_RPC_ARGS,
  safeImageUrl,
  searchPublic,
  toPublicHit,
} from '@/services/search/public-search';
import { EXACT_FIXTURE_USERNAMES, FIXTURE_TITLE_LIKE_PATTERNS } from '@/config/public-directory';

const row = (over: Record<string, unknown> = {}) => ({
  entity_type: 'product',
  id: 'p1',
  title: 'Bitcoin hardware wallet',
  snippet: 'cold storage',
  image_url: null,
  path_key: null,
  amount: '80.00000000',
  currency: 'CHF',
  starts_at: null,
  place: null,
  created_at: '2026-10-01T00:00:00Z',
  rank: 1.2,
  total: '7',
  ...over,
});

describe('searchPublic', () => {
  it('asks search_public with the fixture filters from public-directory', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [row()], error: null });
    const page = await searchPublic({ rpc } as never, { query: ' loki ', perType: 4, limit: 12 });
    expect(rpc).toHaveBeenCalledWith('search_public', {
      p_query: 'loki',
      p_types: null,
      p_limit: 12,
      p_offset: 0,
      p_per_type: 4,
      ...FIXTURE_RPC_ARGS,
      p_terms: null,
    });
    expect(FIXTURE_RPC_ARGS.p_exclude_title_like).toEqual([...FIXTURE_TITLE_LIKE_PATTERNS]);
    expect(FIXTURE_RPC_ARGS.p_exclude_handles).toEqual([...EXACT_FIXTURE_USERNAMES]);
    expect(page.total).toBe(7);
    expect(page.hits[0]).toMatchObject({ type: 'product', amount: 80 });
    expect(page.hits[0].href).toMatch(/\/p1$/);
  });

  it('drops the fixtures SQL cannot spell the same way', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        row({ entity_type: 'group', id: 'g', title: 'Audit Group 1783191071580', path_key: 'ag' }),
        row({ entity_type: 'profile', id: 'u', title: 'User', path_key: 'someone' }),
        row({ entity_type: 'profile', id: 'c', title: 'Cato', path_key: 'cato' }),
      ],
      error: null,
    });
    const { hits } = await searchPublic({ rpc } as never, { query: 'a' });
    expect(hits.map(h => h.id)).toEqual(['c']);
    expect(hits[0]).toMatchObject({ href: '/profiles/cato', handle: 'cato' });
  });

  it('never throws: an RPC error is an empty page', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await searchPublic({ rpc } as never)).toEqual({ hits: [], total: 0 });
    const throwing = vi.fn().mockRejectedValue(new Error('down'));
    expect(await searchPublic({ rpc: throwing } as never)).toEqual({ hits: [], total: 0 });
  });

  it('maps a group by its slug and an unpriceable amount to null', () => {
    expect(
      toPublicHit(row({ entity_type: 'group', path_key: 'bitbaum', amount: null }))
    ).toMatchObject({ href: '/groups/bitbaum', amount: null });
  });
});

describe('safeImageUrl', () => {
  it('keeps absolute and site-relative pictures, drops the rest', () => {
    expect(safeImageUrl('https://images.example/a.png')).toBe('https://images.example/a.png');
    expect(safeImageUrl('/uploads/a.png')).toBe('/uploads/a.png');
    for (const bad of ['a.png', '//evil.example/a.png', 'javascript:alert(1)', '', null]) {
      expect(safeImageUrl(bad)).toBeNull();
    }
  });
});
