import {
  normalizeTopic,
  cleanTopic,
  isValidTopic,
  publishInterest,
  findPeopleByInterest,
  MAX_INTERESTS_PER_USER,
} from '@/services/cat/interests';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { formatDiscoveryForModel } from '@/services/cat/discovery';
import { ACTION_HANDLERS } from '@/services/cat/handlers';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * Interests are the only Cat-written data other people can see, so these tests
 * pin two things: that the same interest phrased differently dedupes, and that
 * publishing can never happen without an explicit confirmation.
 */

vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => true,
  embedText: async () => new Array(1536).fill(0.01),
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

interface Row {
  [k: string]: unknown;
}

function mockSupabase(opts: {
  existing?: Row[];
  insertError?: unknown;
  rpcRows?: Row[];
  profiles?: Row[];
  onInsert?: (payload: Row) => void;
}) {
  const client = {
    rpc: async () => ({ data: opts.rpcRows ?? [], error: null }),
    from: (table: string) => {
      const rows = table === 'profiles' ? (opts.profiles ?? []) : (opts.existing ?? []);
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'order', 'limit', 'delete']) {
        builder[m] = () => builder;
      }
      builder.insert = async (payload: Row) => {
        opts.onInsert?.(payload);
        return { error: opts.insertError ?? null };
      };
      builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
      return builder;
    },
  } as unknown as AnySupabaseClient;
  return client;
}

describe('topic normalization', () => {
  it('strips lead-in filler so the stored phrase is the topic itself', () => {
    expect(normalizeTopic("I'm really interested in longevity research")).toBe(
      'longevity research'
    );
    expect(normalizeTopic('into Bitcoin education')).toBe('bitcoin education');
    expect(cleanTopic('I am passionate about Tattoo Art.')).toBe('Tattoo Art');
  });

  it('treats differently-phrased versions of one interest as the same row', () => {
    expect(normalizeTopic('Longevity')).toBe(normalizeTopic('  interested in   longevity  '));
  });

  it('never stems — "longevity" and "longevity research" stay distinct interests', () => {
    expect(normalizeTopic('longevity')).not.toBe(normalizeTopic('longevity research'));
  });

  it('rejects topics that are empty or absurdly long', () => {
    expect(isValidTopic('')).toBe(false);
    expect(isValidTopic('a')).toBe(false);
    expect(isValidTopic('x'.repeat(200))).toBe(false);
    expect(isValidTopic('longevity')).toBe(true);
  });
});

describe('publishInterest', () => {
  it('stores the cleaned phrase and its embedding', async () => {
    let captured: Row | null = null;
    const client = mockSupabase({ existing: [], onInsert: p => (captured = p) });
    const result = await publishInterest(client, 'u1', "I'm interested in longevity research");
    expect(result).toMatchObject({ ok: true, alreadyPublished: false });
    expect(captured).not.toBeNull();
    expect((captured as unknown as Row).topic).toBe('longevity research');
    expect((captured as unknown as Row).user_id).toBe('u1');
    expect((captured as unknown as Row).embedding).toBeTruthy();
  });

  it('is idempotent — re-publishing does not create a second row', async () => {
    let inserts = 0;
    const client = mockSupabase({
      existing: [
        { id: '1', topic: 'longevity', normalized: 'longevity', source: 'cat', created_at: 'x' },
      ],
      onInsert: () => (inserts += 1),
    });
    const result = await publishInterest(client, 'u1', 'Interested in longevity');
    expect(result).toMatchObject({ ok: true, alreadyPublished: true });
    expect(inserts).toBe(0);
  });

  it('refuses past the per-user cap', async () => {
    const existing = Array.from({ length: MAX_INTERESTS_PER_USER }, (_, i) => ({
      id: String(i),
      topic: `t${i}`,
      normalized: `t${i}`,
      source: 'cat',
      created_at: 'x',
    }));
    const client = mockSupabase({ existing });
    const result = await publishInterest(client, 'u1', 'one more');
    expect(result.ok).toBe(false);
  });

  it('rejects an unusable topic instead of publishing junk', async () => {
    const client = mockSupabase({ existing: [] });
    expect((await publishInterest(client, 'u1', 'a')).ok).toBe(false);
  });
});

