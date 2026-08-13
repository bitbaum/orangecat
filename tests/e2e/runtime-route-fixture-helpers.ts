import type { RuntimeRouteFixtures } from './route-inventory';

type JsonRecord = Record<string, unknown>;

export const RUNTIME_FIXTURE_DISCOVERY_CONTRACT = {
  method: 'GET',
  execution: 'request-context-only-no-client-effects',
  emptyResult: 'fixture-required',
  excludedEndpoints: [
    '/api/profile',
    '/api/messages/self',
    '/api/cat/nudges',
    '/api/cat/actions',
  ],
} as const;

export const ENTITY_FIXTURE_ENDPOINTS = [
  'ai-assistants',
  'assets',
  'causes',
  'circles',
  'documents',
  'events',
  'investments',
  'loans',
  'products',
  'projects',
  'research',
  'services',
  'wishlists',
] as const;

/** Dynamic patterns this GET-only resolver can populate when matching rows exist. */
export const RUNTIME_DISCOVERABLE_PATTERNS = [
  '/[username]',
  '/ai-assistants/[id]',
  '/articles/[slug]',
  '/articles/[slug]/edit',
  '/assets/[id]',
  '/causes/[id]',
  '/circles/[id]',
  '/dashboard/ai-assistants/[id]',
  '/dashboard/assets/[id]',
  '/dashboard/bookings/[id]',
  '/dashboard/causes/[id]',
  '/dashboard/causes/[id]/edit',
  '/dashboard/circles/[id]',
  '/dashboard/documents/[id]',
  '/dashboard/events/[id]',
  '/dashboard/groups/[slug]',
  '/dashboard/investments/[id]',
  '/dashboard/loans/[id]',
  '/dashboard/research/[id]',
  '/dashboard/services/[id]',
  '/dashboard/store/[id]',
  '/dashboard/tasks/[id]',
  '/dashboard/tasks/[id]/edit',
  '/dashboard/wishlists/[id]',
  '/dashboard/wishlists/items/[itemId]',
  '/documents/[id]',
  '/events/[id]',
  '/groups/[slug]',
  '/groups/[slug]/events/[eventId]',
  '/groups/[slug]/proposals',
  '/groups/[slug]/proposals/[id]',
  '/groups/[slug]/settings',
  '/investments/[id]',
  '/loans/[id]',
  '/messages/[conversationId]',
  '/pay/[username]',
  '/products/[id]',
  '/profile/[username]',
  '/profiles/[username]',
  '/project/[id]',
  '/projects/[id]',
  '/research/[id]',
  '/services/[id]',
  '/wishlists/[id]',
] as const;

export function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

export function firstRecord(
  payload: unknown,
  collectionKeys: readonly string[] = []
): JsonRecord | null {
  const root = asRecord(payload);
  const data = root ? root.data : payload;
  if (Array.isArray(data)) {
    return asRecord(data[0]);
  }

  const container = asRecord(data);
  if (!container) {
    return null;
  }

  for (const key of collectionKeys) {
    const value = container[key];
    if (Array.isArray(value)) {
      const item = value.map(asRecord).find((record): record is JsonRecord => record !== null);
      if (item) {
        return item;
      }
    }
  }
  return null;
}

/** Return an object-shaped `data` payload (for single-record API envelopes). */
export function dataRecord(payload: unknown): JsonRecord | null {
  const root = asRecord(payload);
  return asRecord(root?.data);
}

export function recordsAt(payload: unknown, collectionKey: string): JsonRecord[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const value = data?.[collectionKey];
  return Array.isArray(value)
    ? value.map(asRecord).filter((record): record is JsonRecord => record !== null)
    : [];
}

export function stringField(
  record: JsonRecord | null,
  keys: readonly string[]
): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && isSafeRouteSegment(value)) {
      return value;
    }
  }
  return null;
}

export function nestedStringField(
  record: JsonRecord | null,
  parentKey: string,
  keys: readonly string[]
): string | null {
  const parent = asRecord(record?.[parentKey]);
  return stringField(parent, keys);
}

