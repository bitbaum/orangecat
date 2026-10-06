/**
 * createEntityPostHandler — characterization tests.
 *
 * These pin what the handler DOES today, path by path: status codes, response
 * bodies, the order its gates run in, which side effects fire on which path,
 * and — just as important — which ones do NOT (several error paths return
 * without touching the idempotency claim). They exist so the handler can be
 * split into named phases without changing behaviour: a previous split moved
 * one of those paths and the change went unnoticed. A test here that has to
 * change means behaviour changed; that is a decision, not a refactor.
 *
 * Collaborators are mocked at module boundaries; the response helpers
 * (standardResponse), Zod, compose/withZodBody and hasScope are real.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { Mock } from 'vitest';

import { createEntityPostHandler } from '@/lib/api/entityPostHandler';
import { getEntityMetadata } from '@/config/entity-registry';
import { resolveRequestAuth } from '@/lib/api/resolveRequestAuth';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimitWriteAsync, rateLimitIntegrationKeyWrite } from '@/lib/rate-limit';
import {
  resolveCreationActor,
  ActorNotPermittedError,
} from '@/services/actors/resolveCreationActor';
import {
  claimIdempotencyKey,
  completeIdempotencyResult,
  releaseIdempotencyClaim,
  shouldCacheStatus,
  waitForIdempotencyResult,
} from '@/services/idempotency/idempotencyResults';
import { enqueueWebhookEvent } from '@/services/webhooks/deliveryService';
import { auditLog } from '@/lib/api/auditLog';

// One ordered log of every collaborator call, so a test can pin the ORDER the
// gates run in, not just that they ran.
const calls: string[] = [];

// The suite aliases next/server to a stub (vitest.config.ts). These tests pin
// real status codes, bodies and headers, so they load the real classes.
vi.mock('next/server', async () => ({
  NextRequest: (await import('next/dist/server/web/spec-extension/request')).NextRequest,
  NextResponse: (await import('next/dist/server/web/spec-extension/response')).NextResponse,
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/resolveRequestAuth', async () => ({
  ...((await vi.importActual('@/lib/api/resolveRequestAuth')) as object),
  resolveRequestAuth: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

vi.mock('@/lib/rate-limit', async () => ({
  ...((await vi.importActual('@/lib/rate-limit')) as object),
  rateLimitWriteAsync: vi.fn(),
  rateLimitIntegrationKeyWrite: vi.fn(),
}));

vi.mock('@/services/actors/resolveCreationActor', async () => ({
  ...((await vi.importActual('@/services/actors/resolveCreationActor')) as object),
  resolveCreationActor: vi.fn(),
}));

vi.mock('@/services/idempotency/idempotencyResults', async () => {
  const actual = (await vi.importActual('@/services/idempotency/idempotencyResults')) as {
    shouldCacheStatus: (s: number) => boolean;
  };
  return {
    ...actual,
    claimIdempotencyKey: vi.fn(),
    completeIdempotencyResult: vi.fn(),
    releaseIdempotencyClaim: vi.fn(),
    waitForIdempotencyResult: vi.fn(),
    shouldCacheStatus: vi.fn(actual.shouldCacheStatus),
  };
});

vi.mock('@/services/webhooks/deliveryService', () => ({ enqueueWebhookEvent: vi.fn() }));

vi.mock('@/lib/api/auditLog', async () => ({
  ...((await vi.importActual('@/lib/api/auditLog')) as object),
  auditLog: vi.fn(),
}));

const ENTITY = 'product' as const;
const meta = getEntityMetadata(ENTITY);
const USER = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';
const GROUP_ACTOR = '33333333-3333-4333-8333-333333333333';
const BOUND_ACTOR = '44444444-4444-4444-8444-444444444444';
const NEW_ID = '55555555-5555-4555-8555-555555555555';

const schema = z.object({ title: z.string().min(1), price: z.number().optional() });

interface FakeDb {
  _kind: string;
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
  from: Mock;
}

/** A Supabase stand-in that records inserts and answers `.insert().select().single()`. */
function fakeDb(kind: string, result: { data: unknown; error: unknown }): FakeDb {
  const db: FakeDb = {
    _kind: kind,
    inserts: [],
    from: vi.fn((table: string) => ({
      insert: (row: Record<string, unknown>) => {
        calls.push(`insert:${table}`);
        db.inserts.push({ table, row });
        const settled = Promise.resolve({ data: null, error: null });
        return {
          select: () => ({ single: async () => result }),
          then: settled.then.bind(settled),
        };
      },
    })),
  };
  return db;
}

