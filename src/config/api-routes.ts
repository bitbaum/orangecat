/**
 * API_ROUTES — SSOT for all internal API endpoint paths.
 * Mirrors the ROUTES pattern from src/config/routes.ts (which covers frontend paths).
 * Use these constants in fetch() calls instead of hardcoded strings.
 */
import { ENTITY_REGISTRY } from '@/config/entity-registry';

export const API_ROUTES = {
  CAT: {
    CHAT: '/api/cat/chat',
    PREPARE: '/api/cat/prepare',
    LOCAL_COMPLETE: '/api/cat/local-complete',
    TRANSCRIBE: '/api/cat/transcribe',
    SUGGESTIONS: '/api/cat/suggestions',
    HISTORY: '/api/cat/history',
    CONTEXT: '/api/cat/context',
    TRACK_RECORD: '/api/cat/track-record',
    PERMISSIONS: '/api/cat/permissions',
    ACTIONS: '/api/cat/actions',
    QUOTA: '/api/cat/quota',
    CREDITS: '/api/cat/credits',
    CREDITS_TOPUP: '/api/cat/credits/topup',
    MEMORIES: '/api/cat/memories',
    MEMORIES_IMPORT: '/api/cat/memories/import',
    INTERESTS: '/api/cat/interests',
    DIAGNOSE: '/api/cat/diagnose',
    CAPACITY: '/api/cat/capacity',
    NUDGES: '/api/cat/nudges',
    CONVERSATIONS: '/api/cat/conversations',
    CONVERSATION: (id: string) => `/api/cat/conversations/${id}`,
    OFFERS_FROM_TEXT: '/api/cat/offers-from-text',
  },
  SEARCH: {
    LOG: '/api/search/log',
  },
  // Public feedback + Ask Cat (no auth required)
  FEEDBACK: '/api/feedback',
  NEWSLETTER_SUBSCRIBE: '/api/newsletter/subscribe',
  INTEGRATION_KEYS: {
    BASE: '/api/integration-keys',
    BY_ID: (id: string) => `/api/integration-keys/${id}`,
  },
  WEBHOOK_ENDPOINTS: {
    BASE: '/api/webhook-endpoints',
    BY_ID: (id: string) => `/api/webhook-endpoints/${id}`,
    DELIVERIES: (id: string) => `/api/webhook-endpoints/${id}/deliveries`,
    DELIVERY_REPLAY: (id: string, deliveryId: string) =>
      `/api/webhook-endpoints/${id}/deliveries/${deliveryId}/replay`,
  },
  DISCOVER: {
    COUNTS: '/api/discover/counts',
  },
  MESSAGES: {
    BASE: '/api/messages',
    CONVERSATION: (id: string) => `/api/messages/${id}`,
    CONVERSATION_READ: (id: string) => `/api/messages/${id}/read`,
    CONVERSATION_SUMMARY: (id: string) => `/api/messages/${id}/summary`,
    EDIT: (id: string) => `/api/messages/edit/${encodeURIComponent(id)}`,
    OPEN: '/api/messages/open',
    SELF: '/api/messages/self',
    ACTORS: '/api/messages/actors',
    BULK_CONVERSATIONS: '/api/messages/bulk-conversations',
    BULK_DELETE: '/api/messages/bulk-delete',
    UNREAD_COUNT: '/api/messages/unread-count',
  },
  WALLETS: {
    BASE: ENTITY_REGISTRY['wallet'].apiEndpoint,
    TRANSFER: '/api/wallets/transfer',
    ENTITY_VISIBILITY: '/api/wallets/entity-visibility',
    RECEIVE_STATUS: '/api/wallets/receive-status',
    /** "Can this actually be paid?" — a real probe, not a shape check. */
    VERIFY: '/api/wallets/verify',
    /** Owner-only on-chain history. Server-side: mempool.space must not be
     *  called from a browser — that leaks the viewer's IP and the owner's
     *  addresses to a third party. */
    TRANSACTIONS: (id: string) => `/api/wallets/${id}/transactions`,
  },
  ENTITY_WALLETS: '/api/entity-wallets',
  /** What Bitcoin costs — our own origin, so no third-party call from a browser. */
  RATES: '/api/rates',
  VOICE: {
    /** One spoken sentence → which thing they meant to create. */
    INTENT: '/api/voice/intent',
  },
  RECEIVE: {
    REQUEST: '/api/receive/request',
  },
  SEND: '/api/send',
  PAYMENT_REQUESTS: {
    BASE: '/api/payment-requests',
    BY_ID: (id: string) => `/api/payment-requests/${id}`,
  },
  NOTIFICATIONS: {
    BASE: '/api/notifications',
    UNREAD: '/api/notifications/unread',
    READ: '/api/notifications/read',
    CLEAR_READ: '/api/notifications?clear=read',
    PREFERENCES: '/api/notifications/preferences',
  },
  PROFILES: {
    BASE: '/api/profiles',
    // NOTE: no /api/profiles/[id] route exists — single-profile fetch goes
    // through /api/profile/[identifier] (see API_ROUTES.PROFILE).
    PROJECTS: (id: string) => `/api/profiles/${id}/projects`,
    ENTITIES: (id: string, entityType: string) => `/api/profiles/${id}/entities/${entityType}`,
    WISHLIST_TIERS: (id: string) => `/api/profiles/${id}/wishlist-tiers`,
  },
  RESEARCH: ENTITY_REGISTRY['research'].apiEndpoint,
  SOCIAL: {
    FOLLOW: '/api/social/follow',
    UNFOLLOW: '/api/social/unfollow',
    FOLLOWING: (id: string) => `/api/social/following/${id}`,
    // "Do I follow X" — one indexed lookup. Deliberately NOT answered by
    // paging FOLLOWING: that list is capped at DEFAULT_PAGE_SIZE, so the
    // answer silently goes wrong past 20 follows.
    FOLLOW_STATUS: (id: string) => `/api/social/follow-status/${id}`,
    FOLLOWERS: (id: string) => `/api/social/followers/${id}`,
  },
  TASKS: {
    BASE: '/api/tasks',
    BY_ID: (id: string) => `/api/tasks/${id}`,
    COMPLETE: (id: string) => `/api/tasks/${id}/complete`,
    ATTENTION: (id: string) => `/api/tasks/${id}/attention`,
    REQUEST: (id: string) => `/api/tasks/${id}/request`,
    ANALYTICS: '/api/task-analytics',
  },
  AI: {
    FORM_PREFILL: '/api/ai/form-prefill',
    IMAGES_GENERATE: '/api/ai/images/generate',
    IMAGES_SUGGEST: '/api/ai/images/suggest',
    WRITING: {
      TOPICS: '/api/ai/writing/topics',
      DRAFT: '/api/ai/writing/draft',
      REVISE: '/api/ai/writing/revise',
    },
  },
  AUTH: {
    CALLBACK: '/api/auth/callback',
    SYNC: '/api/auth/sync',
    VERIFY_CAPTCHA: '/api/auth/verify-captcha',
    OAUTH_PROVIDERS: '/api/auth/oauth-providers',
  },
  DOCUMENTS: {
    BASE: ENTITY_REGISTRY['document'].apiEndpoint,
    BY_ID: (id: string) => `${ENTITY_REGISTRY['document'].apiEndpoint}/${id}`,
    EXTRACT: `${ENTITY_REGISTRY['document'].apiEndpoint}/extract`,
  },
  WISHLISTS: {
    BASE: ENTITY_REGISTRY['wishlist'].apiEndpoint,
    ITEMS: (wishlistId: string) => `${ENTITY_REGISTRY['wishlist'].apiEndpoint}/${wishlistId}/items`,
    PROOFS: `${ENTITY_REGISTRY['wishlist'].apiEndpoint}/proofs`,
    FEEDBACK: `${ENTITY_REGISTRY['wishlist'].apiEndpoint}/feedback`,
    ITEM_PROOFS: (itemId: string) =>
      `${ENTITY_REGISTRY['wishlist'].apiEndpoint}/items/${itemId}/proofs`,
  },
  ENTITIES: {
    STATUS: (entityType: string, id: string) => `/api/entities/${entityType}/${id}/status`,
  },
  USER: {
    API_KEYS: '/api/user/api-keys',
    AVAILABLE_MODELS: '/api/user/available-models',
    STATS: '/api/users/me/stats',
  },
  PAYMENTS: {
    BASE: '/api/payments',
    BY_ID: (id: string) => `/api/payments/${id}`,
    RECEIVE_INFO: '/api/payments/receive-info',
    RECIPIENT_CONFIRMATIONS: '/api/payments/recipient-confirmations',
    CAN_RECEIVE: '/api/payments/can-receive',
  },
  TIPS: {
    RECEIVE_INFO: '/api/tips/receive-info',
    INVOICE: '/api/tips/invoice',
    STATUS: '/api/tips/status',
  },
  INTEGRATIONS: {
    FLEETCROWN_BUILD_INTENTS: '/api/integrations/fleetcrown/build-intents',
  },
  LNURLP: {
    CALLBACK: (username: string) => `/api/lnurlp/${encodeURIComponent(username)}/callback`,
  },
  PROJECTS: {
    BASE: ENTITY_REGISTRY['project'].apiEndpoint,
    BY_ID: (id: string) => `${ENTITY_REGISTRY['project'].apiEndpoint}/${id}`,
    STATUS: (id: string) => `${ENTITY_REGISTRY['project'].apiEndpoint}/${id}/status`,
    REFRESH_BALANCE: (id: string) =>
      `${ENTITY_REGISTRY['project'].apiEndpoint}/${id}/refresh-balance`,
    UPDATES: (id: string) => `${ENTITY_REGISTRY['project'].apiEndpoint}/${id}/updates`,
    FAVORITE: (id: string) => `${ENTITY_REGISTRY['project'].apiEndpoint}/${id}/favorite`,
    FAVORITES: `${ENTITY_REGISTRY['project'].apiEndpoint}/favorites`,
  },
  PROJECT_ROLES: {
    BASE: '/api/project-roles',
    BY_ID: (id: string) => `/api/project-roles/${id}`,
  },
  LOANS: {
    BASE: ENTITY_REGISTRY['loan'].apiEndpoint,
    BY_ID: (id: string) => `${ENTITY_REGISTRY['loan'].apiEndpoint}/${id}`,
    OBLIGATION: `${ENTITY_REGISTRY['loan'].apiEndpoint}/obligation`,
    OFFERS: `${ENTITY_REGISTRY['loan'].apiEndpoint}/offers`,
    OFFER_BY_ID: (id: string) => `${ENTITY_REGISTRY['loan'].apiEndpoint}/offers/${id}`,
    OFFER_RESPOND: (id: string) => `${ENTITY_REGISTRY['loan'].apiEndpoint}/offers/${id}/respond`,
    PAYMENTS: `${ENTITY_REGISTRY['loan'].apiEndpoint}/payments`,
    PAYMENT_COMPLETE: (id: string) =>
      `${ENTITY_REGISTRY['loan'].apiEndpoint}/payments/${id}/complete`,
    COLLATERAL: '/api/loan-collateral',
  },
  PROFILE: '/api/profile',
  GROUPS: {
    BASE: ENTITY_REGISTRY['group'].apiEndpoint,
    EVENTS: (slug: string) => `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/events`,
    PROPOSALS: (slug: string) => `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/proposals`,
    PROPOSAL: (slug: string, id: string) =>
      `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/proposals/${id}`,
    PROPOSAL_VOTES: (slug: string, id: string) =>
      `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/proposals/${id}/votes`,
    PROPOSAL_VOTE: (slug: string, id: string) =>
      `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/proposals/${id}/vote`,
    PROPOSAL_ACTIVATE: (slug: string, id: string) =>
      `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/proposals/${id}/activate`,
    WALLETS: (slug: string) => `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/wallets`,
    WALLET_REFRESH: (slug: string, walletId: string) =>
      `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/wallets/${walletId}/refresh`,
    ACTIVITIES: (slug: string) => `${ENTITY_REGISTRY['group'].apiEndpoint}/${slug}/activities`,
  },
  JOBS: '/api/jobs',
  ACCOUNT_EXPORT: '/api/account/export',
  DELETE_USER: '/api/delete-user',
  WAITLIST: '/api/waitlist',
  AI_ASSISTANTS: {
    BASE: ENTITY_REGISTRY['ai_assistant'].apiEndpoint,
    BY_ID: (id: string) => `${ENTITY_REGISTRY['ai_assistant'].apiEndpoint}/${id}`,
    CONVERSATIONS: (id: string) =>
      `${ENTITY_REGISTRY['ai_assistant'].apiEndpoint}/${id}/conversations`,
    CONVERSATION: (assistantId: string, conversationId: string) =>
      `${ENTITY_REGISTRY['ai_assistant'].apiEndpoint}/${assistantId}/conversations/${conversationId}`,
    CONVERSATION_MESSAGES: (assistantId: string, conversationId: string) =>
      `${ENTITY_REGISTRY['ai_assistant'].apiEndpoint}/${assistantId}/conversations/${conversationId}/messages`,
  },
  TRANSACTIONS: '/api/transactions',
  BOOKINGS: {
    BASE: '/api/bookings',
    BY_ID: (id: string) => `/api/bookings/${id}`,
    RECEIVE_INFO: (id: string) => `/api/bookings/${id}/receive-info`,
  },
  PROFILE_CLAIMS: {
    BASE: '/api/profile-claims',
    /** Creator-side, addressed by the row id (revoke). */
    BY_ID: (id: string) => `/api/profile-claims/${id}`,
    /**
     * Public side, addressed by the credential. `id` addresses the row for its
     * creator; `token` is what travels in a link — see ADR-0004 D4.
     */
    PREVIEW: (token: string) => `/api/profile-claims/token/${token}`,
    CLAIM: (token: string) => `/api/profile-claims/token/${token}/claim`,
    DECLINE: (token: string) => `/api/profile-claims/token/${token}/decline`,
  },
} as const;

/** Download filename served by API_ROUTES.ACCOUNT_EXPORT (and used by its UI button). */
export const ACCOUNT_EXPORT_FILENAME = 'orangecat-account-export.json';
