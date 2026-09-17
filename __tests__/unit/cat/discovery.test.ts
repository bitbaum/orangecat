import { exploreTopic, formatDiscoveryForModel } from '@/services/cat/discovery';
import { messageMightNeedTools, PLATFORM_TOOL_DEFINITION } from '@/services/cat/tool-use-detection';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * Interest discovery. The contract: find public entities by MEANING, attribute
 * each to its owner, and surface the people behind the work — because only a
 * handful of profiles carry a bio, so people are discoverable through what they
 * published, not through their profile text.
 *
 * Embeddings are mocked; the RPC shape and the enrichment/attribution logic are
 * what these tests pin.
 */

vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => true,
  embedText: async () => new Array(1536).fill(0.01),
  embedTexts: async (xs: string[]) => xs.map(() => new Array(1536).fill(0.01)),
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

interface Row {
  [k: string]: unknown;
}

/**
 * Supabase mock: rpc is routed BY NAME — match_content (entities) and
 * match_interested_people (declared interests) are separate channels and a
 * mock that conflated them would hide exactly the bug worth catching.
 */
function mockSupabase(opts: {
  matches?: Row[];
  rpcError?: unknown;
  interestRows?: Row[];
  tables?: Record<string, Row | null>;
}) {
  const client = {
    rpc: async (name: string) => {
      if (name === 'match_interested_people') {
        return { data: opts.interestRows ?? [], error: null };
      }
      return { data: opts.matches ?? [], error: opts.rpcError ?? null };
    },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
        builder[m] = chain;
      }
      builder.maybeSingle = async () => ({
        data: opts.tables?.[table] ?? null,
        error: null,
      });
      builder.then = (resolve: (v: unknown) => void) =>
        resolve({ data: opts.tables?.[table] ? [opts.tables[table]] : [], error: null });
      return builder;
    },
  } as unknown as AnySupabaseClient;
  return client;
}

