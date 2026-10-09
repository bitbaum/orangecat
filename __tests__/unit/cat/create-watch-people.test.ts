/**
 * create_watch for the kinds that follow people — person_posts and
 * following_topic. Parameter validation happens here, before a row exists:
 * a person watch must name a real person who is not the user, a topic watch
 * must name a topic, and the cursor starts NOW so nothing old is announced.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { productivityHandlers } from '@/services/cat/handlers/productivity';
import { validateActionParameters } from '@/services/cat/action-schemas';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { recordingClient, type RecordedQuery } from './helpers/recording-client';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => false,
  embedText: vi.fn(),
  embedTexts: vi.fn(),
}));

const create = productivityHandlers.create_watch;

function db(opts: { active?: unknown[]; follows?: unknown[] } = {}) {
  return recordingClient((q: RecordedQuery) => {
    if (q.table === DATABASE_TABLES.PROFILES) {
      const name = q.calls.find(([m, a]) => m === 'eq' && a[0] === 'username')?.[1][1];
      if (name === 'alice') {
        return { data: { id: 'alice-id', username: 'alice', name: 'Alice' } };
      }
      if (name === 'me') {
        return { data: { id: 'me', username: 'me', name: 'Me' } };
      }
      return { data: null };
    }
    if (q.table === DATABASE_TABLES.CAT_WATCHES && q.write?.op === 'insert') {
      return { data: { id: 'new-watch', ...q.write.values } };
    }
    if (q.table === DATABASE_TABLES.CAT_WATCHES) {
      return { data: opts.active ?? [] };
    }
    if (q.table === DATABASE_TABLES.FOLLOWS) {
      return { data: opts.follows ?? [{ following_id: 'alice-id' }] };
    }
    return { data: [] };
  });
}

const run = (client: unknown, params: Record<string, unknown>) =>
  create(client as AnySupabaseClient, 'me', 'actor-me', params);

describe('person_posts', () => {
  it('stores the person, the optional keyword and a cursor of now', async () => {
    const { client, queries } = db();
    const before = Date.now();
    const r = await run(client, {
      kind: 'person_posts',
      label: 'Alice posted',
      username: '@alice',
      topic: 'Lightning',
    });
    expect(r.success).toBe(true);
    const insert = queries.find(q => q.write?.op === 'insert')!.write!.values;
    expect(insert).toMatchObject({
      user_id: 'me',
      kind: 'person_posts',
      subject_user_id: 'alice-id',
      topic: 'Lightning',
    });
    expect(Date.parse(insert.last_seen_at as string)).toBeGreaterThanOrEqual(before - 1000);
  });

  it('needs a username', async () => {
    const r = await run(db().client, { kind: 'person_posts', label: 'x' });
    expect(r).toMatchObject({ success: false, error: expect.stringMatching(/username/) });
  });

  it('refuses an unknown person — no row', async () => {
    const { client, queries } = db();
    const r = await run(client, { kind: 'person_posts', label: 'x', username: 'nobody' });
    expect(r.success).toBe(false);
    expect(queries.some(q => q.write)).toBe(false);
  });

  it('refuses watching yourself', async () => {
    const r = await run(db().client, { kind: 'person_posts', label: 'x', username: 'me' });
    expect(r).toMatchObject({ success: false, error: expect.stringMatching(/you/) });
  });

  it('does not duplicate an identical active watch', async () => {
    const { client, queries } = db({
      active: [{ id: 'w1', kind: 'person_posts', topic: null, subject_user_id: 'alice-id' }],
    });
    const r = await run(client, { kind: 'person_posts', label: 'x', username: 'alice' });
    expect(r.success).toBe(true);
    expect(queries.some(q => q.write?.op === 'insert')).toBe(false);
  });

  it('caps standing watches', async () => {
    const active = Array.from({ length: 20 }, (_, i) => ({
      id: `w${i}`,
      kind: 'following_topic',
      topic: `t${i}`,
      subject_user_id: null,
    }));
    const r = await run(db({ active }).client, {
      kind: 'person_posts',
      label: 'x',
      username: 'alice',
    });
    expect(r).toMatchObject({ success: false, error: expect.stringMatching(/max 20/) });
  });
});

describe('following_topic', () => {
  it('needs a topic', async () => {
    const r = await run(db().client, { kind: 'following_topic', label: 'x' });
    expect(r).toMatchObject({ success: false, error: expect.stringMatching(/topic/) });
  });

  it('rejects an unusable topic', async () => {
    const r = await run(db().client, { kind: 'following_topic', label: 'x', topic: 'a' });
    expect(r.success).toBe(false);
  });

  it('creates it, and says so honestly when they follow nobody yet', async () => {
    const { client, queries } = db({ follows: [] });
    const r = await run(client, { kind: 'following_topic', label: 'x', topic: 'Lightning' });
    expect(r.success).toBe(true);
    expect((r.data as { displayMessage: string }).displayMessage).toMatch(/don’t follow anyone/);
    expect(queries.find(q => q.write?.op === 'insert')!.write!.values).toMatchObject({
      kind: 'following_topic',
      topic: 'Lightning',
      subject_user_id: null,
    });
  });
});

describe('registry', () => {
  it('declares the new kinds and their parameters', () => {
    const action = CAT_ACTIONS.create_watch;
    expect(action.description).toMatch(/person_posts/);
    expect(action.description).toMatch(/following_topic/);
    expect(action.parameters.map(p => p.name)).toEqual(
      expect.arrayContaining(['username', 'topic'])
    );
    // Still a low-risk, no-confirmation action — "@cat watch her posts" runs.
    expect(action.riskLevel).toBe('low');
    expect(action.requiresConfirmation).toBe(false);
  });

  it('validates the parameters at the boundary', () => {
    expect(
      validateActionParameters('create_watch', {
        kind: 'person_posts',
        label: 'Alice posted',
        username: 'alice',
      }).ok
    ).toBe(true);
    // a handle is a string — anything else is refused before the handler runs
    expect(
      validateActionParameters('create_watch', {
        kind: 'person_posts',
        label: 'x',
        username: 42,
      }).ok
    ).toBe(false);
  });

  it('rejects an unknown kind', async () => {
    const r = await run(db().client, { kind: 'someone_sneezes', label: 'x' });
    expect(r).toMatchObject({ success: false, error: expect.stringMatching(/person_posts/) });
  });
});
