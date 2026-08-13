import {
  RUNTIME_FIXTURE_DISCOVERY_CONTRACT,
  RUNTIME_DISCOVERABLE_PATTERNS,
  dataRecord,
  extractDocumentPaths,
  firstRecord,
  registerEntityFixtures,
  registerGroupFixtures,
  registerProfileFixtures,
} from '../e2e/runtime-route-fixture-helpers';
import { discoverAppRoutes } from '../e2e/route-inventory';

describe('read-only runtime route fixtures', () => {
  it('documents mutating GET endpoints that discovery must never call', () => {
    expect(RUNTIME_FIXTURE_DISCOVERY_CONTRACT).toEqual({
      method: 'GET',
      execution: 'request-context-only-no-client-effects',
      emptyResult: 'fixture-required',
      excludedEndpoints: [
        '/api/profile',
        '/api/messages/self',
        '/api/cat/nudges',
        '/api/cat/actions',
      ],
    });
  });

  it('reads both array and named-collection API envelopes', () => {
    expect(firstRecord({ data: [{ id: 'one' }] })).toEqual({ id: 'one' });
    expect(firstRecord({ data: { tasks: [{ id: 'two' }] } }, ['tasks'])).toEqual({ id: 'two' });
    expect(firstRecord({ data: { tasks: [] } }, ['tasks'])).toBeNull();
    expect(dataRecord({ data: { profile: { id: 'user-id' } } })).toEqual({
      profile: { id: 'user-id' },
    });
  });

  it('extracts only matching internal or OrangeCat links from HTML and sitemap XML', () => {
    const document = `
      <a href="/profiles/alice%40example.com">Alice</a>
      <a href="https://orangecat.ch/articles/a-safe-slug">Article</a>
      <a href="/articles/%E0%A4%A">Malformed escape</a>
      <a href="https://example.com/articles/external">External</a>
      <loc>https://orangecat.ch/projects/00000000-0000-0000-0000-000000000001</loc>
    `;
    expect(
      extractDocumentPaths(document, [
        '/profiles/[username]',
        '/articles/[slug]',
        '/projects/[id]',
      ])
    ).toEqual([
      '/profiles/alice%40example.com',
      '/articles/a-safe-slug',
      '/projects/00000000-0000-0000-0000-000000000001',
    ]);
  });

  it('registers every route shape that shares a profile, entity, or group key', () => {
    const fixtures: Record<string, string> = {};
    registerProfileFixtures(fixtures, 'alice@example.com');
    registerEntityFixtures(fixtures, 'projects', 'project-id');
    registerEntityFixtures(fixtures, 'products', 'product-id');
    registerEntityFixtures(fixtures, 'causes', 'cause-id');
    registerGroupFixtures(fixtures, 'garden-club');

    expect(fixtures).toMatchObject({
      '/[username]': '/alice%40example.com',
      '/profile/[username]': '/profile/alice%40example.com',
      '/profiles/[username]': '/profiles/alice%40example.com',
      '/pay/[username]': '/pay/alice%40example.com',
      '/projects/[id]': '/projects/project-id',
      '/project/[id]': '/project/project-id',
      '/dashboard/store/[id]': '/dashboard/store/product-id',
      '/dashboard/causes/[id]/edit': '/dashboard/causes/cause-id/edit',
      '/groups/[slug]': '/groups/garden-club',
      '/groups/[slug]/settings': '/groups/garden-club/settings',
      '/groups/[slug]/proposals': '/groups/garden-club/proposals',
      '/dashboard/groups/[slug]': '/dashboard/groups/garden-club',
    });
  });

  it('keeps public and owner fixtures in their correct data scopes', () => {
    const fixtures: Record<string, string> = {};
    registerEntityFixtures(fixtures, 'projects', 'owned-project', 'owner');
    registerEntityFixtures(fixtures, 'projects', 'public-project', 'public');
    registerGroupFixtures(fixtures, 'owned-group', 'owner');
    registerGroupFixtures(fixtures, 'public-group', 'public');

    expect(fixtures).toMatchObject({
      '/projects/[id]': '/projects/public-project',
      '/project/[id]': '/project/public-project',
      '/groups/[slug]': '/groups/public-group',
      '/groups/[slug]/proposals': '/groups/public-group/proposals',
      '/groups/[slug]/settings': '/groups/owned-group/settings',
      '/dashboard/groups/[slug]': '/dashboard/groups/owned-group',
    });
    expect(fixtures).not.toHaveProperty('/dashboard/projects/[id]');
  });

  it('has no structurally unhandled dynamic route pattern', () => {
    const bundled = new Set(['/blog/[slug]', '/create/[entityType]']);
    // Post history is intentionally excluded because its GET mutates expired
    // pending actions; it remains safely resolvable through E2E_POST_ID.
    const environmentOnly = new Set(['/post/[id]']);
    const covered = new Set([...RUNTIME_DISCOVERABLE_PATTERNS, ...bundled, ...environmentOnly]);
    const dynamic = discoverAppRoutes()
      .filter(route => route.kind === 'dynamic')
      .map(route => route.pattern);

    expect(dynamic).toHaveLength(47);
    expect(dynamic.filter(pattern => !covered.has(pattern as never))).toEqual([]);
  });

});
