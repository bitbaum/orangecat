import { createAdminClient } from '@/lib/supabase/admin';
import { semanticPublicSearch } from '@/services/search/semantic-public';
import { embedText, embeddingsEnabled } from '@/services/ai/embeddings';
import { FIXTURE_RPC_ARGS } from '@/services/search/public-search';
vi.mock('@/services/ai/embeddings', () => ({ embedText: vi.fn(), embeddingsEnabled: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn() } }));
const live = (id: string, kind = 'project', title = 'Current public title') => ({
  entity_type: kind,
  id,
  title,
  snippet: 'Current public text',
  image_url: null,
  path_key: null,
  amount: null,
  currency: null,
  starts_at: null,
  place: null,
  created_at: null,
  rank: 0,
  total: 1,
});
beforeEach(() => {
  vi.mocked(embeddingsEnabled).mockReturnValue(true);
  vi.mocked(embedText).mockResolvedValue([0.1, 0.2]);
});
describe('Semantic candidates must pass the current public gate', () => {
  it('drops private or missing rows and returns only live metadata, never stale index content', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            entity_type: 'project',
            entity_id: 'public',
            similarity: 0.9,
            title: 'Stale title',
            url: '/wrong',
            text_preview: 'Stale words',
          },
          {
            entity_type: 'research',
            entity_id: 'private',
            similarity: 0.95,
            title: 'Private title',
          },
          { entity_type: 'wallet', entity_id: 'wallet', similarity: 0.99 },
          { entity_type: 'project', entity_id: 'weak', similarity: 0.1 },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [live('public')], error: null });
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
    const callerRpc = vi.fn().mockResolvedValue({ data: [live('public')], error: null });
    const results = await semanticPublicSearch({ rpc: callerRpc } as never, 'public topic');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'public',
      title: 'Current public title',
      snippet: 'Current public text',
      href: '/projects/public',
    });
    expect(JSON.stringify(results)).not.toContain('Private title');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('match_content', expect.any(Object));
    expect(callerRpc).toHaveBeenCalledTimes(1);
    expect(callerRpc).toHaveBeenLastCalledWith('lookup_public_documents', {
      p_keys: [
        { type: 'project', id: 'public' },
        { type: 'research', id: 'private' },
      ],
      ...FIXTURE_RPC_ARGS,
    });
  });
  it('does not fall back to stale index text when live lookup fails', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { entity_type: 'project', entity_id: 'p', similarity: 0.9, title: 'Old private title' },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'down' } });
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
    expect(await semanticPublicSearch({ rpc } as never, 'topic')).toEqual([]);
  });
  it('supports all public kinds while respecting the requested kind', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { entity_type: 'research', entity_id: 'r', similarity: 0.8 },
          { entity_type: 'project', entity_id: 'p', similarity: 0.9 },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [live('r', 'research')], error: null });
    vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
    expect(
      (await semanticPublicSearch({ rpc } as never, 'science', 'research')).map(h => h.type)
    ).toEqual(['research']);
    expect(rpc.mock.calls[0][1]).toMatchObject({ filter_type: 'research' });
  });
  it('makes no embedding request when meaning search is not configured', async () => {
    vi.mocked(embeddingsEnabled).mockReturnValue(false);
    vi.mocked(embedText).mockClear();
    const rpc = vi.fn();
    expect(await semanticPublicSearch({ rpc } as never, 'topic')).toEqual([]);
    expect(embedText).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
