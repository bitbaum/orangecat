import type { Page } from '@playwright/test';
import type { RuntimeRouteFixtures } from './route-inventory';
import {
  ENTITY_FIXTURE_ENDPOINTS,
  asRecord,
  dataRecord,
  extractDocumentPaths,
  firstRecord,
  isSafeRouteSegment,
  nestedStringField,
  recordsAt,
  registerEntityFixtures,
  registerGroupFixtures,
  registerProfileFixtures,
  stringField,
} from './runtime-route-fixture-helpers';

async function getJson(page: Page, pathname: string): Promise<unknown> {
  const response = await page.request.get(pathname);
  return response.ok() ? response.json().catch(() => null) : null;
}

async function getDocument(page: Page, pathname: string): Promise<string> {
  const response = await page.request.get(pathname);
  return response.ok() ? response.text().catch(() => '') : '';
}

async function discoverEntityFixtures(
  page: Page,
  fixtures: RuntimeRouteFixtures,
  publicFixtures: RuntimeRouteFixtures,
  discoverOwner: boolean
): Promise<void> {
  if (discoverOwner) {
    for (const entity of ENTITY_FIXTURE_ENDPOINTS) {
      const payload = await getJson(page, `/api/${entity}?limit=1`);
      const id = stringField(firstRecord(payload), ['id']);
      if (id) {
        // API list rows are owner-appropriate when authenticated. Public detail
        // fixtures are filled independently from the public sitemap below.
        registerEntityFixtures(fixtures, entity, id, 'owner');
      }
    }
  }

  // Public detail IDs come from the crawler-facing sitemap. Keep them separate
  // from owner IDs so a signed-in session cannot accidentally audit a private
  // row on a visitor route (or a public stranger's row on a dashboard route).
  const sitemap = await getDocument(page, '/sitemap.xml');
  for (const entity of ENTITY_FIXTURE_ENDPOINTS) {
    const publicPath = extractDocumentPaths(sitemap, [`/${entity}/[id]`])[0];
    const id = publicPath?.split('/').filter(Boolean).at(-1);
    if (id) {
      registerEntityFixtures(publicFixtures, entity, decodeURIComponent(id), 'public');
    }
  }
}

async function discoverProfileAndArticles(
  page: Page,
  fixtures: RuntimeRouteFixtures,
  publicFixtures: RuntimeRouteFixtures
): Promise<{ ownUserId: string | null; authenticated: boolean }> {
  // Resolve the signed-in identity from a read-only aggregate that already
  // owns the profile lookup. Avoid /api/profile, whose GET bootstraps rows.
  const stats = dataRecord(await getJson(page, '/api/users/me/stats'));
  const ownProfile = asRecord(stats?.profile);
  const ownUserId = stringField(ownProfile, ['id']);
  const ownUsername = stringField(ownProfile, ['username']);
  const publicDocument = await getDocument(page, '/sitemap.xml');
  const publicProfilePath = extractDocumentPaths(publicDocument, ['/profiles/[username]'])[0];
  const publicUsername = publicProfilePath?.split('/').filter(Boolean).at(-1);
  if (ownUsername) {
    registerProfileFixtures(fixtures, ownUsername);
  }
  if (publicUsername) {
    registerProfileFixtures(publicFixtures, decodeURIComponent(publicUsername));
  }

  const publishedArticles = await getDocument(page, '/articles');
  const publishedPath = extractDocumentPaths(publishedArticles, ['/articles/[slug]'])[0];
  if (publishedPath) {
    publicFixtures['/articles/[slug]'] = publishedPath;
  }
  const ownArticlesDocument = ownUsername
    ? await getDocument(page, `/profiles/${encodeURIComponent(ownUsername)}?tab=articles`)
    : '';
  const ownArticlePath = extractDocumentPaths(ownArticlesDocument, ['/articles/[slug]'])[0];
  if (ownArticlePath) {
    fixtures['/articles/[slug]/edit'] = `${ownArticlePath}/edit`;
  }
  return { ownUserId, authenticated: ownUserId !== null };
}

