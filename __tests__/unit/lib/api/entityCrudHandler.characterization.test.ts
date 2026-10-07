/**
 * createEntityCrudHandlers — characterization tests.
 *
 * Pin what GET / PUT / DELETE do today, path by path: status codes, response
 * bodies, the filters each query applies, the order gates run in, and which
 * hooks and side effects fire on which path. They exist so the handlers can be
 * restructured without changing behaviour; a test here that has to change
 * means behaviour changed.
 *
 * Collaborators are mocked at module boundaries; the response helpers,
 * validateUUID, Zod and createRateLimitResponse are real.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { Mock } from 'vitest';

import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import { getEntityMetadata } from '@/config/entity-registry';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { rateLimit, rateLimitWriteAsync } from '@/lib/rate-limit';
import { checkOwnership } from '@/services/actors';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';

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
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/lib/rate-limit', async () => ({
  ...((await vi.importActual('@/lib/rate-limit')) as object),
  rateLimit: vi.fn(),
  rateLimitWriteAsync: vi.fn(),
}));
vi.mock('@/services/actors', () => ({ checkOwnership: vi.fn() }));
vi.mock('@/services/actors/getOrCreateUserActor', () => ({ getOrCreateUserActor: vi.fn() }));

const ENTITY = 'product' as const;
const meta = getEntityMetadata(ENTITY);
const ID = '66666666-6666-4666-8666-666666666666';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '77777777-7777-4777-8777-777777777777';
const ACTOR = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-06T12:00:00.000Z');

type Op = [string, ...unknown[]];
interface Recorded {
  client: string;
  table: string;
  ops: Op[];
}
type Result = { data?: unknown; error?: unknown };
type Responder = (q: Recorded) => Result;

/**
 * A Supabase stand-in. Every query is recorded as its table plus the chain of
 * calls on it; `respond` decides what the terminal call resolves to.
 */
function fakeClient(name: string, respond: Responder, user: unknown, authError: unknown = null) {
  const queries: Recorded[] = [];
  const client = {
    queries,
    auth: {
      getUser: vi.fn(async () => {
        calls.push(`${name}:getUser`);
        return { data: { user }, error: authError };
      }),
    },
    from: vi.fn((table: string) => {
      const rec: Recorded = { client: name, table, ops: [] };
      queries.push(rec);
      const settle = () => {
        calls.push(`${name}:${table}:${rec.ops.map(o => o[0]).join('.')}`);
        return Promise.resolve({ data: null, error: null, ...respond(rec) });
      };
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'update', 'delete']) {
        b[m] = (...args: unknown[]) => {
          rec.ops.push([m, ...args]);
          return b;
        };
      }
      b.single = () => {
        rec.ops.push(['single']);
        return settle();
      };
      b.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
        settle().then(ok, bad);
      return b;
    }),
  };
  return client;
}

let respond: Responder;
let user: unknown;
let authError: unknown;
let session: ReturnType<typeof fakeClient>;
let admin: ReturnType<typeof fakeClient>;
let adminRespond: Responder;

const RATE_OK = { success: true, resetTime: NOW.getTime() + 60_000, remaining: 9, limit: 10 };

function req(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/products/${ID}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function call(
  fn: (
    r: NextRequest,
    c: { params: Promise<{ id: string }> | { id: string } }
  ) => Promise<Response>,
  request: NextRequest,
  id: string | undefined = ID,
  promised = true
) {
  const params = promised ? Promise.resolve({ id: id as string }) : { id: id as string };
  const res = await fn(request, { params });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json, headers: res.headers };
}