let sessionDb: FakeDb;
let adminDb: FakeDb;

const mockAuth = resolveRequestAuth as Mock;
const RATE_OK = { success: true, resetTime: Date.now() + 60_000, remaining: 9, limit: 10 };

function sessionAuth(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER,
    source: 'session',
    scopes: ['*'],
    isTest: false,
    boundActorId: null,
    integrationKeyId: null,
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/${meta.tableName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'char-test', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function run(
  handler: ReturnType<typeof createEntityPostHandler>,
  request: NextRequest
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const res = await handler(request, {});
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json, headers: res.headers };
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  sessionDb = fakeDb('session', { data: { id: NEW_ID, title: 'Row' }, error: null });
  adminDb = fakeDb('admin', { data: { id: NEW_ID, title: 'Row' }, error: null });
  mockAuth.mockImplementation(async () => {
    calls.push('auth');
    return sessionAuth();
  });
  (createServerClient as Mock).mockImplementation(async () => {
    calls.push('client:session');
    return sessionDb;
  });
  (createAdminClient as Mock).mockImplementation(() => {
    calls.push('client:admin');
    return adminDb;
  });
  (rateLimitWriteAsync as Mock).mockImplementation(async () => {
    calls.push('ratelimit:user');
    return RATE_OK;
  });
  (rateLimitIntegrationKeyWrite as Mock).mockImplementation(async () => {
    calls.push('ratelimit:key');
    return RATE_OK;
  });
  (resolveCreationActor as Mock).mockImplementation(async () => {
    calls.push('actor');
    return { id: ACTOR };
  });
  (claimIdempotencyKey as Mock).mockImplementation(async () => {
    calls.push('idem:claim');
    return { kind: 'won' };
  });
  (completeIdempotencyResult as Mock).mockImplementation(async () => {
    calls.push('idem:complete');
  });
  (releaseIdempotencyClaim as Mock).mockImplementation(async () => {
    calls.push('idem:release');
  });
  (enqueueWebhookEvent as Mock).mockImplementation(async () => {
    calls.push('webhook');
  });
  (auditLog as Mock).mockImplementation(async () => {
    calls.push('audit');
  });
});

