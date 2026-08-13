import fs from 'fs';
import path from 'path';
import { requiresAuthentication } from '../../src/config/route-access';

export type RouteKind = 'static' | 'dynamic';
export type RouteSurface = 'authenticated' | 'public' | 'auth' | 'unscoped';

export interface AppRoute {
  pattern: string;
  sourceFile: string;
  kind: RouteKind;
  surface: RouteSurface;
  access: 'authentication-required' | 'visitor-accessible';
}

/** Machine-readable release contract embedded in every route-audit report. */
export const ROUTE_AUDIT_CONTRACT = {
  version: 1,
  viewports: [
    { project: 'chromium', width: 1440, height: 1000 },
    { project: 'mobile-375', width: 375, height: 812 },
    { project: 'mobile-390', width: 390, height: 844 },
  ],
  evidence: 'full-page-screenshot-for-every-resolved-route',
  scrollSampling: 'increments-no-larger-than-80-percent-of-viewport-height',
  strictRelease: {
    authenticatedStateRequired: true,
    authenticatedSemanticsRequired: true,
    fixtureRequiredAllowed: false,
    scanErrorsAllowed: false,
    routeFailuresAllowed: false,
    internalLinkFailuresAllowed: false,
  },
  checks: [
    'http-and-next-not-found',
    'runtime-and-console-errors',
    'loading-completion',
    'main-and-h1-landmarks',
    'horizontal-overflow',
    '44px-action-targets',
    'topmost-element-occlusion-at-every-scroll-step',
    'nested-interactive-controls',
    'axe-wcag-2.2-aa',
    'expected-redirect-destination',
    'runtime-emitted-internal-link-final-semantics',
  ],
  exclusions: [
    'external-destination-availability',
    'mailto-tel-bitcoin-lightning-handler-execution',
    'destructive-or-third-party-mutations',
  ],
  fixtureDiscovery: {
    mode: 'get-only-existing-records',
    execution: 'request-context-only-no-client-effects',
    emptyData: 'fixture-required',
    excludedEndpoints: [
      '/api/profile',
      '/api/messages/self',
      '/api/cat/nudges',
      '/api/cat/actions',
    ],
  },
} as const;

/**
 * Build the route catalogue from App Router page files so the browser audit
 * cannot drift from the application. Route groups are implementation details
 * and are intentionally stripped from the emitted URL.
 */
export function discoverAppRoutes(appDir = path.resolve(process.cwd(), 'src/app')): AppRoute[] {
  const pageFiles: string[] = [];

  function walk(directory: string): void {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (/^page\.(tsx?|jsx?)$/.test(entry.name)) {
        pageFiles.push(absolute);
      }
    }
  }

  walk(appDir);

  const routes = pageFiles.map(sourceFile => {
    const relativeDirectory = path.relative(appDir, path.dirname(sourceFile));
    const rawSegments = relativeDirectory.split(path.sep).filter(Boolean);
    const routeGroup = rawSegments.find(
      segment => segment.startsWith('(') && segment.endsWith(')')
    );
    const segments = rawSegments.filter(
      segment => !(segment.startsWith('(') && segment.endsWith(')')) && !segment.startsWith('@')
    );
    const pattern = segments.length === 0 ? '/' : `/${segments.join('/')}`;
    const surface: RouteSurface = routeGroup?.includes('authenticated')
      ? 'authenticated'
      : routeGroup?.includes('public')
        ? 'public'
        : pattern === '/auth' || pattern.startsWith('/auth/')
          ? 'auth'
          : 'unscoped';

    return {
      pattern,
      sourceFile: path.relative(process.cwd(), sourceFile),
      kind: pattern.includes('[') ? ('dynamic' as const) : ('static' as const),
      surface,
      access: requiresAuthentication(pattern)
        ? ('authentication-required' as const)
        : ('visitor-accessible' as const),
    };
  });

  return routes.sort((a, b) => a.pattern.localeCompare(b.pattern));
}

interface DynamicFixture {
  path: string;
  source: 'bundled' | 'environment' | 'runtime-api';
}

export type RuntimeRouteFixtures = Record<string, string>;

const BUNDLED_DYNAMIC_FIXTURES: Record<string, string> = {
  '/blog/[slug]': '/blog/loops-graphs-and-the-melting-middle',
  '/create/[entityType]': '/create/project',
};