async function discoverGroupFixtures(
  page: Page,
  fixtures: RuntimeRouteFixtures,
  authenticated: boolean
): Promise<void> {
  if (authenticated) {
    const ownerGroupsPayload = await getJson(page, '/api/groups?limit=100');
    const ownerGroups = recordsAt(ownerGroupsPayload, 'groups');
    const ownerSlug = stringField(ownerGroups[0] ?? null, ['slug']);
    if (ownerSlug) {
      registerGroupFixtures(fixtures, ownerSlug, 'owner');
    }
  }

  const publicGroupsPayload = await getJson(page, '/api/groups?limit=100&scope=public');
  const publicGroups = recordsAt(publicGroupsPayload, 'groups');
  let slug = stringField(publicGroups[0] ?? null, ['slug']);

  if (!slug) {
    const job = firstRecord(await getJson(page, '/api/jobs?limit=1'), ['jobs']);
    slug = nestedStringField(job, 'groups', ['slug']);
  }
  if (!slug || !isSafeRouteSegment(slug)) {
    return;
  }

  registerGroupFixtures(fixtures, slug, 'public');
  // Nested content can live in a different group from the first generic group.
  // Probe each existing group until both shapes are covered; never seed rows.
  const slugs = [
    ...new Set([slug, ...publicGroups.map(group => stringField(group, ['slug']))]),
  ].filter((candidate): candidate is string => Boolean(candidate && isSafeRouteSegment(candidate)));
  for (const groupSlug of slugs) {
    const encodedSlug = encodeURIComponent(groupSlug);
    if (!fixtures['/groups/[slug]/proposals/[id]']) {
      const proposal = firstRecord(
        await getJson(page, `/api/groups/${encodedSlug}/proposals?limit=1&status=all`),
        ['proposals']
      );
      const proposalId = stringField(proposal, ['id']);
      if (proposalId) {
        fixtures['/groups/[slug]/proposals/[id]'] =
          `/groups/${encodedSlug}/proposals/${encodeURIComponent(proposalId)}`;
      }
    }

    if (!fixtures['/groups/[slug]/events/[eventId]']) {
      const event = firstRecord(
        await getJson(page, `/api/groups/${encodedSlug}/events?limit=1&status=all`),
        ['events']
      );
      const eventId = stringField(event, ['id']);
      if (eventId) {
        fixtures['/groups/[slug]/events/[eventId]'] =
          `/groups/${encodedSlug}/events/${encodeURIComponent(eventId)}`;
      }
    }

    if (
      fixtures['/groups/[slug]/proposals/[id]'] &&
      fixtures['/groups/[slug]/events/[eventId]']
    ) {
      break;
    }
  }
}

async function discoverAuthenticatedFixtures(
  page: Page,
  fixtures: RuntimeRouteFixtures,
  ownUserId: string | null
): Promise<void> {
  const conversationId = stringField(
    firstRecord(await getJson(page, '/api/messages?limit=1'), ['conversations']),
    ['id']
  );
  if (conversationId) {
    fixtures['/messages/[conversationId]'] = `/messages/${encodeURIComponent(conversationId)}`;
  }

  const taskId = stringField(firstRecord(await getJson(page, '/api/tasks?limit=1'), ['tasks']), ['id']);
  if (taskId) {
    const encoded = encodeURIComponent(taskId);
    fixtures['/dashboard/tasks/[id]'] = `/dashboard/tasks/${encoded}`;
    fixtures['/dashboard/tasks/[id]/edit'] = `/dashboard/tasks/${encoded}/edit`;
  }

  const bookingId = stringField(firstRecord(await getJson(page, '/api/bookings?limit=1')), ['id']);
  if (bookingId) {
    fixtures['/dashboard/bookings/[id]'] = `/dashboard/bookings/${encodeURIComponent(bookingId)}`;
  }

  if (ownUserId) {
    const ownWishlists = await getJson(
      page,
      `/api/wishlists?limit=1&user_id=${encodeURIComponent(ownUserId)}`
    );
    const ownWishlistId = stringField(firstRecord(ownWishlists), ['id']);
    if (ownWishlistId) {
      const encoded = encodeURIComponent(ownWishlistId);
      fixtures['/dashboard/wishlists/[id]'] = `/dashboard/wishlists/${encoded}`;
      const detail = await getDocument(page, `/dashboard/wishlists/${encoded}`);
      const itemPath = extractDocumentPaths(detail, ['/dashboard/wishlists/items/[itemId]'])[0];
      if (itemPath) {
        fixtures['/dashboard/wishlists/items/[itemId]'] = itemPath;
      }
    }
    if (!fixtures['/dashboard/wishlists/items/[itemId]']) {
      const tiers = dataRecord(
        await getJson(page, `/api/profiles/${encodeURIComponent(ownUserId)}/wishlist-tiers`)
      );
      const itemId = stringField(firstRecord({ data: tiers }, ['items']), ['id']);
      if (itemId) {
        fixtures['/dashboard/wishlists/items/[itemId]'] =
          `/dashboard/wishlists/items/${encodeURIComponent(itemId)}`;
      }
    }
  }
}

/**
 * Discover existing route fixtures through request-context GETs only. Empty
 * datasets stay unresolved so strict mode reports the missing seeded data
 * instead of creating production records during an audit.
 */
export async function deriveRuntimeFixtures(
  page: Page,
  mode: 'anonymous' | 'authenticated' = 'anonymous'
): Promise<RuntimeRouteFixtures> {
  const fixtures: RuntimeRouteFixtures = {};
  const publicFixtures: RuntimeRouteFixtures = {};
  const { ownUserId, authenticated } = await discoverProfileAndArticles(
    page,
    fixtures,
    publicFixtures
  );
  await discoverEntityFixtures(page, fixtures, publicFixtures, authenticated);
  await discoverGroupFixtures(page, fixtures, authenticated);
  if (authenticated) {
    await discoverAuthenticatedFixtures(page, fixtures, ownUserId);
  }
  return mode === 'anonymous' ? { ...fixtures, ...publicFixtures } : fixtures;
}
