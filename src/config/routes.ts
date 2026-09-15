/**
 * Unified Route Configuration
 *
 * Single source of truth for all route categorization and detection logic
 * Eliminates scattered route detection throughout the codebase
 *
 * Created: 2025-12-12
 * Last Modified: 2026-01-30
 * Last Modified Summary: Consolidated all route definitions from headerRoutes.ts and lib/routes.ts into this single source of truth
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { publicProfilePath } from '@/config/public-profile-path';

/**
 * Route contexts categorize routes by their accessibility and purpose
 */
export const ROUTE_CONTEXTS = {
  /**
   * Routes only accessible to authenticated users
   */
  authenticated: [
    '/dashboard',
    '/profile',
    '/settings',
    '/messages',
    '/timeline',
    '/post',
    '/project',
    '/onboarding',
  ] as const,

  /**
   * Routes accessible to everyone, typically landing/marketing pages
   */
  public: [
    '/',
    '/discover',
    '/community',
    '/channel',
    '/browse',
    '/categories',
    '/events',
    '/products',
    '/services',
    '/causes',
    '/loans',
    '/investments',
    '/groups',
    '/companions',
    '/wishlists',
    '/research',
    '/assets',
    '/technology',
    '/bitcoin-wallet-guide',
    '/study-bitcoin',
    '/how-it-works',
    '/donations',
    '/pages',
    '/wallets',
  ] as const,

  /**
   * Routes accessible to both authenticated and non-authenticated users
   * These are informational pages that don't require login
   */
  universal: ['/about', '/blog', '/docs', '/privacy', '/terms', '/faq', '/coming-soon'] as const,

  /**
   * Authentication-related routes
   */
  auth: [
    '/auth',
    '/auth/callback',
    '/auth/confirm',
    '/auth/reset-password',
    '/auth/signout',
  ] as const,

  /**
   * Routes that show different content based on auth state
   * (e.g., profiles show different data for own vs others)
   */
  contextual: ['/profiles'] as const,
} as const;

/**
 * Type definitions for route contexts
 */
export type RouteContext = 'authenticated' | 'public' | 'universal' | 'auth' | 'contextual';

// =============================================================================
// SSOT — route surface classification
// =============================================================================
//
// Every shell-related decision (sidebar visibility, mobile bottom-nav
// visibility, header variant, footer visibility) MUST derive from
// `getRouteSurface(pathname)`. Do not maintain side-tables in component files.
//
// Three surfaces, mirrored in the app/ folder structure:
//   - 'app'    — `src/app/(authenticated)/` (auth-gated) plus entity routes
//                still at top level (discover, products, services, ...) that
//                are accessible signed-out but render in-app shell when
//                signed in. Show sidebar (when user) + mobile bottom nav.
//   - 'auth'   — `src/app/auth/`. Minimal chrome — no sidebar, no bottom
//                nav, no footer, no marketing top nav.
//   - 'public' — `src/app/(public)/`. Marketing / legal / informational.
//                Marketing top nav + footer. No sidebar.
//
// To add or move a route: drop the folder in the right place AND update
// the matching list below. Both layers exist so source-tree organisation
// and runtime classification can never silently drift.

export type RouteSurface = 'app' | 'public' | 'auth';

const APP_SURFACES = [
  '/dashboard',
  '/discover',
  '/profile',
  '/profiles',
  '/settings',
  '/messages',
  '/timeline',
  '/post',
  '/project',
  '/projects',
  '/products',
  '/services',
  '/causes',
  '/events',
  '/loans',
  '/investments',
  '/companions',
  '/ai-chat',
  '/wishlists',
  '/research',
  '/assets',
  '/groups',
  '/wallets',
  '/onboarding',
  '/jobs',
  '/community',
  '/create',
  '/collaborate',
  '/home',
  // Money surfaces. `/pay/<username>` is deliberately NOT here — that one is a
  // public page for the payer, who needs no account.
  '/receive',
  '/send',
  '/requests',
] as const;

const AUTH_SURFACES = ['/auth'] as const;

/** O(n) prefix-match against a sorted list. Pathname like `/discover/123`
 *  matches `'/discover'`. Exact `/` matches only `'/'`.
 */
