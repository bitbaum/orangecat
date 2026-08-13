import { expect, test } from '@playwright/test';
import routeAliases from '../../src/config/route-aliases.json';

const FILESYSTEM_REDIRECTS = [
  { source: '/profile/audit-user', destination: '/profiles/audit-user' },
  { source: '/project/audit-fixture', destination: '/projects/audit-fixture' },
] as const;

function materialize(value: string): string {
  return value
    .replace(':path*', 'audit-path')
    .replace(':username', 'audit-user')
    .replace(':id', 'audit-fixture');
}

test.describe('canonical compatibility routes', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const alias of routeAliases) {
    test(`${alias.source} redirects to ${alias.destination}`, async ({ request, baseURL }) => {
      const source = materialize(alias.source);
      const expected = new URL(materialize(alias.destination), baseURL);
      const response = await request.get(source, { maxRedirects: 0 });

      expect(response.status()).toBe(alias.permanent ? 308 : 307);
      const location = response.headers().location;
      expect(location, 'redirect must include a Location header').toBeTruthy();
      const actual = new URL(location!, baseURL);
      expect(`${actual.pathname}${actual.search}`).toBe(`${expected.pathname}${expected.search}`);
    });
  }

  for (const alias of FILESYSTEM_REDIRECTS) {
    test(`${alias.source} filesystem page redirects to ${alias.destination}`, async ({
      request,
      baseURL,
    }) => {
      const response = await request.get(alias.source, { maxRedirects: 0 });
      expect([307, 308]).toContain(response.status());
      const location = response.headers().location;
      expect(location, 'redirect must include a Location header').toBeTruthy();
      const actual = new URL(location!, baseURL);
      expect(`${actual.pathname}${actual.search}`).toBe(alias.destination);
    });
  }

  test('legacy editor alias preserves its exact destination through the auth boundary', async ({
    request,
    baseURL,
  }) => {
    const projectId = 'editor-round-trip';
    const aliasResponse = await request.get(`/fund-us/${projectId}/edit`, {
      maxRedirects: 0,
    });
    expect(aliasResponse.status()).toBe(308);
    const canonicalLocation = aliasResponse.headers().location;
    expect(canonicalLocation).toBeTruthy();
    const canonical = new URL(canonicalLocation!, baseURL);
    expect(`${canonical.pathname}${canonical.search}`).toBe(
      `/dashboard/projects/create?edit=${projectId}`
    );

    const authResponse = await request.get(`${canonical.pathname}${canonical.search}`, {
      maxRedirects: 0,
    });
    expect([307, 308]).toContain(authResponse.status());
    const authLocation = authResponse.headers().location;
    expect(authLocation).toBeTruthy();
    const auth = new URL(authLocation!, baseURL);
    expect(auth.pathname).toBe('/auth');
    expect(auth.searchParams.get('mode')).toBe('login');
    expect(auth.searchParams.get('from')).toBe(
      `/dashboard/projects/create?edit=${projectId}`
    );
  });
});
