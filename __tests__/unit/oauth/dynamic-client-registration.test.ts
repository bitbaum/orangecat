/**
 * POST /oauth/register — Dynamic Client Registration (RFC 7591).
 *
 * Anyone on the internet can call this, and whatever it stores is shown on a
 * consent screen. So the tests are mostly about what is REFUSED: redirects an
 * attacker could use to catch a code, confidential-client claims, names built
 * to impersonate — and about the one thing that must always be true of what is
 * stored: never trusted, never confidential, marked self-registered.
 */
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
const insert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: () => ({ insert }) })),
}));
vi.mock('@/lib/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit');
  return { ...actual, rateLimitOAuthRegistration: vi.fn() };
});

import { POST } from '@/app/oauth/register/route';
import { rateLimitOAuthRegistration } from '@/lib/rate-limit';
import { SUPPORTED_SCOPE_NAMES } from '@/lib/oauth/config';
import {
  DCR_LIMITS,
  isAllowedRedirectUri,
  validateRegistration,
} from '@/services/auth/oauthRegistration';
import type { MockedFunction } from 'vitest';

const rl = rateLimitOAuthRegistration as MockedFunction<typeof rateLimitOAuthRegistration>;

function register(body: unknown): Promise<Response> {
  return POST(
    new Request('https://orangecat.ch/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }) as never
  );
}

beforeEach(() => {
  insert.mockClear();
  rl.mockResolvedValue({ success: true, limit: 10, remaining: 9, resetTime: Date.now() + 1000 });
});

describe('redirect URIs', () => {
  it.each([
    'https://claude.ai/api/mcp/auth_callback',
    'https://chatgpt.com/connector_platform_oauth_redirect',
    'http://localhost:33418/callback',
    'http://127.0.0.1:6274/oauth/callback',
    'http://[::1]:8080/cb',
  ])('accepts %s', uri => {
    expect(isAllowedRedirectUri(uri)).toBe(true);
  });

  it.each([
    'http://claude.ai/callback', // plain http off the loopback
    'http://localhost.evil.example/cb',
    'https://app.example/cb#frag',
    'https://app.example/cb#',
    'https://user:pass@app.example/cb',
    'cursor://anysphere.cursor-retrieval/oauth/callback', // custom schemes: no
    'javascript:alert(1)',
    'not a url',
    `https://app.example/${'a'.repeat(DCR_LIMITS.maxRedirectUriLength)}`,
  ])('refuses %s', uri => {
    expect(isAllowedRedirectUri(uri)).toBe(false);
  });
});

describe('validateRegistration', () => {
  const good = { redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] };

  it('requires at least one and at most five redirect URIs', () => {
    expect(validateRegistration({})).toMatchObject({ ok: false, error: 'invalid_redirect_uri' });
    expect(validateRegistration({ redirect_uris: [] }).ok).toBe(false);
    const six = Array.from({ length: 6 }, (_, i) => `https://a.example/${i}`);
    expect(validateRegistration({ redirect_uris: six }).ok).toBe(false);
  });

  it('only registers public clients using the code flow', () => {
    for (const bad of [
      { token_endpoint_auth_method: 'client_secret_basic' },
      { grant_types: ['client_credentials'] },
      { grant_types: 'authorization_code' },
      { response_types: ['token'] },
    ]) {
      expect(validateRegistration({ ...good, ...bad })).toMatchObject({
        ok: false,
        error: 'invalid_client_metadata',
      });
    }
    expect(
      validateRegistration({
        ...good,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      }).ok
    ).toBe(true);
  });

  it('cleans the name it will show on the consent screen', () => {
    const named = (client_name: unknown) => {
      const r = validateRegistration({ ...good, client_name });
      return r.ok ? r.metadata.clientName : null;
    };
    expect(named(undefined)).toBe('Unnamed app');
    expect(named('   ')).toBe('Unnamed app');
    expect(named(42)).toBe('Unnamed app');
    expect(named('  Claude  ')).toBe('Claude');
    expect(named('Bank‮gnp.exe')).toBe('Bank gnp.exe');
    expect(named('x'.repeat(200))).toHaveLength(DCR_LIMITS.maxClientNameLength);
  });
});

describe('POST /oauth/register', () => {
  it('registers an untrusted public client and answers per RFC 7591', async () => {
    const res = await register({
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      token_endpoint_auth_method: 'none',
      logo_uri: 'https://evil.example/looks-like-orangecat.png',
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body).toMatchObject({
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
    expect(body.client_id).toMatch(/^dcr_[A-Za-z0-9_-]{20,}$/);
    expect(typeof body.client_id_issued_at).toBe('number');
    expect(body).not.toHaveProperty('client_secret');

    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      client_id: body.client_id,
      client_secret_hash: null,
      is_trusted: false,
      is_confidential: false,
      registered_via: 'dcr',
      allowed_scopes: [...SUPPORTED_SCOPE_NAMES],
    });
    expect(row).not.toHaveProperty('logo_uri');
  });

  it('answers a bad redirect with 400 invalid_redirect_uri and stores nothing', async () => {
    const res = await register({ redirect_uris: ['http://evil.example/cb'] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_redirect_uri');
    expect(insert).not.toHaveBeenCalled();
  });

  it('answers malformed JSON with 400', async () => {
    expect((await register('{nope')).status).toBe(400);
  });

  it('is rate limited per caller', async () => {
    rl.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });
    const res = await register({ redirect_uris: ['https://claude.ai/cb'] });
    expect(res.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });
});