describe('findPeopleByInterest', () => {
  it('surfaces a person who published NOTHING but declared the interest', async () => {
    const client = mockSupabase({
      rpcRows: [{ user_id: 'u2', topic: 'longevity research', similarity: 0.8 }],
      profiles: [{ id: 'u2', username: 'ada', name: 'Ada' }],
    });
    const people = await findPeopleByInterest(client, 'u1', 'longevity');
    expect(people).toHaveLength(1);
    expect(people[0].username).toBe('ada');
    expect(people[0].profileUrl).toBe('/profiles/ada');
    expect(people[0].via[0]).toBe('Interested in longevity research');
  });

  it('drops matches with no readable profile rather than showing a ghost', async () => {
    const client = mockSupabase({
      rpcRows: [{ user_id: 'ghost', topic: 'longevity', similarity: 0.9 }],
      profiles: [],
    });
    expect(await findPeopleByInterest(client, 'u1', 'longevity')).toEqual([]);
  });
});

describe('publishing safety', () => {
  it('publish_interest is high-risk and always confirms — it cannot be automated', () => {
    const action = CAT_ACTIONS.publish_interest;
    expect(action).toBeDefined();
    expect(action.riskLevel).toBe('high');
    expect(action.requiresConfirmation).toBe(true);
  });

  it('removing an interest never requires confirmation — opting out must be frictionless', () => {
    expect(CAT_ACTIONS.unpublish_interest.requiresConfirmation).toBe(false);
  });

  it('every interest action has a handler', () => {
    for (const id of ['publish_interest', 'unpublish_interest', 'watch_topic']) {
      expect(ACTION_HANDLERS[id]).toBeInstanceOf(Function);
    }
  });
});

describe('publishing closes the loop immediately', () => {
  it('tells the user who else is already into it', async () => {
    const client = mockSupabase({
      existing: [],
      rpcRows: [{ user_id: 'u2', topic: 'longevity', similarity: 0.9 }],
      profiles: [{ id: 'u2', username: 'ada', name: 'Ada' }],
    });
    const result = await ACTION_HANDLERS.publish_interest!(client, 'u1', 'actor-1', {
      topic: 'longevity',
    });
    expect(result.success).toBe(true);
    const data = result.data as { peers: unknown[]; message: string };
    expect(data.peers).toHaveLength(1);
    expect(data.message).toContain('Ada');
    expect(data.message).toContain('@ada');
  });

  it('says nothing about peers when there are none', async () => {
    const client = mockSupabase({ existing: [], rpcRows: [], profiles: [] });
    const result = await ACTION_HANDLERS.publish_interest!(client, 'u1', 'actor-1', {
      topic: 'basket weaving',
    });
    const data = result.data as { peers: unknown[]; message: string };
    expect(data.peers).toEqual([]);
    expect(data.message).not.toContain('into this too');
  });
});

describe('publish_interest is not confusable with update_profile', () => {
  /**
   * Caught in production: a free model read "puts that topic on their public
   * profile" and offered to edit the user's bio instead of publishing an
   * interest, so the feature was unreachable by its natural path. The word
   * "profile" is the trap; these assertions keep it out.
   */
  it('the action description steers away from bio editing', () => {
    const d = CAT_ACTIONS.publish_interest.description;
    expect(d).toContain('NOT update_profile');
    expect(d).not.toMatch(/on their public profile/i);
  });

  it('the empty-search digest tells the model which verb to use', () => {
    const digest = formatDiscoveryForModel({
      topic: 'permaculture',
      hits: [],
      people: [],
      degraded: false,
    });
    expect(digest).toContain('publish_interest');
    expect(digest).toContain('NOT update_profile');
  });
});
