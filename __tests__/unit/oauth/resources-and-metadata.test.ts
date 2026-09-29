/**
 * Resource indicators (RFC 8707) and the discovery documents AI apps read.
 *
 * The contract with Loki is exact strings — the resource URIs, the scope names,
 * the metadata fields — so these tests pin the strings, not just the shapes.
 */
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.OAUTH_JWT_PRIVATE_KEY = Buffer.from(privateKey).toString('base64');
process.env.OAUTH_JWT_KID = 'test-kid';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  })),
}));

import { decodeJwt } from 'jose';
import {
  OAUTH_ISSUER,
  OAUTH_RESOURCES,
  STANDARD_SCOPE_NAMES,
  SUPPORTED_SCOPE_NAMES,
  findOAuthResource,
  scopesForResource,
} from '@/lib/oauth/config';
import { GET as openidConfiguration } from '@/app/.well-known/openid-configuration/route';
import { GET as asMetadata } from '@/app/.well-known/oauth-authorization-server/route';
import { GET as prm } from '@/app/.well-known/oauth-protected-resource/route';
import { GET as prmSuffixed } from '@/app/.well-known/oauth-protected-resource/api/mcp/route';
import { grantableScopes, issueTokens, type OAuthClient } from '@/services/auth/oauthProvider';
import { resolveRequestAuth } from '@/lib/api/resolveRequestAuth';

const client = (overrides: Partial<OAuthClient> = {}): OAuthClient => ({
  id: 'row',
  client_id: 'dcr_x',
  client_secret_hash: null,
  name: 'App',
  redirect_uris: [],
  allowed_scopes: [...SUPPORTED_SCOPE_NAMES],
  is_confidential: false,
  is_trusted: false,
  disabled_at: null,
  registered_via: 'dcr',
  ...overrides,
});

describe('OAUTH_RESOURCES', () => {
  it('is the shared contract with Loki', () => {
    expect(OAUTH_RESOURCES.orangecat.uri).toBe(`${OAUTH_ISSUER}/api/mcp`);
    expect(OAUTH_RESOURCES.loki.uri).toBe(
      process.env.LOKI_MCP_RESOURCE ?? 'https://loki.orangecat.ch/api/mcp'
    );
    expect(OAUTH_RESOURCES.loki.scopes).toEqual(['loki.chat', 'loki.act']);
    for (const r of Object.values(OAUTH_RESOURCES)) {
      for (const s of r.scopes) {
        expect(SUPPORTED_SCOPE_NAMES).toContain(s);
      }
    }
  });

  it('resolves exact URIs (one trailing slash tolerated) and nothing else', () => {
    const loki = OAUTH_RESOURCES.loki.uri;
    expect(findOAuthResource(loki)?.name).toBe('Loki');
    expect(findOAuthResource(`${loki}/`)?.name).toBe('Loki');
    expect(findOAuthResource(loki.toUpperCase())).toBeNull();
    expect(findOAuthResource(`${loki}/extra`)).toBeNull();
    expect(findOAuthResource('https://evil.example/api/mcp')).toBeNull();
    expect(findOAuthResource('')).toBeNull();
  });
});

describe('scopes for a resource', () => {
  const loki = OAUTH_RESOURCES.loki;

  it('defaults to the resource scopes when none are asked for', () => {
    expect(scopesForResource([], loki)).toEqual(['loki.chat', 'loki.act']);
  });

  it('keeps standard scopes and the resource own, drops the rest', () => {
    expect(scopesForResource(['openid', 'loki.act', 'project.write'], loki)).toEqual([
      'openid',
      'loki.act',
    ]);
  });

  it('leaves requests without a resource as they were', () => {
    expect(scopesForResource(['project.write'], null)).toEqual(['project.write']);
  });

  it('always intersects with what the client may ask for', () => {
    const narrow = client({ allowed_scopes: [...STANDARD_SCOPE_NAMES, 'loki.chat'] });
    expect(grantableScopes(narrow, '', loki)).toEqual(['loki.chat']);
    expect(grantableScopes(narrow, 'openid bogus loki.act', loki)).toEqual(['openid']);
  });
});

describe('issued tokens', () => {
  it('bind aud to the resource and name the client in client_id', async () => {
    const { access_token } = await issueTokens({
      client: client(),
      actorId: 'actor-1',
      userId: 'user-1',
      scopes: ['loki.chat'],
      resource: OAUTH_RESOURCES.loki.uri,
      withRefresh: false,
    });
    const claims = decodeJwt(access_token);
    expect(claims.aud).toBe(OAUTH_RESOURCES.loki.uri);
    expect(claims.client_id).toBe('dcr_x');
    expect(claims.sub).toBe('actor-1');
  });

  it('keep aud = client_id when no resource was asked for', async () => {
    const { access_token } = await issueTokens({
      client: client(),
      actorId: 'actor-1',
      userId: 'user-1',
      scopes: ['project.read'],
      withRefresh: false,
    });
    expect(decodeJwt(access_token).aud).toBe('dcr_x');
  });

  it('minted for Loki are refused by /api/v1 (fail closed, no session fallback)', async () => {
    const mint = (resource: string | null) =>
      issueTokens({
        client: client(),
        actorId: 'actor-1',
        userId: 'user-1',
        scopes: ['project.write'],
        resource,
        withRefresh: false,
      });
    const asRequest = (token: string) =>
      ({ headers: new Headers({ authorization: `Bearer ${token}` }) }) as never;

    const loki = await mint(OAUTH_RESOURCES.loki.uri);
    expect(await resolveRequestAuth(asRequest(loki.access_token))).toBeNull();

    const own = await mint(OAUTH_RESOURCES.orangecat.uri);
    expect((await resolveRequestAuth(asRequest(own.access_token)))?.source).toBe('oidc');

    const plain = await mint(null);
    expect((await resolveRequestAuth(asRequest(plain.access_token)))?.boundActorId).toBe('actor-1');
  });
});

describe('discovery documents', () => {
  it('serve one authorization-server document at both addresses', async () => {
    const oidc = await openidConfiguration().json();
    const rfc8414 = await asMetadata().json();
    expect(rfc8414).toEqual(oidc);
    expect(oidc).toMatchObject({
      issuer: OAUTH_ISSUER,
      registration_endpoint: `${OAUTH_ISSUER}/oauth/register`,
      authorization_endpoint: `${OAUTH_ISSUER}/oauth/authorize`,
      token_endpoint: `${OAUTH_ISSUER}/oauth/token`,
      code_challenge_methods_supported: ['S256'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
    });
    expect(oidc.token_endpoint_auth_methods_supported).toContain('none');
    expect(oidc.scopes_supported).toEqual(expect.arrayContaining(['loki.chat', 'loki.act']));
  });

  it('serve the protected-resource document at the bare and path-suffixed addresses', async () => {
    const doc = await prm().json();
    expect(doc).toEqual({
      resource: `${OAUTH_ISSUER}/api/mcp`,
      authorization_servers: [OAUTH_ISSUER],
      scopes_supported: ['project.read', 'project.write', 'timeline.write'],
      bearer_methods_supported: ['header'],
      resource_name: 'OrangeCat',
    });
    expect(await prmSuffixed().json()).toEqual(doc);
  });

  it('are readable cross-origin', () => {
    expect(prm().headers.get('access-control-allow-origin')).toBe('*');
    expect(asMetadata().headers.get('access-control-allow-origin')).toBe('*');
  });
});