describe('createEntityPostHandler — gates, in order', () => {
  it('rejects an invalid body with 422 before authenticating', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json } = await run(handler, post({ title: '' }));
    expect(status).toBe(422);
    expect(json.success).toBe(false);
    expect((json.error as { code: string; message: string }).code).toBe('VALIDATION_ERROR');
    expect((json.error as { message: string }).message).toBe('Invalid request body');
    expect(calls).toEqual([]);
  });

  it('rejects a non-JSON body with 422 before authenticating', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post('{not json'));
    expect(status).toBe(422);
    expect(calls).toEqual([]);
  });

  it('answers 401 when there is no caller, and does nothing else', async () => {
    mockAuth.mockImplementation(async () => {
      calls.push('auth');
      return null;
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(401);
    expect((json.error as { code: string }).code).toBe('UNAUTHORIZED');
    expect(calls).toEqual(['auth']);
  });

  it('answers 403 on a missing write scope before any client, claim or quota is touched', async () => {
    mockAuth.mockImplementation(async () => {
      calls.push('auth');
      return sessionAuth({ source: 'integration_key', scopes: ['project.write'] });
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(403);
    expect((json.error as { message: string }).message).toBe(
      `This key is not allowed to write ${meta.namePlural.toLowerCase()}.`
    );
    expect(calls).toEqual(['auth']);
  });

  it('accepts the exact `<entity>.write` scope', async () => {
    mockAuth.mockImplementation(async () => {
      calls.push('auth');
      return sessionAuth({ scopes: [`${ENTITY}.write`] });
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(201);
  });

  it('runs a full default create in this order: auth, client, quota, actor, insert, audit, webhook', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ id: NEW_ID, title: 'Row' });
    expect(calls).toEqual([
      'auth',
      'client:session',
      'ratelimit:user',
      'actor',
      `insert:${meta.tableName}`,
      'audit',
      'webhook',
    ]);
  });

  it('with an Idempotency-Key, claims before the quota and completes after the webhook', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(201);
    expect(calls).toEqual([
      'auth',
      'client:session',
      'idem:claim',
      'ratelimit:user',
      'actor',
      `insert:${meta.tableName}`,
      'audit',
      'webhook',
      'idem:complete',
    ]);
    const claimArgs = (claimIdempotencyKey as Mock).mock.calls[0][0];
    expect(claimArgs).toMatchObject({
      userId: USER,
      key: 'k1',
      method: 'POST',
      path: `/api/${meta.tableName}`,
    });
    expect(typeof claimArgs.bodyHash).toBe('string');
    expect((completeIdempotencyResult as Mock).mock.calls[0][0]).toMatchObject({
      userId: USER,
      key: 'k1',
      path: `/api/${meta.tableName}`,
      responseStatus: 201,
    });
    expect(
      ((completeIdempotencyResult as Mock).mock.calls[0][0] as { responseBody: { data: unknown } })
        .responseBody.data
    ).toEqual({ id: NEW_ID, title: 'Row' });
  });
});

describe('createEntityPostHandler — which client writes', () => {
  it('uses the session client for session auth', async () => {
    const createEntity = vi.fn(async () => ({ id: NEW_ID }));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema, createEntity });
    await run(handler, post({ title: 'A' }));
    expect((createEntity.mock.calls[0] as unknown[])[2]).toBe(sessionDb);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each(['oauth', 'integration_key'])('uses the admin client for %s auth', async source => {
    mockAuth.mockResolvedValue(sessionAuth({ source }));
    const createEntity = vi.fn(async () => ({ id: NEW_ID }));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema, createEntity });
    await run(handler, post({ title: 'A' }));
    expect((createEntity.mock.calls[0] as unknown[])[2]).toBe(adminDb);
    expect(createServerClient).not.toHaveBeenCalled();
  });
});