describe('exploreTopic', () => {
  it('surfaces the PERSON behind a matched entity (no bio required)', async () => {
    const client = mockSupabase({
      matches: [
        {
          entity_type: 'research',
          entity_id: 'r1',
          title: 'Longevity biomarkers study',
          url: '/research/r1',
          text_preview: 'Tracking biomarkers of ageing',
          similarity: 0.72,
        },
      ],
      tables: {
        research_entities: {
          id: 'r1',
          title: 'Longevity biomarkers study',
          description: 'Tracking biomarkers of ageing',
          actor_id: 'actor-1',
          user_id: null,
        },
        actors: { user_id: 'owner-1', display_name: 'Dr. Ada' },
        profiles: { username: 'ada', name: 'Dr. Ada Lovelace' },
      },
    });

    const result = await exploreTopic(client, 'viewer-1', 'longevity');
    expect(result.degraded).toBe(false);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].entityType).toBe('research');
    expect(result.hits[0].owner?.username).toBe('ada');

    // The person is discoverable via the work, with the reason attached.
    expect(result.people).toHaveLength(1);
    expect(result.people[0].displayName).toBe('Dr. Ada Lovelace');
    expect(result.people[0].profileUrl).toBe('/profiles/ada');
    expect(result.people[0].via[0]).toContain('Longevity biomarkers study');
  });

  it("excludes the viewer's own entities — discovering yourself is not discovery", async () => {
    const client = mockSupabase({
      matches: [
        {
          entity_type: 'project',
          entity_id: 'p1',
          title: 'My own longevity project',
          url: '/projects/p1',
          text_preview: '',
          similarity: 0.8,
        },
      ],
      tables: {
        projects: {
          id: 'p1',
          title: 'My own longevity project',
          actor_id: null,
          user_id: 'viewer-1',
        },
        profiles: { username: 'me', name: 'Me' },
      },
    });
    const result = await exploreTopic(client, 'viewer-1', 'longevity');
    expect(result.hits).toEqual([]);
    expect(result.people).toEqual([]);
  });

  it('drops a hit whose row is no longer public (index lagged)', async () => {
    const client = mockSupabase({
      matches: [
        {
          entity_type: 'project',
          entity_id: 'gone',
          title: 'Archived project',
          url: '/projects/gone',
          text_preview: '',
          similarity: 0.7,
        },
      ],
      tables: { projects: null }, // public gate filtered it out
    });
    const result = await exploreTopic(client, 'viewer-1', 'longevity');
    expect(result.hits).toEqual([]);
  });

  it('never surfaces test-key rows', async () => {
    const client = mockSupabase({
      matches: [
        {
          entity_type: 'product',
          entity_id: 't1',
          title: 'Test product',
          url: '/products/t1',
          text_preview: '',
          similarity: 0.9,
        },
      ],
      tables: {
        user_products: {
          id: 't1',
          title: 'Test product',
          actor_id: null,
          user_id: 'x',
          is_test: true,
        },
      },
    });
    const result = await exploreTopic(client, 'viewer-1', 'longevity');
    expect(result.hits).toEqual([]);
  });

  it('finds someone who published NOTHING but declared the interest', async () => {
    // The case the platform actually has: 148 profiles, 5 bios, no longevity
    // entities. Without this channel the answer is "nobody", which is wrong.
    const client = mockSupabase({
      matches: [],
      interestRows: [{ user_id: 'u2', topic: 'longevity research', similarity: 0.8 }],
      tables: { profiles: { id: 'u2', username: 'ada', name: 'Ada' } },
    });
    const result = await exploreTopic(client, 'viewer-1', 'longevity');
    expect(result.hits).toEqual([]);
    expect(result.people).toHaveLength(1);
    expect(result.people[0].username).toBe('ada');

    // And the digest must not tell the model the platform is empty.
    const digest = formatDiscoveryForModel(result);
    expect(digest).toContain('Ada');
    expect(digest).not.toContain('No public entities or people');
  });

  it('keeps BOTH reasons when someone matches by work and by interest', async () => {
    const client = mockSupabase({
      matches: [
        {
          entity_type: 'research',
          entity_id: 'r1',
          title: 'Biomarkers study',
          url: '/research/r1',
          text_preview: '',
          similarity: 0.7,
        },
      ],
      interestRows: [{ user_id: 'owner-1', topic: 'longevity', similarity: 0.9 }],
      tables: {
        research_entities: {
          id: 'r1',
          title: 'Biomarkers study',
          actor_id: null,
          user_id: 'owner-1',
        },
        profiles: { id: 'owner-1', username: 'ada', name: 'Ada' },
      },
    });
    const result = await exploreTopic(client, 'viewer-1', 'longevity');
    expect(result.people).toHaveLength(1);
    expect(result.people[0].via.join(' ')).toContain('Interested in longevity');
    expect(result.people[0].via.join(' ')).toContain('Biomarkers study');
  });

  it('an empty topic search still offers being findable + a watch', async () => {
    const client = mockSupabase({ matches: [], interestRows: [] });
    const digest = formatDiscoveryForModel(
      await exploreTopic(client, 'viewer-1', 'basket weaving')
    );
    expect(digest).toContain('publish_interest');
    expect(digest).toContain('watch_topic');
    expect(digest).toContain('never publish silently');
  });

  it('reports degraded (not "nothing found") when the index is unreachable', async () => {
    const client = mockSupabase({ rpcError: { message: 'boom' } });
    const result = await exploreTopic(client, 'viewer-1', 'longevity');
    expect(result.degraded).toBe(true);
    expect(formatDiscoveryForModel(result)).toContain('UNAVAILABLE');
    expect(formatDiscoveryForModel(result)).toContain('do NOT claim the platform has nothing');
  });

  it('an empty result is framed as being early, not as failure', async () => {
    const client = mockSupabase({ matches: [] });
    const result = await exploreTopic(client, 'viewer-1', 'basket weaving');
    const digest = formatDiscoveryForModel(result);
    expect(digest).toContain('No public entities');
    expect(digest).toContain('early');
  });
});

describe('discovery wiring', () => {
  it('explore_topic is a declared platform tool', () => {
    const def = PLATFORM_TOOL_DEFINITION.find(t => t.function.name === 'explore_topic');
    expect(def).toBeDefined();
    expect((def!.function.parameters as { required: string[] }).required).toEqual(['topic']);
  });

  it('interest phrasings reach the tool pass (they did not before)', () => {
    for (const msg of [
      "I'm interested in longevity",
      'anyone working on Bitcoin education?',
      'put me in touch with people doing regenerative farming',
      'introduce me to that researcher',
      "I'm curious about DeSci",
      'tell me about longevity here',
    ]) {
      expect(messageMightNeedTools(msg)).toBe(true);
    }
  });
});
