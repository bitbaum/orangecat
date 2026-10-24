import { searchPlatform, SEARCH_TYPES } from '@/services/cat/platform-search';
import { PLATFORM_TOOL_DEFINITION } from '@/services/cat/platform-tool-definitions';
import type { FoundHit } from '@/services/search/find';
import { findPublic } from '@/services/search/find';
import { semanticPublicSearch } from '@/services/search/semantic-public';
vi.mock('@/services/search/find', () => ({ findPublic: vi.fn() }));
vi.mock('@/services/search/semantic-public', () => ({ semanticPublicSearch: vi.fn() }));
const row: FoundHit = {
  id: 'r',
  type: 'research',
  title: 'Public research',
  snippet: 'Published results',
  href: '/research/r',
  imageUrl: null,
  amount: null,
  currency: null,
  startsAt: null,
  place: null,
  createdAt: null,
  handle: null,
  rank: 1,
  marks: { title: [], snippet: [] },
  typos: 0,
};
beforeEach(() => {
  vi.mocked(findPublic).mockResolvedValue({ hits: [row], total: 1, suggestion: null });
  vi.mocked(semanticPublicSearch).mockResolvedValue([]);
});
it('uses the shared corrected public search for a previously missing kind', async () => {
  const db = {} as never;
  expect(await searchPlatform(db, 'scince', 'research')).toEqual([
    {
      type: 'research',
      title: 'Public research',
      description: 'Published results',
      url: '/research/r',
    },
  ]);
  expect(findPublic).toHaveBeenLastCalledWith('scince', {
    types: ['research'],
    limit: 5,
    perType: 5,
  });
  expect(semanticPublicSearch).toHaveBeenLastCalledWith(db, 'scince', 'research');
});
it('gives the model the same public type list as API and MCP, excluding private kinds', () => {
  const definition = PLATFORM_TOOL_DEFINITION.find(t => t.function.name === 'search_platform')!;
  expect(definition.function.parameters.properties).toMatchObject({
    type: { enum: [...SEARCH_TYPES] },
  });
  expect(SEARCH_TYPES).toEqual(
    expect.arrayContaining([
      'research',
      'groups',
      'wishlists',
      'loans',
      'investments',
      'assets',
      'ai_assistants',
    ])
  );
  expect(SEARCH_TYPES).not.toContain('wallets');
  expect(SEARCH_TYPES).not.toContain('documents');
});
it('propagates an unavailable lexical engine instead of claiming zero matches', async () => {
  vi.mocked(findPublic).mockRejectedValueOnce(new Error('Unavailable'));
  await expect(searchPlatform({} as never, 'science')).rejects.toThrow('Unavailable');
});