describe('createEntityPostHandler — idempotency outcomes', () => {
  it('replays a cached response verbatim with Idempotency-Replay, doing no work', async () => {
    (claimIdempotencyKey as Mock).mockResolvedValue({
      kind: 'replay',
      hit: { responseStatus: 201, responseBody: { success: true, data: { id: 'old' } } },
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json, headers } = await run(
      handler,
      post({ title: 'A' }, { 'idempotency-key': 'k1' })
    );
    expect(status).toBe(201);
    expect(json).toEqual({ success: true, data: { id: 'old' } });
    expect(headers.get('Idempotency-Replay')).toBe('true');
    expect(rateLimitWriteAsync).not.toHaveBeenCalled();
    expect(sessionDb.inserts).toEqual([]);
  });

  it('answers 403 when the key was used with a different body', async () => {
    (claimIdempotencyKey as Mock).mockResolvedValue({ kind: 'body_mismatch' });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(403);
    expect((json.error as { message: string }).message).toBe(
      'Idempotency-Key was reused with a different request body. Generate a new key for each distinct request.'
    );
    expect(rateLimitWriteAsync).not.toHaveBeenCalled();
  });

  it('waits for an in-flight twin and replays its result', async () => {
    (claimIdempotencyKey as Mock).mockResolvedValue({ kind: 'wait' });
    (waitForIdempotencyResult as Mock).mockResolvedValue({
      responseStatus: 201,
      responseBody: { success: true, data: { id: 'twin' } },
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json, headers } = await run(
      handler,
      post({ title: 'A' }, { 'idempotency-key': 'k1' })
    );
    expect(status).toBe(201);
    expect(json).toEqual({ success: true, data: { id: 'twin' } });
    expect(headers.get('Idempotency-Replay')).toBe('true');
    expect(waitForIdempotencyResult).toHaveBeenCalledWith({
      userId: USER,
      key: 'k1',
      path: `/api/${meta.tableName}`,
    });
  });

  it('answers 429 (Retry-After 5) when the in-flight twin never finishes', async () => {
    (claimIdempotencyKey as Mock).mockResolvedValue({ kind: 'wait' });
    (waitForIdempotencyResult as Mock).mockResolvedValue(null);
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json, headers } = await run(
      handler,
      post({ title: 'A' }, { 'idempotency-key': 'k1' })
    );
    expect(status).toBe(429);
    expect((json.error as { message: string }).message).toBe(
      'Another request with this Idempotency-Key is still in flight. Retry shortly.'
    );
    expect(headers.get('Retry-After')).toBe('5');
    expect(rateLimitWriteAsync).not.toHaveBeenCalled();
  });

  it('does not claim without an Idempotency-Key', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    await run(handler, post({ title: 'A' }));
    expect(claimIdempotencyKey).not.toHaveBeenCalled();
    expect(completeIdempotencyResult).not.toHaveBeenCalled();
  });

  it('releases instead of caching when the final response is not cacheable', async () => {
    (shouldCacheStatus as Mock).mockReturnValueOnce(false);
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(201);
    expect(releaseIdempotencyClaim).toHaveBeenCalledWith({
      userId: USER,
      key: 'k1',
      path: `/api/${meta.tableName}`,
    });
    expect(completeIdempotencyResult).not.toHaveBeenCalled();
  });

  it('a failing cache write is non-fatal', async () => {
    (completeIdempotencyResult as Mock).mockRejectedValue(new Error('cache down'));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(201);
    expect(releaseIdempotencyClaim).not.toHaveBeenCalled();
  });

  // Pinned as-is: these early returns happen AFTER winning the claim, and they
  // neither complete nor release it. Changing that is a behaviour change.
  it('a rate-limited request after winning the claim leaves the claim untouched', async () => {
    (rateLimitWriteAsync as Mock).mockResolvedValue({
      success: false,
      resetTime: Date.now() + 30_000,
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(429);
    expect((json.error as { message: string }).message).toBe(
      `Too many ${meta.name.toLowerCase()} creation requests. Please slow down.`
    );
    expect(releaseIdempotencyClaim).not.toHaveBeenCalled();
    expect(completeIdempotencyResult).not.toHaveBeenCalled();
  });

  it('a forbidden actor after winning the claim leaves the claim untouched', async () => {
    (resolveCreationActor as Mock).mockRejectedValue(new ActorNotPermittedError('nope'));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(403);
    expect(releaseIdempotencyClaim).not.toHaveBeenCalled();
    expect(completeIdempotencyResult).not.toHaveBeenCalled();
  });

  it('an insert error after winning the claim leaves the claim untouched', async () => {
    sessionDb = fakeDb('session', { data: null, error: { code: '23505', message: 'dup' } });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(500);
    expect(releaseIdempotencyClaim).not.toHaveBeenCalled();
    expect(completeIdempotencyResult).not.toHaveBeenCalled();
  });

  it('a transform error after winning the claim leaves the claim untouched', async () => {
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      transformData: () => {
        throw new Error('bad');
      },
    });
    const { status } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(500);
    expect(releaseIdempotencyClaim).not.toHaveBeenCalled();
  });

  it('a thrown error after winning the claim releases it and goes through handleApiError', async () => {
    const createEntity = vi.fn(async () => {
      throw new Error('boom');
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema, createEntity });
    const { status, json } = await run(handler, post({ title: 'A' }, { 'idempotency-key': 'k1' }));
    expect(status).toBe(500);
    expect(json.success).toBe(false);
    expect(releaseIdempotencyClaim).toHaveBeenCalledWith({
      userId: USER,
      key: 'k1',
      path: `/api/${meta.tableName}`,
    });
  });

  it('a thrown error without a claim does not release anything', async () => {
    const createEntity = vi.fn(async () => {
      throw new Error('boom');
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema, createEntity });
    const { status } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(500);
    expect(releaseIdempotencyClaim).not.toHaveBeenCalled();
  });
});