const DYNAMIC_FIXTURE_ENV: Record<string, string> = {
  '/[username]': 'E2E_PROFILE_USERNAME',
  '/profiles/[username]': 'E2E_PROFILE_USERNAME',
  '/profile/[username]': 'E2E_PROFILE_USERNAME',
  '/pay/[username]': 'E2E_PROFILE_USERNAME',
  '/project/[id]': 'E2E_PROJECT_ID',
  '/projects/[id]': 'E2E_PROJECT_ID',
  '/post/[id]': 'E2E_POST_ID',
  '/articles/[slug]': 'E2E_ARTICLE_SLUG',
  '/articles/[slug]/edit': 'E2E_ARTICLE_SLUG',
  '/messages/[conversationId]': 'E2E_CONVERSATION_ID',
  '/groups/[slug]': 'E2E_GROUP_SLUG',
  '/groups/[slug]/settings': 'E2E_GROUP_SLUG',
  '/groups/[slug]/proposals': 'E2E_GROUP_SLUG',
  '/groups/[slug]/proposals/[id]': 'E2E_GROUP_PROPOSAL_FIXTURE',
  '/groups/[slug]/events/[eventId]': 'E2E_GROUP_EVENT_FIXTURE',
  '/dashboard/groups/[slug]': 'E2E_GROUP_SLUG',
  '/dashboard/tasks/[id]': 'E2E_TASK_ID',
  '/dashboard/tasks/[id]/edit': 'E2E_TASK_ID',
  '/dashboard/bookings/[id]': 'E2E_BOOKING_ID',
  '/dashboard/wishlists/items/[itemId]': 'E2E_WISHLIST_ITEM_ID',
};

const ENTITY_ID_ENV: Record<string, string> = {
  'ai-assistants': 'E2E_AI_ASSISTANT_ID',
  assets: 'E2E_ASSET_ID',
  causes: 'E2E_CAUSE_ID',
  circles: 'E2E_CIRCLE_ID',
  documents: 'E2E_DOCUMENT_ID',
  events: 'E2E_EVENT_ID',
  investments: 'E2E_INVESTMENT_ID',
  loans: 'E2E_LOAN_ID',
  products: 'E2E_PRODUCT_ID',
  research: 'E2E_RESEARCH_ID',
  services: 'E2E_SERVICE_ID',
  wishlists: 'E2E_WISHLIST_ID',
};

function replaceSingleSegment(pattern: string, value: string): string {
  return pattern.replace(/\[[^\]]+\]/, encodeURIComponent(value));
}

/** Resolve a dynamic pattern only when a deterministic fixture exists. */
export function resolveDynamicFixture(
  routePattern: string,
  runtimeFixtures: RuntimeRouteFixtures = {}
): DynamicFixture | null {
  if (runtimeFixtures[routePattern]) {
    return { path: runtimeFixtures[routePattern], source: 'runtime-api' };
  }

  const bundledPath = BUNDLED_DYNAMIC_FIXTURES[routePattern];
  if (bundledPath) {
    return { path: bundledPath, source: 'bundled' };
  }

  const explicitEnv = DYNAMIC_FIXTURE_ENV[routePattern];
  if (explicitEnv) {
    const value = process.env[explicitEnv];
    if (!value) {
      return null;
    }

    if (routePattern === '/groups/[slug]/proposals/[id]') {
      const [slug, id] = value.split(':');
      return slug && id
        ? {
            path: `/groups/${encodeURIComponent(slug)}/proposals/${encodeURIComponent(id)}`,
            source: 'environment',
          }
        : null;
    }
    if (routePattern === '/groups/[slug]/events/[eventId]') {
      const [slug, eventId] = value.split(':');
      return slug && eventId
        ? {
            path: `/groups/${encodeURIComponent(slug)}/events/${encodeURIComponent(eventId)}`,
            source: 'environment',
          }
        : null;
    }

    return { path: replaceSingleSegment(routePattern, value), source: 'environment' };
  }

  const entityMatch = routePattern.match(/^\/(?:dashboard\/)?([^/]+)\/\[id\](?:\/edit)?$/);
  if (!entityMatch) {
    return null;
  }
  const envName = ENTITY_ID_ENV[entityMatch[1]];
  const value = envName ? process.env[envName] : undefined;
  return value ? { path: replaceSingleSegment(routePattern, value), source: 'environment' } : null;
}