export function isSafeRouteSegment(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 240 &&
    trimmed !== '.' &&
    trimmed !== '..' &&
    !/[/?#\\]/.test(trimmed) &&
    !/[\u0000-\u001f\u007f]/.test(trimmed)
  );
}

function decodeDocumentValue(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function candidatePath(value: string): string | null {
  const decoded = decodeDocumentValue(value.trim());
  if (!decoded || decoded.startsWith('#')) {
    return null;
  }
  try {
    const url = new URL(decoded, 'https://orangecat.invalid');
    if (!decoded.startsWith('/') && url.hostname !== 'orangecat.ch') {
      return null;
    }
    return url.pathname;
  } catch {
    return null;
  }
}

function patternMatches(pathname: string, pattern: string): boolean {
  const actual = pathname.split('/').filter(Boolean);
  const expected = pattern.split('/').filter(Boolean);
  if (actual.length !== expected.length) {
    return false;
  }
  return expected.every((segment, index) => {
    if (!segment.startsWith('[')) {
      return segment === actual[index];
    }
    try {
      return isSafeRouteSegment(decodeURIComponent(actual[index] ?? ''));
    } catch {
      return false;
    }
  });
}

/** Extract route-shaped links from HTML or XML without evaluating scripts. */
export function extractDocumentPaths(document: string, patterns: readonly string[]): string[] {
  const candidates = [
    ...document.matchAll(/\bhref\s*=\s*["']([^"'<>]+)["']/gi),
    ...document.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi),
  ]
    .map(match => candidatePath(match[1]))
    .filter((pathname): pathname is string => pathname !== null);

  return [
    ...new Set(
      patterns.flatMap(pattern => candidates.filter(pathname => patternMatches(pathname, pattern)))
    ),
  ];
}

export function registerProfileFixtures(
  fixtures: RuntimeRouteFixtures,
  username: string
): void {
  if (!isSafeRouteSegment(username)) {
    return;
  }
  const encoded = encodeURIComponent(username);
  fixtures['/[username]'] = `/${encoded}`;
  fixtures['/pay/[username]'] = `/pay/${encoded}`;
  fixtures['/profile/[username]'] = `/profile/${encoded}`;
  fixtures['/profiles/[username]'] = `/profiles/${encoded}`;
}

export function registerEntityFixtures(
  fixtures: RuntimeRouteFixtures,
  entity: (typeof ENTITY_FIXTURE_ENDPOINTS)[number],
  id: string,
  scope: 'all' | 'public' | 'owner' = 'all'
): void {
  if (!isSafeRouteSegment(id)) {
    return;
  }
  const encoded = encodeURIComponent(id);
  if (scope !== 'owner') {
    fixtures[`/${entity}/[id]`] = `/${entity}/${encoded}`;
    if (entity === 'projects') {
      fixtures['/project/[id]'] = `/project/${encoded}`;
    }
  }
  if (scope !== 'public') {
    if (entity === 'products') {
      fixtures['/dashboard/store/[id]'] = `/dashboard/store/${encoded}`;
    } else if (entity !== 'projects') {
      fixtures[`/dashboard/${entity}/[id]`] = `/dashboard/${entity}/${encoded}`;
    }
    if (entity === 'causes') {
      fixtures['/dashboard/causes/[id]/edit'] = `/dashboard/causes/${encoded}/edit`;
    }
  }
}

export function registerGroupFixtures(
  fixtures: RuntimeRouteFixtures,
  slug: string,
  scope: 'all' | 'public' | 'owner' = 'all'
): void {
  if (!isSafeRouteSegment(slug) || slug === 'create') {
    return;
  }
  const encoded = encodeURIComponent(slug);
  if (scope !== 'owner') {
    fixtures['/groups/[slug]'] = `/groups/${encoded}`;
    fixtures['/groups/[slug]/proposals'] = `/groups/${encoded}/proposals`;
  }
  if (scope !== 'public') {
    fixtures['/groups/[slug]/settings'] = `/groups/${encoded}/settings`;
    fixtures['/dashboard/groups/[slug]'] = `/dashboard/groups/${encoded}`;
  }
}
