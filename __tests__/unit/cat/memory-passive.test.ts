import { extractAndStoreMemories, rememberFacts, isSuppressedFact } from '@/services/cat/memory';
import { distillMemories } from '@/services/cat/memory-extraction';
import { isPassiveMemoryFact } from '@/services/cat/memory-facts';
import { embedTexts } from '@/services/ai/embeddings';
import type { AnySupabaseClient } from '@/lib/supabase/types';

vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => true,
  embedTexts: vi.fn(),
  embedText: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

function database(suppressionError = false) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
  const client = {
    rpc,
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: { memory_enabled: true }, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: [],
            error: suppressionError && table === 'cat_forgotten_facts' ? { code: 'DB_DOWN' } : null,
            count: 0,
          }).then(resolve),
        insert,
      };
      return builder;
    },
  } as unknown as AnySupabaseClient;
  return { client, insert, rpc };
}

const aiFor = (facts: string[]) => ({
  chatCompletion: vi.fn().mockResolvedValue({ content: JSON.stringify(facts) }),
});

it('does not retain the transient writing intent and product praise shown in the screenshots', async () => {
  const { client, insert } = database();
  const ai = aiFor([
    'Intends to write an article',
    'Wants to write an article',
    'Prefers Orange Cat as the best place to write',
  ]);
  await extractAndStoreMemories(
    client,
    'viewer',
    null,
    'I wanna write an article',
    'Open the editor',
    ai,
    'free-model'
  );
  expect(insert).not.toHaveBeenCalled();
  expect(embedTexts).not.toHaveBeenCalled();
});

it('retains ongoing writing habits and developer identity', () => {
  expect(isPassiveMemoryFact('Writes weekly articles about Bitcoin')).toBe(true);
  expect(isPassiveMemoryFact('Plans to write an article every week')).toBe(true);
  expect(isPassiveMemoryFact('Maintains OrangeCat')).toBe(true);
  expect(isPassiveMemoryFact('Uses Orange Cathedral for rehearsals')).toBe(true);
});

it('deduplicates repeated model text before embedding it', async () => {
  vi.mocked(embedTexts).mockResolvedValue([[1, 0]]);
  const facts = await distillMemories(
    'I live in Zurich',
    'Understood',
    aiFor(['Lives in Zurich', 'Lives in Zurich.']),
    'free-model'
  );
  expect(facts).toHaveLength(1);
  expect(embedTexts).toHaveBeenCalledWith(['Lives in Zurich']);
});

it('does not normalize different decimal values into one fact', async () => {
  vi.mocked(embedTexts).mockResolvedValue([
    [1, 0],
    [0, 1],
  ]);
  expect(
    await distillMemories(
      'I set different rates',
      'Understood',
      aiFor(['Charges 5.1 per hour', 'Charges 51 per hour']),
      'free-model'
    )
  ).toHaveLength(2);
});

it('preserves different amounts even with similar embeddings', async () => {
  const { client, insert } = database();
  vi.mocked(embedTexts).mockResolvedValue([
    [1, 0],
    [1, 0],
  ]);
  await extractAndStoreMemories(
    client,
    'viewer',
    null,
    'I charge different rates',
    'Understood',
    aiFor(['Charges 5.1 for editing', 'Charges 51 for writing']),
    'free-model'
  );
  expect(insert.mock.calls[0][0]).toHaveLength(2);
});

it('compares paraphrases within the same uninserted batch', async () => {
  const { client, insert, rpc } = database();
  vi.mocked(embedTexts).mockResolvedValue([
    [1, 0],
    [0.999, 0.001],
  ]);
  await extractAndStoreMemories(
    client,
    'viewer',
    null,
    'I work as a JavaScript developer',
    'Understood',
    aiFor(['Works as a JavaScript developer', 'Builds JavaScript applications professionally']),
    'free-model'
  );
  expect(insert.mock.calls[0][0]).toHaveLength(1);
  expect(rpc.mock.calls.filter(([name]) => name === 'match_cat_memories')).toHaveLength(1);
});

it('preserves unrelated facts in a batch', async () => {
  const { client, insert } = database();
  vi.mocked(embedTexts).mockResolvedValue([
    [1, 0],
    [0, 1],
  ]);
  await extractAndStoreMemories(
    client,
    'viewer',
    null,
    'I live in Zurich and work as a developer',
    'Understood',
    aiFor(['Lives in Zurich', 'Works as a developer']),
    'free-model'
  );
  expect(insert.mock.calls[0][0]).toHaveLength(2);
});

it('does not insert passive memories when the existing-memory check fails', async () => {
  const { client, insert, rpc } = database();
  rpc.mockResolvedValue({ data: null, error: { code: 'DB_DOWN' } });
  vi.mocked(embedTexts).mockResolvedValue([[1, 0]]);
  await extractAndStoreMemories(
    client,
    'viewer',
    null,
    'I live in Zurich',
    'Understood',
    aiFor(['Lives in Zurich']),
    'free-model'
  );
  expect(insert).not.toHaveBeenCalled();
});

it('does not relearn facts when forgotten-memory preferences cannot be read', async () => {
  const { client, insert } = database(true);
  vi.mocked(embedTexts).mockResolvedValue([[1, 0]]);
  await extractAndStoreMemories(
    client,
    'viewer',
    null,
    'I live in Zurich',
    'Understood',
    aiFor(['Lives in Zurich']),
    'free-model'
  );
  expect(insert).not.toHaveBeenCalled();
});

it('does not automatically relearn a candidate when semantic suppression lookup fails', async () => {
  const { client, rpc } = database();
  rpc.mockResolvedValue({ data: null, error: { code: 'DB_DOWN' } });
  expect(
    await isSuppressedFact(client, 'viewer', 'Plays piano', [1, 0], ['Has French skills'])
  ).toBe(true);
});

it('preserves an explicit remember command even for a one-off note', async () => {
  const { client, insert } = database();
  vi.mocked(embedTexts).mockResolvedValue([[1, 0]]);
  const result = await rememberFacts(client, 'viewer', ['Wants to write an article']);
  expect(result.stored).toEqual(['Wants to write an article']);
  expect(insert.mock.calls[0][0][0].source).toBe('user');
});
