/**
 * Public API surface SSOT.
 *
 * Anything that depends on the public API contract (SDKs, integration
 * docs, the discovery endpoint) reads from here. Internal callers should
 * keep using `ENTITY_REGISTRY[type].apiEndpoint` — those are the
 * non-versioned internal handlers that the OrangeCat web app talks to.
 *
 * Created: 2026-06-03
 * Last Modified: 2026-07-09
 * Last Modified Summary: Added stakeholders + integration endpoint registry for v1 discovery.
 */

import type { EntityType } from '@/config/entity-registry';

export const PUBLIC_API_VERSION = 'v1' as const;
export const PUBLIC_API_BASE = `/api/${PUBLIC_API_VERSION}` as const;
/**
 * v1 OpenAPI document (served by src/app/api/v1/openapi.json/route.ts).
 * Written as a static literal so audit:routes can resolve it; the type
 * annotation compile-errors if it ever drifts from PUBLIC_API_BASE.
 */
export const PUBLIC_API_OPENAPI_PATH: `${typeof PUBLIC_API_BASE}/openapi.json` =
  '/api/v1/openapi.json';

/**
 * Entity types whose POST is part of the v1 contract.
 *
 * Order matters: the order here is the order shown in discovery output
 * and any docs generation downstream.
 */
export const PUBLIC_API_ENTITY_TYPES = [
  'product',
  'service',
  'project',
  'cause',
  'event',
  'loan',
  'investment',
  'asset',
  'wishlist',
] as const satisfies readonly EntityType[];

export type PublicApiEntityType = (typeof PUBLIC_API_ENTITY_TYPES)[number];

/** Returns the v1 endpoint URL for an entity. */
export function publicApiEndpoint(type: PublicApiEntityType, basePath?: string): string {
  const segment = type === 'wishlist' ? 'wishlists' : `${type}s`;
  const base = basePath?.replace(/\/$/, '') ?? '';
  return `${base}${PUBLIC_API_BASE}/${segment}`;
}

export const PUBLIC_API_INTEGRATION_SCOPE_TOKENS = [
  'timeline.write',
  'stakeholders.read',
  'stakeholders.write',
  'payments.read',
  'payments.write',
] as const;

/** Non-entity v1 endpoints (publish bus, stakeholder graph, discovery, …). */
export const PUBLIC_API_INTEGRATION_ENDPOINTS = [
  {
    name: 'payments',
    methods: ['POST'] as const,
    endpoint: `${PUBLIC_API_BASE}/payments`,
  },
  {
    name: 'payments.status',
    methods: ['GET'] as const,
    endpoint: `${PUBLIC_API_BASE}/payments/{id}`,
  },
  {
    name: 'payments.public',
    methods: ['POST'] as const,
    endpoint: `${PUBLIC_API_BASE}/payments/public`,
  },
  {
    name: 'payments.l402',
    methods: ['GET'] as const,
    endpoint: `${PUBLIC_API_BASE}/pay/{entity_type}/{entity_id}`,
  },
  {
    name: 'timeline.publish',
    methods: ['POST'] as const,
    endpoint: `${PUBLIC_API_BASE}/timeline/publish`,
  },
  {
    name: 'stakeholders',
    methods: ['GET', 'POST'] as const,
    endpoint: `${PUBLIC_API_BASE}/stakeholders`,
  },
  {
    name: 'search',
    methods: ['GET'] as const,
    endpoint: `${PUBLIC_API_BASE}/search`,
  },
  {
    name: 'demand',
    methods: ['GET'] as const,
    endpoint: `${PUBLIC_API_BASE}/demand`,
  },
  {
    // Domain availability. Public and keyless — registry RDAP records are
    // public. Shared with Loki so the "a .ch not-found proves nothing"
    // rule is enforced server-side once, not re-implemented per client.
    name: 'domains',
    methods: ['GET'] as const,
    endpoint: `${PUBLIC_API_BASE}/domains`,
  },
] as const;

/**
 * All scope tokens minting UIs can offer. Format mirrors hasScope:
 * `<entity>.<read|write>`. Wildcard `'*'` is the everything-token and
 * is never enumerated here — it's a separate user choice.
 */
export const PUBLIC_API_SCOPE_TOKENS: readonly string[] = [
  ...PUBLIC_API_ENTITY_TYPES.flatMap(t => [`${t}.read`, `${t}.write`]),
  ...PUBLIC_API_INTEGRATION_SCOPE_TOKENS,
];

/**
 * Non-entity webhook events that carry an economic signal rather than an
 * entity lifecycle change. `payment.settled` fires when a Bitcoin payment
 * for one of the actor's entities settles — the same ground-truth signal
 * that drives the Loki entitlement rail, now also deliverable to any
 * integrator's own endpoint via the generic webhook fan-out.
 */
export const PUBLIC_API_ECONOMIC_WEBHOOK_EVENTS = ['payment.settled'] as const;

/**
 * Webhook event types that endpoints can subscribe to. Entity events mirror
 * how entityPostHandler emits: `<entity>.created` (future `<entity>.updated`
 * / `<entity>.deleted` append there); economic events carry settlement
 * signals. An endpoint with `event_types=null` receives every event for its
 * bound actor — the explicit allowlist only gates the firing fan-out.
 */
export const PUBLIC_API_WEBHOOK_EVENTS: readonly string[] = [
  ...PUBLIC_API_ENTITY_TYPES.map(t => `${t}.created`),
  ...PUBLIC_API_ECONOMIC_WEBHOOK_EVENTS,
];
