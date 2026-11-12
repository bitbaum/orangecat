/**
 * POST /oauth/person-tags — the door an app uses to learn which of its
 * accounts are one person (ADR-0014 D7).
 *
 * What this route decides is WHO may ask, so the tests are about refusals:
 * an unknown app, a public one, a wrong secret and an untrusted one never
 * reach the database, and the first three are indistinguishable from each
 * other. What a trusted app gets is pinned too, down to the cache header.
 */
// The suite-wide next/server mock stubs NextResponse.json to return nothing;
// this route's whole job is the response, so give it a real one.
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      }),
  },
}));
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const client = vi.hoisted(() => ({
  value: null as null | {
    client_id: string;
    is_confidential: boolean;
    is_trusted: boolean;
    client_secret_hash: string | null;
  },
}));
const tagsFor = vi.hoisted(() => vi.fn());
const limited = vi.hoisted(() => ({ success: true }));

vi.mock('@/services/auth/oauthProvider', async () => {
  const actual = await vi.importActual<typeof import('@/services/auth/oauthProvider')>(
    '@/services/auth/oauthProvider'
  );
  return { ...actual, getClient: vi.fn(async () => client.value) };
});
vi.mock('@/domain/identities/personTags', () => ({ personTagsFor: tagsFor }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn(() => ({})) }));
vi.mock('@/lib/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit');
  return {
    ...actual,
    rateLimit: vi.fn(async () => ({
      success: limited.success,
      limit: 100,
      remaining: limited.success ? 99 : 0,
      resetTime: Date.now() + 60_000,
    })),
  };
});

import { createHash } from 'node:crypto';
import { POST } from '@/app/oauth/person-tags/route';

const A = '11111111-1111-4111-8111-111111111111';
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function ask(body: unknown): Promise<Response> {
  return POST(
    new Request('https://orangecat.ch/oauth/person-tags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never
  );
}

const good = { client_id: 'solon', client_secret: 's3cret', scope: 'org:7', subjects: [A] };

beforeEach(() => {
  limited.success = true;
  tagsFor.mockReset();
  tagsFor.mockResolvedValue({ ok: true, tags: { [A]: 'ab'.repeat(32) } });
  client.value = {
    client_id: 'solon',
    is_confidential: true,
    is_trusted: true,
    client_secret_hash: sha256('s3cret'),
  };
});

describe('who may ask', () => {
  it('answers a trusted confidential client with its tags, never cached', async () => {
    const res = await ask(good);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tags: { [A]: 'ab'.repeat(32) } });
    expect(res.headers.get('cache-control')).toContain('no-store');
    // The client id passed on is the registered one, not whatever was typed.
    expect(tagsFor).toHaveBeenCalledWith(expect.anything(), 'solon', 'org:7', [A]);
  });

  it('gives one answer for an unknown app, a public app and a wrong secret', async () => {
    const answers: Array<[number, unknown]> = [];
    client.value = null;
    let res = await ask(good);
    answers.push([res.status, await res.json()]);

    client.value = {
      client_id: 'solon',
      is_confidential: false,
      is_trusted: true,
      client_secret_hash: null,
    };
    res = await ask(good);
    answers.push([res.status, await res.json()]);

    client.value = {
      client_id: 'solon',
      is_confidential: true,
      is_trusted: true,
      client_secret_hash: sha256('s3cret'),
    };
    res = await ask({ ...good, client_secret: 'wrong' });
    answers.push([res.status, await res.json()]);

    expect(answers.every(([status]) => status === 401)).toBe(true);
    expect(new Set(answers.map(a => JSON.stringify(a))).size).toBe(1);
    expect(tagsFor).not.toHaveBeenCalled();
  });

  it('refuses a missing secret and a missing client id the same way', async () => {
    for (const body of [
      { ...good, client_secret: undefined },
      { ...good, client_id: undefined },
    ]) {
      expect((await ask(body)).status).toBe(401);
    }
    expect(tagsFor).not.toHaveBeenCalled();
  });

  it('refuses a client that authenticates but is not trusted, before any lookup', async () => {
    client.value = { ...client.value!, is_trusted: false };
    const res = await ask(good);
    expect(res.status).toBe(403);
    expect(tagsFor).not.toHaveBeenCalled();
  });

  it('is rate limited before anything is read', async () => {
    limited.success = false;
    const res = await ask(good);
    expect(res.status).toBe(429);
    expect(tagsFor).not.toHaveBeenCalled();
  });
});

describe('what it answers', () => {
  it('refuses a body that is not JSON', async () => {
    expect((await ask('not json')).status).toBe(400);
  });

  it('says what is wrong with a bad scope or bad subjects', async () => {
    tagsFor.mockResolvedValueOnce({ ok: false, reason: 'invalid_scope' });
    let res = await ask(good);
    expect(res.status).toBe(400);
    expect((await res.json()).error_description).toMatch(/scope/);
    tagsFor.mockResolvedValueOnce({ ok: false, reason: 'invalid_subjects' });
    res = await ask(good);
    expect(res.status).toBe(400);
    expect((await res.json()).error_description).toMatch(/subjects/);
  });

  it('reports a failed lookup as unavailable, never as "no tags"', async () => {
    tagsFor.mockResolvedValueOnce({ ok: false, reason: 'failed' });
    const res = await ask(good);
    expect(res.status).toBe(503);
    expect(await res.json()).not.toHaveProperty('tags');
  });
});