function matchesPrefix(pathname: string, routes: readonly string[]): boolean {
  for (const route of routes) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Single SSOT for shell-related route classification. Sidebar, mobile nav,
 * header variant, and footer must all derive from this.
 */
export function getRouteSurface(pathname: string): RouteSurface {
  if (matchesPrefix(pathname, AUTH_SURFACES)) {
    return 'auth';
  }
  if (matchesPrefix(pathname, APP_SURFACES)) {
    return 'app';
  }
  return 'public';
}

/** Shell chrome overrides for routes that need a focused, low-distraction layout. */
export interface RouteChrome {
  hideMobileBottomNav: boolean;
  preferCollapsedSidebar: boolean;
}

/** True when the pathname is the Cat hub (or a sub-route of it). SSOT — do
 * not re-implement with ad-hoc `startsWith('/dashboard/cat')` checks. */
export function isCatHubPath(pathname: string): boolean {
  return pathname === '/dashboard/cat' || pathname.startsWith('/dashboard/cat/');
}

/**
 * Per-route shell chrome. Sidebar collapse, mobile nav, and similar decisions
 * must derive from this — do not branch on pathname in layout components.
 */
export function getRouteChrome(pathname: string): RouteChrome {
  const catFocus = isCatHubPath(pathname);
  return {
    hideMobileBottomNav: catFocus,
    preferCollapsedSidebar: catFocus,
  };
}

// =============================================================================
// Back-compat wrappers — prefer getRouteSurface in new code.
// These exist so we don't have to rename every caller in one PR.
// =============================================================================

/**
 * Returns the legacy five-bucket classifier. Prefer `getRouteSurface`.
 */
export function getRouteContext(pathname: string): RouteContext {
  const surface = getRouteSurface(pathname);
  if (surface === 'auth') {
    return 'auth';
  }
  if (surface === 'app') {
    return 'authenticated';
  }
  if (matchesPrefix(pathname, ROUTE_CONTEXTS.universal)) {
    return 'universal';
  }
  if (matchesPrefix(pathname, ROUTE_CONTEXTS.contextual)) {
    return 'contextual';
  }
  return 'public';
}

/**
 * True for in-app surfaces. Prefer `getRouteSurface(p) === 'app'`.
 */
export function isAuthenticatedRoute(pathname: string): boolean {
  return getRouteSurface(pathname) === 'app';
}

/**
 * Footer is shown only on public/marketing routes — not in-app, not auth.
 * Derives from the surface SSOT.
 */
export function shouldShowFooter(pathname: string): boolean {
  return getRouteSurface(pathname) === 'public';
}

/**
 * Sidebar shows on in-app surfaces. Prefer `getRouteSurface(p) === 'app'`.
 */
export function shouldShowSidebar(pathname: string): boolean {
  return getRouteSurface(pathname) === 'app';
}

/**
 * True for marketing/auth routes. Prefer `getRouteSurface(p) !== 'app'`.
 */
export function isPublicRoute(pathname: string): boolean {
  return getRouteSurface(pathname) !== 'app';
}

/**
 * DOM id of a category card on the Cat permissions page.
 *
 * Both ends of the deep link derive from here — the page renders this id, and
 * ROUTES.DASHBOARD.CAT_PERMISSIONS_CATEGORY builds the href — so a renamed or
 * added category can never leave a failure notice pointing at an anchor that
 * does not exist.
 */
export function catPermissionAnchorId(category: string): string {
  return `category-${category}`;
}

/**
 * Route Constants
 *
 * Centralized route definitions for programmatic route generation.
 * Use these constants instead of hardcoded strings throughout the application.
 */
export const ROUTES = {
  // Public routes
  HOME: '/',
  AUTH: '/auth',
  AUTH_LOGIN: '/auth?mode=login',
  AUTH_REGISTER: '/auth?mode=register',
  AUTH_FORGOT_PASSWORD: '/auth?mode=forgot',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  AUTH_CALLBACK: '/auth/callback',
  AUTH_SIGNOUT: '/auth/signout',
  DISCOVER: '/discover',
  WALLETS: '/wallets',
  CREATE: '/create',
  STUDY_BITCOIN: '/study-bitcoin',
  BITCOIN_WALLET_GUIDE: '/bitcoin-wallet-guide',
  ONBOARDING: {
    // /onboarding is a redirect-only entry point (legacy bookmarks).
    // The live surface is INTELLIGENT — the standard multi-step wizard
    // was removed on 2026-06-05.
    INTELLIGENT: '/onboarding/intelligent',
  },
  COMMUNITY: '/community',
  GOVERNANCE: '/governance',
  ECOSYSTEM: '/ecosystem',
  ABOUT: '/about',
  HOW_IT_WORKS: '/how-it-works',
  BLOG: '/blog',
  RSS: '/rss.xml',
  CHANGELOG: '/changelog',
  ROADMAP: '/roadmap',
  WHITEPAPER: '/whitepaper',
  ARTICLES: '/articles',
  ARTICLES_NEW: '/articles/new',
  ARTICLE: (slug: string) => `/articles/${slug}`,
  ARTICLE_EDIT: (slug: string) => `/articles/${slug}/edit`,
  DOCS: '/docs',
  FAQ: '/faq',
  FEEDBACK: '/feedback',
  PRICING: '/pricing',
  SUPPORT: '/support',
  TECHNOLOGY: '/technology',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  STATUS: '/status',
  SECURITY: '/security',
  DISCOVER_TYPE: (type: string) => `/discover?type=${type}`,
  DISCOVER_TRENDING: '/discover?trending=true',

  // Project routes
  PROJECTS: {
    LIST: ENTITY_REGISTRY['project'].publicBasePath,
    CREATE: ENTITY_REGISTRY['project'].createPath,
    VIEW: (id: string) => `${ENTITY_REGISTRY['project'].publicBasePath}/${id}`,
    EDIT: (id: string) => `${ENTITY_REGISTRY['project'].createPath}?edit=${id}`,
  },

  // Public entity routes
  PRODUCTS: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['product'].publicBasePath}/${id}`,
  },
  SERVICES: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['service'].publicBasePath}/${id}`,
  },
  CAUSES: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['cause'].publicBasePath}/${id}`,
  },
  CIRCLES: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['circle'].publicBasePath}/${id}`,
  },
  LOANS: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['loan'].publicBasePath}/${id}`,
  },
  INVESTMENTS: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['investment'].publicBasePath}/${id}`,
  },
  EVENTS: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['event'].publicBasePath}/${id}`,
  },
  WISHLISTS: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['wishlist'].publicBasePath}/${id}`,
  },
  RESEARCH: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['research'].publicBasePath}/${id}`,
  },
  AI_ASSISTANTS: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['ai_assistant'].publicBasePath}/${id}`,
  },
  ASSETS: {
    VIEW: (id: string) => `${ENTITY_REGISTRY['asset'].publicBasePath}/${id}`,
  },
  GROUPS: {
    LIST: ENTITY_REGISTRY['group'].publicBasePath,
    VIEW: (slug: string) => `${ENTITY_REGISTRY['group'].publicBasePath}/${slug}`,
  },

  // Dashboard routes
  DASHBOARD: {
    HOME: '/dashboard',
    PROJECTS: ENTITY_REGISTRY['project'].basePath,
    PROJECTS_CREATE: ENTITY_REGISTRY['project'].createPath,
    ANALYTICS: '/dashboard/analytics',
    INFO: '/dashboard/info',
    INFO_EDIT: '/dashboard/info/edit',
    PEOPLE: '/dashboard/people',
    WALLETS: ENTITY_REGISTRY['wallet'].basePath,
    WALLETS_CREATE: ENTITY_REGISTRY['wallet'].createPath,
    GROUPS: ENTITY_REGISTRY['group'].basePath,
    GROUPS_CREATE: ENTITY_REGISTRY['group'].createPath,
    ASSETS: ENTITY_REGISTRY['asset'].basePath,
    ASSETS_CREATE: ENTITY_REGISTRY['asset'].createPath,
    LOANS: ENTITY_REGISTRY['loan'].basePath,
    LOANS_CREATE: ENTITY_REGISTRY['loan'].createPath,
    INVESTMENTS: ENTITY_REGISTRY['investment'].basePath,
    INVESTMENTS_CREATE: ENTITY_REGISTRY['investment'].createPath,
    EVENTS: ENTITY_REGISTRY['event'].basePath,
    EVENTS_CREATE: ENTITY_REGISTRY['event'].createPath,
    STORE: ENTITY_REGISTRY['product'].basePath,
    STORE_CREATE: ENTITY_REGISTRY['product'].createPath,
    SERVICES: ENTITY_REGISTRY['service'].basePath,
    SERVICES_CREATE: ENTITY_REGISTRY['service'].createPath,
    CAUSES: ENTITY_REGISTRY['cause'].basePath,
    CAUSES_CREATE: ENTITY_REGISTRY['cause'].createPath,
    CIRCLES: ENTITY_REGISTRY['circle'].basePath,
    CIRCLES_CREATE: ENTITY_REGISTRY['circle'].createPath,
    AI_ASSISTANTS: ENTITY_REGISTRY['ai_assistant'].basePath,
    AI_ASSISTANTS_CREATE: ENTITY_REGISTRY['ai_assistant'].createPath,
    WISHLISTS: ENTITY_REGISTRY['wishlist'].basePath,
    TASKS: '/dashboard/tasks',
    TASKS_NEW: '/dashboard/tasks/new',
    TASKS_VIEW: (id: string) => `/dashboard/tasks/${id}`,
    TASKS_ANALYTICS: '/dashboard/tasks/analytics',
    RESEARCH: ENTITY_REGISTRY['research'].basePath,
    BOOKINGS: '/dashboard/bookings',
    BOOKINGS_VIEW: (id: string) => `/dashboard/bookings/${id}`,
    CAT: '/dashboard/cat',
    CAT_PERMISSIONS: '/dashboard/cat/permissions',
    /** Deep link straight to one category's card (see catPermissionAnchorId). */
    CAT_PERMISSIONS_CATEGORY: (category: string) =>
      `/dashboard/cat/permissions#${catPermissionAnchorId(category)}`,
    // Post-auth landing for new users — Cat is the primary interface.
    CAT_WELCOME: '/dashboard/cat?welcome=true',
    DOCUMENTS: ENTITY_REGISTRY['document'].basePath,
    DOCUMENTS_CREATE: ENTITY_REGISTRY['document'].createPath,
    PROFILE_CLAIMS: '/dashboard/profile-claims',
    PROFILE_CLAIMS_NEW: '/dashboard/profile-claims/new',
    /** Where creating for someone else lands: the link, and a way to send it. */
    PROFILE_CLAIMS_SHARE: (claimId: string) =>
      `/dashboard/profile-claims/${encodeURIComponent(claimId)}/share`,
    // Note: there is no /dashboard/settings page. Account settings live at
    // ROUTES.SETTINGS; AI settings at ROUTES.SETTINGS_AI.
  },

  // Profile routes (authenticated - own profile)
  PROFILE: {
    SELF: '/profile',
    VIEW: (username: string) => `/profile/${username}`,
    EDIT: '/dashboard/info',
    // Note: there is no /profile/settings page; account settings live at
    // ROUTES.SETTINGS.
  },

  // Public profile routes (shareable)
  PROFILES: {
    VIEW: publicProfilePath,
    ME: '/profiles/me',
  },

  /** Public, no-account-needed landing for a pre-drafted profile. */
  // Takes the claim TOKEN, not the row id: the id addresses a claim for its
  // creator, the token is the credential that travels in the link.
  CLAIM: (claimToken: string) => `/claim/${encodeURIComponent(claimToken)}`,

  // Timeline routes
  TIMELINE: '/timeline',
  /** Owner's "get paid" screen — one tap to a scannable QR. */
  RECEIVE: '/receive',
  /** Public, account-free page a payer lands on. The shareable half of RECEIVE. */
  PAY_LANDING: '/pay',
  PAY: (username: string) => `/pay/${encodeURIComponent(username)}`,
  /** Outbound half of the money surface — pay a person or a pasted invoice. */
  SEND: '/send',
  /** Person-to-person asks for money, both directions. */
  REQUESTS: '/requests',
  // Personalized "Following" home feed (people/projects you follow)
  FEED: '/home',
  // Open-roles collaborator board (project_roles)
  COLLABORATE: '/collaborate',

  // Messages routes
  MESSAGES: '/messages',
  MESSAGE_CONVERSATION: (conversationId: string) => `/messages/${conversationId}`,
  // Same conversation via query param (keeps the split-pane list view mounted)
  MESSAGES_WITH_CONVERSATION: (conversationId: string) => `/messages?id=${conversationId}`,

  // Settings routes
  SETTINGS: '/settings',
  SETTINGS_AI: '/settings/ai',
  SETTINGS_AI_ONBOARDING: '/settings/ai/onboarding',
  SETTINGS_INTEGRATIONS: '/settings/integrations',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
  SETTINGS_USAGE: '/settings/usage',
} as const;
