/**
 * The developer page quotes endpoints, scopes and lifetimes. Every one of them
 * is derived from the provider's config, and this pins it: a snippet that
 * names an endpoint the discovery document does not serve is a red build.
 */
import { buildAuthorizationServerMetadata } from '@/lib/oauth/metadata';
import { OAUTH_SCOPES, STANDARD_SCOPE_NAMES } from '@/lib/oauth/config';
import {
  authJsSnippet,
  authorizeSnippet,
  refreshSnippet,
  registerSnippet,
  SIGN_IN_SCOPE,
  tokenSnippet,
  userinfoSnippet,
} from '@/app/(public)/docs/sign-in-with-orangecat/snippets';

const meta = buildAuthorizationServerMetadata();

describe('/docs/sign-in-with-orangecat snippets', () => {
  it('quote the endpoints the discovery document serves', () => {
    expect(registerSnippet).toContain(meta.registration_endpoint);
    expect(authorizeSnippet).toContain(meta.authorization_endpoint);
    expect(tokenSnippet).toContain(meta.token_endpoint);
    expect(refreshSnippet).toContain(meta.token_endpoint);
    expect(userinfoSnippet).toContain(meta.userinfo_endpoint);
    expect(authJsSnippet).toContain(`issuer: "${meta.issuer}"`);
  });

  it('ask for exactly the standard OIDC scopes for a sign-in', () => {
    expect(SIGN_IN_SCOPE.split(' ')).toEqual(STANDARD_SCOPE_NAMES);
    expect(OAUTH_SCOPES.filter(s => s.standard).map(s => s.name)).toEqual(STANDARD_SCOPE_NAMES);
    expect(authJsSnippet).toContain(`scope: "${SIGN_IN_SCOPE}"`);
  });

  it('use only what the server supports: PKCE S256, client_secret_post or none', () => {
    expect(meta.code_challenge_methods_supported).toEqual(['S256']);
    expect(authorizeSnippet).toContain('code_challenge_method=S256');
    for (const method of ['client_secret_post', 'none']) {
      expect(meta.token_endpoint_auth_methods_supported).toContain(method);
      expect(authJsSnippet).toContain(`"${method}"`);
    }
  });

  it('tell a relying party what invalid_grant means', () => {
    expect(refreshSnippet).toMatch(/invalid_grant.*disconnected/);
  });
});