describe('createEntityPostHandler — rate limiting', () => {
  it('uses the per-key bucket for an integration key with an id', async () => {
    mockAuth.mockResolvedValue(
      sessionAuth({
        source: 'integration_key',
        integrationKeyId: 'ik_1',
        boundActorId: BOUND_ACTOR,
      })
    );
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    await run(handler, post({ title: 'A' }));
    expect(rateLimitIntegrationKeyWrite).toHaveBeenCalledWith('ik_1');
    expect(rateLimitWriteAsync).not.toHaveBeenCalled();
  });

  it('uses the per-user bucket for an integration key WITHOUT an id', async () => {
    mockAuth.mockResolvedValue(sessionAuth({ source: 'integration_key', integrationKeyId: null }));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    await run(handler, post({ title: 'A' }));
    expect(rateLimitWriteAsync).toHaveBeenCalledWith(USER);
    expect(rateLimitIntegrationKeyWrite).not.toHaveBeenCalled();
  });

  it('answers 429 with a ceil()ed Retry-After and does not resolve an actor', async () => {
    (rateLimitWriteAsync as Mock).mockResolvedValue({
      success: false,
      resetTime: Date.now() + 1500,
    });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, headers } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(429);
    expect(Number(headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
    expect(Number(headers.get('Retry-After'))).toBeLessThanOrEqual(2);
    expect(resolveCreationActor).not.toHaveBeenCalled();
  });

  it('puts rate-limit headers on the success response', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { headers } = await run(handler, post({ title: 'A' }));
    expect(headers.get('X-RateLimit-Limit')).toBe('10');
    expect(headers.get('X-RateLimit-Remaining')).toBe('9');
  });
});

describe('createEntityPostHandler — acting actor', () => {
  it('passes a requested actor_id to resolveCreationActor and strips it from the row', async () => {
    (resolveCreationActor as Mock).mockResolvedValue({ id: GROUP_ACTOR });
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      useActorOwnership: true,
    });
    await run(handler, post({ title: 'A', actor_id: GROUP_ACTOR }));
    expect(resolveCreationActor).toHaveBeenCalledWith(USER, GROUP_ACTOR);
    expect(sessionDb.inserts[0].row).toEqual({ title: 'A', actor_id: GROUP_ACTOR });
  });

  it('rejects a malformed actor_id at validation (422)', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post({ title: 'A', actor_id: 'not-a-guid' }));
    expect(status).toBe(422);
    expect(calls).toEqual([]);
  });

  it('a bound integration key ignores body actor_id and never calls resolveCreationActor', async () => {
    mockAuth.mockResolvedValue(
      sessionAuth({
        source: 'integration_key',
        integrationKeyId: 'ik_1',
        boundActorId: BOUND_ACTOR,
      })
    );
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      useActorOwnership: true,
    });
    await run(handler, post({ title: 'A', actor_id: GROUP_ACTOR }));
    expect(resolveCreationActor).not.toHaveBeenCalled();
    expect(adminDb.inserts[0].row).toEqual({ title: 'A', actor_id: BOUND_ACTOR });
  });

  it('a non-permitted actor is 403 with the entity name', async () => {
    (resolveCreationActor as Mock).mockRejectedValue(new ActorNotPermittedError('nope'));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json } = await run(handler, post({ title: 'A', actor_id: GROUP_ACTOR }));
    expect(status).toBe(403);
    expect((json.error as { message: string }).message).toBe(
      `You are not permitted to create a ${meta.name.toLowerCase()} as the requested actor.`
    );
  });

  it('any other actor error falls through to handleApiError (500)', async () => {
    (resolveCreationActor as Mock).mockRejectedValue(new Error('db down'));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(500);
  });
});