const err = (json: Record<string, unknown>) => json.error as { code: string; message: string };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  calls.length = 0;
  user = { id: USER };
  authError = null;
  respond = () => ({ data: { id: ID, status: 'active', user_id: USER, title: 'T' } });
  adminRespond = () => ({});
  (createServerClient as Mock).mockImplementation(async () => {
    calls.push('client');
    session = fakeClient('session', q => respond(q), user, authError);
    return session;
  });
  (getAdminClient as Mock).mockImplementation(() => {
    admin = fakeClient('admin', q => adminRespond(q), null);
    return admin;
  });
  (rateLimit as Mock).mockImplementation(async () => {
    calls.push('ratelimit:read');
    return RATE_OK;
  });
  (rateLimitWriteAsync as Mock).mockImplementation(async () => {
    calls.push('ratelimit:write');
    return RATE_OK;
  });
  (checkOwnership as Mock).mockImplementation(async () => {
    calls.push('checkOwnership');
    return true;
  });
  (getOrCreateUserActor as Mock).mockImplementation(async () => {
    calls.push('actor');
    return { id: ACTOR };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const schema = z.object({ title: z.string().min(1) });
const buildUpdatePayload = (d: Record<string, unknown>) => ({ title: d.title });
/** Every handler set needs these: the factory builds PUT eagerly, even for a GET-only route. */
const BASE = { entityType: ENTITY, schema, buildUpdatePayload };

// ==================== GET ====================

describe('GET', () => {
  const { GET } = createEntityCrudHandlers(BASE);

  it('400 for a malformed id, before rate limiting', async () => {
    const { status, json } = await call(GET, req('GET'), 'nope');
    expect(status).toBe(400);
    expect(err(json).message).toBe(`Invalid ${meta.name} ID format`);
    expect(calls).toEqual([]);
  });

  it('400 for a missing id', async () => {
    const { status, json } = await call(GET, req('GET'), '');
    expect(status).toBe(400);
    expect(err(json).message).toBe(`${meta.name} ID is required`);
  });

  it('accepts a plain (non-promise) params object', async () => {
    const { status } = await call(GET, req('GET'), ID, false);
    expect(status).toBe(200);
  });

  it('429 from createRateLimitResponse when the read limit is hit', async () => {
    (rateLimit as Mock).mockResolvedValueOnce({
      success: false,
      resetTime: NOW.getTime() + 30_000,
      remaining: 0,
      limit: 10,
    });
    const { status, json } = await call(GET, req('GET'));
    expect(status).toBe(429);
    expect(json.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('anonymous: filters to active rows and returns 200 with rate-limit headers', async () => {
    user = null;
    const { status, json, headers } = await call(GET, req('GET'));
    expect(status).toBe(200);
    expect(json.data).toEqual({ id: ID, status: 'active', user_id: USER, title: 'T' });
    expect(session.queries[0]).toEqual({
      client: 'session',
      table: meta.tableName,
      ops: [['select', '*'], ['eq', 'id', ID], ['eq', 'status', 'active'], ['single']],
    });
    expect(headers.get('X-RateLimit-Limit')).toBe('10');
    expect(calls).toEqual([
      'ratelimit:read',
      'client',
      'session:getUser',
      `session:${meta.tableName}:select.eq.eq.single`,
    ]);
  });

  it('signed in: no status filter', async () => {
    await call(GET, req('GET'));
    expect(session.queries[0].ops).toEqual([['select', '*'], ['eq', 'id', ID], ['single']]);
  });

  it('requireActiveStatus=false: no status filter for anonymous either', async () => {
    user = null;
    const { GET: get } = createEntityCrudHandlers({ ...BASE, requireActiveStatus: false });
    await call(get, req('GET'));
    expect(session.queries[0].ops).toEqual([['select', '*'], ['eq', 'id', ID], ['single']]);
  });

  it('requireAuthForGet: 401 when anonymous', async () => {
    user = null;
    const { GET: get } = createEntityCrudHandlers({ ...BASE, requireAuthForGet: true });
    const { status } = await call(get, req('GET'));
    expect(status).toBe(401);
    expect(session.queries).toEqual([]);
  });

  it('requireAuthForGet: filters by the ownership field', async () => {
    const { GET: get } = createEntityCrudHandlers({ ...BASE, requireAuthForGet: true });
    await call(get, req('GET'));
    expect(session.queries[0].ops).toEqual([
      ['select', '*'],
      ['eq', 'id', ID],
      ['eq', 'user_id', USER],
      ['single'],
    ]);
  });

  it('requireAuthForGet + actor ownership: filters by the caller actor id', async () => {
    respond = () => ({ data: { id: ID, status: 'active', actor_id: ACTOR } });
    const { GET: get } = createEntityCrudHandlers({
      ...BASE,
      requireAuthForGet: true,
      useActorOwnership: true,
      ownershipField: 'actor_id',
    });
    await call(get, req('GET'));
    expect(getOrCreateUserActor).toHaveBeenCalledWith(USER);
    expect(session.queries[0].ops).toEqual([
      ['select', '*'],
      ['eq', 'id', ID],
      ['eq', 'actor_id', ACTOR],
      ['single'],
    ]);
  });

  it('PGRST116 is a named 404', async () => {
    respond = () => ({ data: null, error: { code: 'PGRST116', message: 'none' } });
    const { status, json } = await call(GET, req('GET'));
    expect(status).toBe(404);
    expect(err(json).message).toBe(`${meta.name} not found`);
  });

  it('other query errors go through handleSupabaseError', async () => {
    respond = () => ({ data: null, error: { code: '42501', message: 'rls' } });
    const { status, json } = await call(GET, req('GET'));
    expect(status).toBe(403);
    expect(err(json).message).toBe('Access denied');
  });

  describe('a non-active row', () => {
    beforeEach(() => {
      respond = () => ({ data: { id: ID, status: 'draft', user_id: USER, actor_id: ACTOR } });
    });

    it('is 404 for an anonymous reader', async () => {
      user = null;
      const { status } = await call(GET, req('GET'));
      expect(status).toBe(404);
    });

    it('is readable by its owner (ownership field)', async () => {
      const { status } = await call(GET, req('GET'));
      expect(status).toBe(200);
    });

    it('is 404 for someone else', async () => {
      user = { id: OTHER };
      const { status, json } = await call(GET, req('GET'));
      expect(status).toBe(404);
      expect(err(json).message).toBe(`${meta.name} not found`);
    });

    it('with actor ownership, asks checkOwnership with the session client', async () => {
      const { GET: get } = createEntityCrudHandlers({
        ...BASE,
        useActorOwnership: true,
        ownershipField: 'actor_id',
      });
      (checkOwnership as Mock).mockResolvedValueOnce(false);
      const { status } = await call(get, req('GET'));
      expect(status).toBe(404);
      expect(checkOwnership).toHaveBeenCalledWith(
        { id: ID, status: 'draft', user_id: USER, actor_id: ACTOR },
        USER,
        session
      );
    });

    it('with actor ownership and an owning actor, is 200', async () => {
      const { GET: get } = createEntityCrudHandlers({
        ...BASE,
        useActorOwnership: true,
        ownershipField: 'actor_id',
      });
      const { status } = await call(get, req('GET'));
      expect(status).toBe(200);
    });
  });

  it('checkGetAccess can refuse with its own response', async () => {
    const checkGetAccess = vi.fn(async () => new Response('{"x":1}', { status: 451 }));
    const { GET: get } = createEntityCrudHandlers({
      ...BASE,
      checkGetAccess: checkGetAccess as never,
    });
    const { status, json } = await call(get, req('GET'));
    expect(status).toBe(451);
    expect(json).toEqual({ x: 1 });
    expect(checkGetAccess).toHaveBeenCalledWith(
      { id: ID, status: 'active', user_id: USER, title: 'T' },
      USER,
      session
    );
  });

  it('postProcessGet replaces the body and getCacheControl sets the header', async () => {
    const { GET: get } = createEntityCrudHandlers({
      ...BASE,
      postProcessGet: async e => ({ ...e, extra: true }),
      getCacheControl: (e, uid) => `private, max-age=${uid ? 1 : 2}, x=${String(e.extra)}`,
    });
    const { json, headers } = await call(get, req('GET'));
    expect(json.data).toEqual({ id: ID, status: 'active', user_id: USER, title: 'T', extra: true });
    expect(headers.get('Cache-Control')).toBe('private, max-age=1, x=true');
  });

  it('a thrown error is handleApiError', async () => {
    (createServerClient as Mock).mockRejectedValueOnce(new Error('boom'));
    const { status, json } = await call(GET, req('GET'));
    expect(status).toBe(500);
    expect(err(json).message).toBe('An unexpected error occurred');
  });
});

// ==================== PUT ====================

describe('PUT', () => {
  const { PUT } = createEntityCrudHandlers({ ...BASE, schema, buildUpdatePayload });

  it('refuses to build without a schema or without buildUpdatePayload', () => {
    expect(() => createEntityCrudHandlers({ entityType: ENTITY, buildUpdatePayload })).toThrow(
      `PUT handler for ${ENTITY} requires a schema`
    );
    expect(() => createEntityCrudHandlers({ entityType: ENTITY, schema })).toThrow(
      `PUT handler for ${ENTITY} requires buildUpdatePayload`
    );
  });

  it('400 for a malformed id', async () => {
    const { status } = await call(PUT, req('PUT', { title: 'N' }), 'nope');
    expect(status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('401 without a user, and 401 on an auth error', async () => {
    user = null;
    expect((await call(PUT, req('PUT', { title: 'N' }))).status).toBe(401);
    user = { id: USER };
    authError = { message: 'jwt expired' };
    expect((await call(PUT, req('PUT', { title: 'N' }))).status).toBe(401);
  });

  it('404 when the row cannot be read', async () => {
    respond = () => ({ data: null, error: { code: 'PGRST116' } });
    const { status, json } = await call(PUT, req('PUT', { title: 'N' }));
    expect(status).toBe(404);
    expect(err(json).message).toBe(`${meta.name} not found`);
  });

  it('403 for a non-owner, before the write quota', async () => {
    user = { id: OTHER };
    const { status, json } = await call(PUT, req('PUT', { title: 'N' }));
    expect(status).toBe(403);
    expect(err(json).message).toBe(`You can only update your own ${meta.namePlural.toLowerCase()}`);
    expect(rateLimitWriteAsync).not.toHaveBeenCalled();
  });

  it('a custom ownershipField is compared', async () => {
    respond = () => ({ data: { id: ID, owner_id: OTHER } });
    const { PUT: put } = createEntityCrudHandlers({
      ...BASE,
      schema,
      buildUpdatePayload,
      ownershipField: 'owner_id',
    });
    expect((await call(put, req('PUT', { title: 'N' }))).status).toBe(403);
  });

  it('actor ownership asks checkOwnership when the row has an actor_id', async () => {
    respond = q =>
      q.ops.some(o => o[0] === 'update')
        ? { data: { id: ID, title: 'N' } }
        : { data: { id: ID, actor_id: ACTOR, user_id: OTHER } };
    const { PUT: put } = createEntityCrudHandlers({
      ...BASE,
      schema,
      buildUpdatePayload,
      useActorOwnership: true,
    });
    (checkOwnership as Mock).mockResolvedValueOnce(false);
    const { status } = await call(put, req('PUT', { title: 'N' }));
    expect(status).toBe(403);
    expect(checkOwnership).toHaveBeenCalledWith(
      { id: ID, actor_id: ACTOR, user_id: OTHER },
      USER,
      session
    );
    // and an owning actor passes
    const ok = await call(put, req('PUT', { title: 'N' }));
    expect(ok.status).toBe(200);
  });

  it('actor ownership falls back to the ownership field when the row has no actor_id', async () => {
    respond = () => ({ data: { id: ID, actor_id: null, user_id: OTHER } });
    const { PUT: put } = createEntityCrudHandlers({
      ...BASE,
      schema,
      buildUpdatePayload,
      useActorOwnership: true,
    });
    expect((await call(put, req('PUT', { title: 'N' }))).status).toBe(403);
    expect(checkOwnership).not.toHaveBeenCalled();
  });

  it('checkPutAccess replaces the default ownership check', async () => {
    user = { id: OTHER };
    const checkPutAccess = vi.fn(async () => null);
    respond = q =>
      q.ops.some(o => o[0] === 'update')
        ? { data: { id: ID, title: 'N' } }
        : { data: { id: ID, user_id: USER } };
    const { PUT: put } = createEntityCrudHandlers({
      ...BASE,
      schema,
      buildUpdatePayload,
      checkPutAccess,
    });
    const { status } = await call(put, req('PUT', { title: 'N' }));
    expect(status).toBe(200);
    expect(checkPutAccess).toHaveBeenCalledWith({ id: ID, user_id: USER }, OTHER, session);
  });

  it('429 when the write quota is hit, before the body is read', async () => {
    (rateLimitWriteAsync as Mock).mockResolvedValueOnce({
      success: false,
      resetTime: NOW.getTime() + 2_500,
    });
    const { status, json, headers } = await call(PUT, req('PUT', '{not json'));
    expect(status).toBe(429);
    expect(err(json).message).toBe('Too many update requests. Please slow down.');
    expect(headers.get('Retry-After')).toBe('3');
  });

  it('422 with the Zod issues for an invalid body', async () => {
    const { status, json } = await call(PUT, req('PUT', { title: '' }));
    expect(status).toBe(422);
    expect(err(json).message).toBe(`Invalid ${meta.name.toLowerCase()} data`);
    expect((json.error as { details: { details: unknown[] } }).details.details).toHaveLength(1);
  });

  it('a non-JSON body goes through handleApiError', async () => {
    const { status } = await call(PUT, req('PUT', '{not json'));
    expect(status).toBe(500);
  });

  it('updates with buildUpdatePayload + updated_at, in this order, and returns the row', async () => {
    respond = q =>
      q.ops.some(o => o[0] === 'update')
        ? { data: { id: ID, title: 'N' } }
        : { data: { id: ID, user_id: USER } };
    const postProcessPut = vi.fn(async () => {
      calls.push('postProcessPut');
    });
    const { PUT: put } = createEntityCrudHandlers({
      ...BASE,
      schema,
      buildUpdatePayload,
      postProcessPut,
    });
    const { status, json, headers } = await call(put, req('PUT', { title: 'N', junk: 1 }));
    expect(status).toBe(200);
    expect(json.data).toEqual({ id: ID, title: 'N' });
    expect(session.queries[1]).toEqual({
      client: 'session',
      table: meta.tableName,
      ops: [
        ['update', { title: 'N', updated_at: NOW.toISOString() }],
        ['eq', 'id', ID],
        ['select', '*'],
        ['single'],
      ],
    });
    expect(postProcessPut).toHaveBeenCalledWith({ id: ID, title: 'N' }, USER, session);
    expect(headers.get('X-RateLimit-Remaining')).toBe('9');
    expect(calls).toEqual([
      'client',
      'session:getUser',
      `session:${meta.tableName}:select.eq.single`,
      'ratelimit:write',
      `session:${meta.tableName}:update.eq.select.single`,
      'postProcessPut',
    ]);
  });

  it('an update error goes through handleSupabaseError and skips postProcessPut', async () => {
    respond = q =>
      q.ops.some(o => o[0] === 'update')
        ? { data: null, error: { code: '23505', message: 'dup' } }
        : { data: { id: ID, user_id: USER } };
    const postProcessPut = vi.fn();
    const { PUT: put } = createEntityCrudHandlers({
      ...BASE,
      schema,
      buildUpdatePayload,
      postProcessPut,
    });
    const { status, json } = await call(put, req('PUT', { title: 'N' }));
    expect(status).toBe(409);
    expect(err(json).message).toBe('Resource already exists');
    expect(postProcessPut).not.toHaveBeenCalled();
  });
});

// ==================== DELETE ====================

describe('DELETE', () => {
  const { DELETE } = createEntityCrudHandlers(BASE);

  it('400 for a malformed id', async () => {
    expect((await call(DELETE, req('DELETE'), 'nope')).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('401 without a user', async () => {
    user = null;
    expect((await call(DELETE, req('DELETE'))).status).toBe(401);
  });

  it('404 when the row cannot be read', async () => {
    respond = () => ({ data: null, error: null });
    const { status, json } = await call(DELETE, req('DELETE'));
    expect(status).toBe(404);
    expect(err(json).message).toBe(`${meta.name} not found`);
  });

  it('403 for a non-owner, with nothing deleted', async () => {
    user = { id: OTHER };
    const { status, json } = await call(DELETE, req('DELETE'));
    expect(status).toBe(403);
    expect(err(json).message).toBe(`You can only delete your own ${meta.namePlural.toLowerCase()}`);
    expect(session.queries).toHaveLength(1);
    expect(getAdminClient).not.toHaveBeenCalled();
  });

  it('deletes, cleans wallet links with the admin client, then runs the hooks in order', async () => {
    const existing = { id: ID, status: 'active', user_id: USER, title: 'T' };
    const preDelete = vi.fn(async () => {
      calls.push('preDelete');
    });
    const postProcessDelete = vi.fn(async () => {
      calls.push('postProcessDelete');
    });
    const { DELETE: del } = createEntityCrudHandlers({
      ...BASE,
      preDelete,
      postProcessDelete,
    });
    const { status, json } = await call(del, req('DELETE'));
    expect(status).toBe(200);
    expect(json.data).toEqual({ message: `${meta.name} deleted successfully` });
    expect(session.queries[1].ops).toEqual([['delete'], ['eq', 'id', ID]]);
    expect(admin.queries[0]).toEqual({
      client: 'admin',
      table: 'entity_wallets',
      ops: [['delete'], ['eq', 'entity_type', ENTITY], ['eq', 'entity_id', ID]],
    });
    expect(preDelete).toHaveBeenCalledWith(existing, USER, session);
    expect(postProcessDelete).toHaveBeenCalledWith(existing, USER, session);
    expect(calls).toEqual([
      'client',
      'session:getUser',
      `session:${meta.tableName}:select.eq.single`,
      'preDelete',
      `session:${meta.tableName}:delete.eq`,
      'admin:entity_wallets:delete.eq.eq',
      'postProcessDelete',
    ]);
  });

  it('a delete error goes through handleSupabaseError; no link cleanup, no postProcessDelete', async () => {
    respond = q =>
      q.ops.some(o => o[0] === 'delete')
        ? { error: { code: '23503', message: 'fk' } }
        : { data: { id: ID, user_id: USER } };
    const postProcessDelete = vi.fn();
    const { DELETE: del } = createEntityCrudHandlers({ ...BASE, postProcessDelete });
    const { status, json } = await call(del, req('DELETE'));
    expect(status).toBe(400);
    expect(err(json).message).toBe('Invalid reference');
    expect(getAdminClient).not.toHaveBeenCalled();
    expect(postProcessDelete).not.toHaveBeenCalled();
  });

  it('a failed wallet-link cleanup is non-fatal', async () => {
    adminRespond = () => ({ error: { message: 'nope' } });
    const postProcessDelete = vi.fn();
    const { DELETE: del } = createEntityCrudHandlers({ ...BASE, postProcessDelete });
    const { status } = await call(del, req('DELETE'));
    expect(status).toBe(200);
    expect(postProcessDelete).toHaveBeenCalled();
  });

  it('checkDeleteAccess replaces the default ownership check and can refuse', async () => {
    const checkDeleteAccess = vi.fn(async () => new Response('{"no":1}', { status: 418 }));
    const { DELETE: del } = createEntityCrudHandlers({
      ...BASE,
      checkDeleteAccess: checkDeleteAccess as never,
    });
    const { status, json } = await call(del, req('DELETE'));
    expect(status).toBe(418);
    expect(json).toEqual({ no: 1 });
    expect(session.queries).toHaveLength(1);
  });

  it('actor ownership uses checkOwnership with the session client', async () => {
    respond = q =>
      q.ops.some(o => o[0] === 'delete') ? {} : { data: { id: ID, actor_id: ACTOR } };
    const { DELETE: del } = createEntityCrudHandlers({ ...BASE, useActorOwnership: true });
    (checkOwnership as Mock).mockResolvedValueOnce(false);
    const { status, json } = await call(del, req('DELETE'));
    expect(status).toBe(403);
    expect(err(json).message).toBe(`You can only delete your own ${meta.namePlural.toLowerCase()}`);
    expect(checkOwnership).toHaveBeenCalledWith({ id: ID, actor_id: ACTOR }, USER, session);
  });

  it('a thrown preDelete is handleApiError and nothing is deleted', async () => {
    const preDelete = vi.fn(async () => {
      throw Object.assign(new Error('teapot'), { status: 418 });
    });
    const { DELETE: del } = createEntityCrudHandlers({ ...BASE, preDelete });
    const { status, json } = await call(del, req('DELETE'));
    expect(status).toBe(418);
    expect(err(json).message).toBe('teapot');
    expect(session.queries).toHaveLength(1);
  });
});
