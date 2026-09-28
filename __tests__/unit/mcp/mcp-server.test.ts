/**
 * /api/mcp — OrangeCat's MCP server, as an AI app meets it.
 *
 * What is pinned here is the part a reviewer cannot see by reading one file:
 * that an unauthenticated call is told WHERE to sign in (RFC 9728), that a
 * genuine OrangeCat token minted for another server is refused (RFC 8707
 * audience), and that a missing scope comes back as a tool error the model can
 * act on — not a 500, not a silent success. Tokens are real RS256 JWTs signed
 * by the provider's own issueTokens, so the audience check is exercised
 * against what production actually mints.
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
vi.mock('@/lib/supabase/server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/services/auth/integrationKeys', () => ({ verifyIntegrationKey: vi.fn() }));
vi.mock('@/services/cat/platform-search', async () => {
  const actual = await vi.importActual<typeof import('@/services/cat/platform-search')>(
    '@/services/cat/platform-search'
  );
  return { ...actual, searchPlatform: vi.fn() };
});
// The write tools run the v1 handlers in-process; those have their own tests.
vi.mock('@/app/api/v1/projects/route', () => ({ POST: vi.fn() }));
vi.mock('@/app/api/v1/timeline/publish/route', () => ({ POST: vi.fn() }));

import { POST, GET } from '@/app/api/mcp/route';
import { OAUTH_ISSUER, OAUTH_RESOURCES } from '@/lib/oauth/config';
import { issueTokens, type OAuthClient } from '@/services/auth/oauthProvider';
import { verifyIntegrationKey } from '@/services/auth/integrationKeys';
import { searchPlatform } from '@/services/cat/platform-search';
import { POST as createProjectV1 } from '@/app/api/v1/projects/route';
import { MCP_TOOLS } from '@/services/mcp/tools';
import type { MockedFunction } from 'vitest';

const CLIENT: OAuthClient = {
  id: 'row-id',
  client_id: 'dcr_test',
  client_secret_hash: null,
  name: 'Test app',
  redirect_uris: ['https://app.example/callback'],
  allowed_scopes: ['project.read', 'project.write', 'timeline.write'],
  is_confidential: false,
  is_trusted: false,
  disabled_at: null,
  registered_via: 'dcr',
};

async function tokenFor(resource: string | null, scopes: string[]): Promise<string> {
  const { access_token } = await issueTokens({
    client: CLIENT,
    actorId: 'actor-1',
    userId: 'user-1',
    scopes,
    resource,
    withRefresh: false,
  });
  return access_token;
}

function rpc(body: object, bearer?: string): Request {
  return new Request('https://orangecat.ch/api/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...body }),
  });
}

const RESOURCE_METADATA = `resource_metadata="${OAUTH_ISSUER}/.well-known/oauth-protected-resource"`;

describe('authentication', () => {
  it('answers an unauthenticated call with 401 pointing at the protected-resource metadata', async () => {
    const res = await POST(rpc({ method: 'tools/list' }));
    expect(res.status).toBe(401);
    const challenge = res.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain(RESOURCE_METADATA);
    expect(challenge).not.toContain('invalid_token');
    expect(res.headers.get('access-control-expose-headers')).toContain('WWW-Authenticate');
  });

  it('401s a GET probe too, so discovery works whichever method a client tries first', async () => {
    const res = await GET(new Request('https://orangecat.ch/api/mcp'));
    expect(res.status).toBe(401);
  });

  it('refuses a real OrangeCat token minted for Loki (audience), with invalid_token', async () => {
    const lokiToken = await tokenFor(OAUTH_RESOURCES.loki.uri, ['loki.chat']);
    const res = await POST(rpc({ method: 'tools/list' }, lokiToken));
    expect(res.status).toBe(401);
    const challenge = res.headers.get('www-authenticate') ?? '';
    expect(challenge).toContain('error="invalid_token"');
    expect(challenge).toContain(RESOURCE_METADATA);
  });

  it('refuses a plain Login-with-OrangeCat token (aud = client_id)', async () => {
    const plain = await tokenFor(null, ['project.read']);
    const res = await POST(rpc({ method: 'tools/list' }, plain));
    expect(res.status).toBe(401);
  });

  it('refuses garbage and a revoked integration key', async () => {
    (verifyIntegrationKey as MockedFunction<typeof verifyIntegrationKey>).mockResolvedValue(null);
    expect((await POST(rpc({ method: 'tools/list' }, 'not-a-jwt'))).status).toBe(401);
    expect((await POST(rpc({ method: 'tools/list' }, 'ock_revoked'))).status).toBe(401);
  });

  it('accepts a live integration key', async () => {
    (verifyIntegrationKey as MockedFunction<typeof verifyIntegrationKey>).mockResolvedValue({
      userId: 'user-1',
      actorId: 'actor-1',
      keyId: 'key-1',
      scopes: ['*'],
      isTest: false,
    });
    const res = await POST(rpc({ method: 'tools/list' }, 'ock_live'));
    expect(res.status).toBe(200);
  });
});

describe('tools', () => {
  it('lists every tool to a token minted for this server', async () => {
    const token = await tokenFor(OAUTH_RESOURCES.orangecat.uri, ['project.read']);
    const res = await POST(rpc({ method: 'tools/list' }, token));
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      'orangecat_whoami',
      'orangecat_search',
      'orangecat_my_entities',
      'orangecat_create_project',
      'orangecat_post_update',
    ]);
  });

  it('answers a call without the needed scope with a tool error naming the scope', async () => {
    const token = await tokenFor(OAUTH_RESOURCES.orangecat.uri, ['project.read']);
    const res = await POST(
      rpc(
        {
          method: 'tools/call',
          params: {
            name: 'orangecat_create_project',
            arguments: { title: 'A roof', description: 'For the school' },
          },
        },
        token
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain('"project.write"');
    expect(createProjectV1).not.toHaveBeenCalled();
  });

  it('runs a scope-free tool and returns absolute links', async () => {
    (searchPlatform as MockedFunction<typeof searchPlatform>).mockResolvedValue([
      { type: 'projects', title: 'Village well', description: 'Water', url: '/projects/abc' },
    ]);
    const token = await tokenFor(OAUTH_RESOURCES.orangecat.uri, []);
    const res = await POST(
      rpc(
        {
          method: 'tools/call',
          params: { name: 'orangecat_search', arguments: { query: 'well' } },
        },
        token
      )
    );
    const body = await res.json();
    expect(body.result.isError).toBeFalsy();
    expect(body.result.structuredContent.results[0].url).toMatch(/^https?:\/\/.+\/projects\/abc$/);
  });

  it('gates every tool on a scope the OrangeCat resource advertises', () => {
    const advertised: readonly string[] = OAUTH_RESOURCES.orangecat.scopes;
    for (const tool of MCP_TOOLS) {
      if (tool.scope) {
        expect(advertised).toContain(tool.scope);
      }
    }
  });
});