describe('createEntityPostHandler — createEntity path', () => {
  it('passes the body with the resolved actor and test flag on side channels', async () => {
    mockAuth.mockResolvedValue(sessionAuth({ isTest: true }));
    const createEntity = vi.fn(async () => ({ id: NEW_ID, title: 'Made' }));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema, createEntity });
    const { status, json } = await run(handler, post({ title: 'A', actor_id: GROUP_ACTOR }));
    expect(status).toBe(201);
    expect(json.data).toEqual({ id: NEW_ID, title: 'Made' });
    expect(createEntity).toHaveBeenCalledWith(
      USER,
      { title: 'A', _resolved_actor_id: ACTOR, _resolved_is_test: true },
      sessionDb
    );
    expect(sessionDb.inserts).toEqual([]);
  });

  it('audits and enqueues the webhook with the created entity', async () => {
    const createEntity = vi.fn(async () => ({ id: NEW_ID, title: 'Made' }));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema, createEntity });
    await run(handler, post({ title: 'A' }));
    expect((auditLog as Mock).mock.calls[0][0]).toMatchObject({
      action: 'ENTITY_CREATED',
      userId: USER,
      entityType: ENTITY,
      entityId: NEW_ID,
      metadata: { actorId: ACTOR, source: 'session' },
      userAgent: 'char-test',
    });
    expect(enqueueWebhookEvent).toHaveBeenCalledWith({
      actorId: ACTOR,
      eventType: `${ENTITY}.created`,
      payload: { id: NEW_ID, title: 'Made' },
    });
  });
});

describe('createEntityPostHandler — default insert path', () => {
  it('without useActorOwnership, writes user_id (the default)', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    await run(handler, post({ title: 'A', price: 3 }));
    expect(sessionDb.inserts).toEqual([
      { table: meta.tableName, row: { title: 'A', price: 3, user_id: USER } },
    ]);
  });

  it('with useActorOwnership, writes actor_id', async () => {
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      useActorOwnership: true,
    });
    await run(handler, post({ title: 'A' }));
    expect(sessionDb.inserts[0].row).toEqual({ title: 'A', actor_id: ACTOR });
  });

  it('transformData output is used as-is when actor ownership is off', async () => {
    const transformData = vi.fn(async (d: Record<string, unknown>, uid: string) => ({
      ...d,
      owner: uid,
    }));
    const handler = createEntityPostHandler({ entityType: ENTITY, schema, transformData });
    await run(handler, post({ title: 'A' }));
    expect(transformData).toHaveBeenCalledWith({ title: 'A' }, USER, sessionDb);
    expect(sessionDb.inserts[0].row).toEqual({ title: 'A', owner: USER });
  });

  it('transformData output gets the resolved actor_id stamped when actor ownership is on', async () => {
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      useActorOwnership: true,
      transformData: d => ({ ...d, actor_id: 'from-transform' }),
    });
    await run(handler, post({ title: 'A' }));
    expect(sessionDb.inserts[0].row).toEqual({ title: 'A', actor_id: ACTOR });
  });

  it('defaultFields override the transformed data; is_test is stamped last and only when true', async () => {
    mockAuth.mockResolvedValue(sessionAuth({ isTest: true }));
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      transformData: d => ({ ...d, status: 'active', is_test: false }),
      defaultFields: { status: 'draft', views: 0 },
    });
    await run(handler, post({ title: 'A' }));
    expect(sessionDb.inserts[0].row).toEqual({
      title: 'A',
      status: 'draft',
      views: 0,
      is_test: true,
    });
  });

  it('does not add is_test for a non-test caller', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    await run(handler, post({ title: 'A' }));
    expect('is_test' in sessionDb.inserts[0].row).toBe(false);
  });

  it('honours a tableName override', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema, tableName: 'other_t' });
    await run(handler, post({ title: 'A' }));
    expect(sessionDb.inserts[0].table).toBe('other_t');
  });

  it('a transform that throws is 500 with its message and nothing is inserted', async () => {
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      transformData: () => {
        throw new Error('price must be positive');
      },
    });
    const { status, json } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(500);
    expect((json.error as { message: string }).message).toBe(
      `Failed to process ${meta.name.toLowerCase()}: price must be positive`
    );
    expect(sessionDb.inserts).toEqual([]);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('a non-Error thrown by the transform is stringified into the message', async () => {
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      transformData: () => {
        throw 'plain';
      },
    });
    const { json } = await run(handler, post({ title: 'A' }));
    expect((json.error as { message: string }).message).toBe(
      `Failed to process ${meta.name.toLowerCase()}: plain`
    );
  });

  it('an insert error is a generic 500 with no audit and no webhook', async () => {
    sessionDb = fakeDb('session', { data: null, error: { code: '42501', message: 'rls' } });
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    const { status, json } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(500);
    expect((json.error as { message: string }).message).toBe(
      `Failed to create ${meta.name.toLowerCase()}`
    );
    expect(auditLog).not.toHaveBeenCalled();
    expect(enqueueWebhookEvent).not.toHaveBeenCalled();
  });

  it('_wallet_id is not inserted as a column; it links the wallet after the insert', async () => {
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      transformData: d => ({ ...d, _wallet_id: 'w1' }),
    });
    const { status } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(201);
    expect(sessionDb.inserts).toEqual([
      { table: meta.tableName, row: { title: 'A' } },
      {
        table: 'entity_wallets',
        row: {
          wallet_id: 'w1',
          entity_type: ENTITY,
          entity_id: NEW_ID,
          is_primary: true,
          created_by: USER,
        },
      },
    ]);
    expect(calls).toEqual([
      'auth',
      'client:session',
      'ratelimit:user',
      'actor',
      `insert:${meta.tableName}`,
      'audit',
      'insert:entity_wallets',
      'webhook',
    ]);
  });

  it('a failing wallet link is non-fatal', async () => {
    const db = fakeDb('session', { data: { id: NEW_ID }, error: null });
    const realFrom = db.from.getMockImplementation()!;
    db.from.mockImplementation((table: string) => {
      if (table === 'entity_wallets') {
        return {
          insert: () => {
            throw new Error('link failed');
          },
        };
      }
      return realFrom(table);
    });
    sessionDb = db;
    const handler = createEntityPostHandler({
      entityType: ENTITY,
      schema,
      transformData: d => ({ ...d, _wallet_id: 'w1' }),
    });
    const { status } = await run(handler, post({ title: 'A' }));
    expect(status).toBe(201);
    expect(enqueueWebhookEvent).toHaveBeenCalled();
  });

  it('the webhook carries the inserted row', async () => {
    const handler = createEntityPostHandler({ entityType: ENTITY, schema });
    await run(handler, post({ title: 'A' }));
    expect(enqueueWebhookEvent).toHaveBeenCalledWith({
      actorId: ACTOR,
      eventType: `${ENTITY}.created`,
      payload: { id: NEW_ID, title: 'Row' },
    });
  });
});
