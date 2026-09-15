/**
 * Database Tables Constants
 *
 * SSOT for non-entity database table names.
 * For entity tables (projects, services, products, etc.), use getTableName() from entity-registry.ts
 *
 * Usage:
 *   import { DATABASE_TABLES } from '@/config/database-tables';
 *   supabase.from(DATABASE_TABLES.MESSAGES).select('*')
 */

export const DATABASE_TABLES = {
  // Messaging
  MESSAGES: 'messages',
  CONVERSATIONS: 'conversations',
  CONVERSATION_PARTICIPANTS: 'conversation_participants',
  PARTICIPANT_READ_TIMES: 'participant_read_times',

  // Social
  PROFILES: 'profiles',
  PROFILE_CLAIMS: 'profile_claims',
  PROFILE_USERNAME_HISTORY: 'profile_username_history',
  FOLLOWS: 'follows',
  ACTORS: 'actors',

  // User Stats & Presence
  USER_STATS: 'user_stats',
  USER_PRESENCE: 'user_presence',

  // Projects
  PROJECT_FAVORITES: 'project_favorites',
  PROJECT_UPDATES: 'project_updates',
  PROJECT_MEDIA: 'project_media',
  PROJECT_SUPPORT: 'project_support',
  PROJECT_SUPPORT_STATS: 'project_support_stats',
  PROJECT_DRAFTS: 'project_drafts',

  // Groups
  GROUPS: 'groups',
  GROUP_MEMBERS: 'group_members',
  GROUP_WALLETS: 'group_wallets',
  GROUP_INVITATIONS: 'group_invitations',
  GROUP_EVENTS: 'group_events',
  GROUP_EVENT_RSVPS: 'group_event_rsvps',
  GROUP_PROPOSALS: 'group_proposals',
  GROUP_VOTES: 'group_votes',
  GROUP_FEATURES: 'group_features',
  GROUP_ACTIVITIES: 'group_activities',

  // Contracts
  CONTRACTS: 'contracts',

  // Wallets & Transactions
  WALLETS: 'wallets',
  ENTITY_WALLETS: 'entity_wallets',
  TRANSACTIONS: 'transactions',

  // Payments & Orders
  PAYMENT_INTENTS: 'payment_intents',
  PAYMENT_REQUESTS: 'payment_requests',
  ORDERS: 'orders',
  CONTRIBUTIONS: 'contributions',

  // Timeline
  TIMELINE_EVENTS: 'timeline_events',
  TIMELINE_EVENT_STATS: 'timeline_event_stats',
  TIMELINE_EVENT_VISIBILITY: 'timeline_event_visibility',
  TIMELINE_COMMENTS: 'timeline_comments',
  TIMELINE_LIKES: 'timeline_likes',
  TIMELINE_DISLIKES: 'timeline_dislikes',
  ENRICHED_TIMELINE_EVENTS: 'enriched_timeline_events',
  COMMUNITY_TIMELINE: 'community_timeline_no_duplicates',
  TIMELINE_POSTS: 'timeline_posts',

  // Stakeholder graph (typed edges between projects: customer, collaborator, ...)
  STAKEHOLDER_RELATIONSHIPS: 'stakeholder_relationships',

  // Cache of a user's public GitHub repos (for Cat context)
  GITHUB_REPO_CACHE: 'github_repo_cache',

  // Documents
  USER_DOCUMENTS: 'user_documents',

  // Notifications
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  NOTIFICATION_EMAIL_LOG: 'notification_email_log',

  // System
  AUDIT_LOGS: 'audit_logs',
  CHANNEL_WAITLIST: 'channel_waitlist',
  TYPING_INDICATORS: 'typing_indicators',

  // AI Assistants
  AI_CONVERSATIONS: 'ai_conversations',
  AI_MESSAGES: 'ai_messages',
  AI_USER_CREDITS: 'ai_user_credits',
  AI_CREDIT_TRANSACTIONS: 'ai_credit_transactions',
  AI_CREATOR_EARNINGS: 'ai_creator_earnings',
  AI_CREATOR_WITHDRAWALS: 'ai_creator_withdrawals',
  AI_CREDIT_DEPOSITS: 'ai_credit_deposits',
  USER_API_KEYS: 'user_api_keys',
  USER_AI_PREFERENCES: 'user_ai_preferences',

  // Platform integration (outbound API keys for Loki, hirn.li, ...)
  INTEGRATION_KEYS: 'integration_keys',
  IDEMPOTENCY_RESULTS: 'idempotency_results',
  WEBHOOK_ENDPOINTS: 'webhook_endpoints',
  WEBHOOK_DELIVERIES: 'webhook_deliveries',

  // Bookings
  BOOKINGS: 'bookings',

  // Task Management
  TASKS: 'tasks',
  TASK_COMPLETIONS: 'task_completions',
  TASK_ATTENTION_FLAGS: 'task_attention_flags',
  TASK_REQUESTS: 'task_requests',
  TASK_PROJECTS: 'task_projects',

  // Research
  RESEARCH_ENTITIES: 'research_entities',
  RESEARCH_VOTES: 'research_votes',
  RESEARCH_CONTRIBUTIONS: 'research_contributions',
  RESEARCH_PROGRESS_UPDATES: 'research_progress_updates',

  // Wishlists
  WISHLISTS: 'wishlists',
  WISHLIST_ITEMS: 'wishlist_items',
  WISHLIST_FULFILLMENT_PROOFS: 'wishlist_fulfillment_proofs',
  WISHLIST_FEEDBACK: 'wishlist_feedback',
  WISHLIST_WITH_STATS: 'wishlist_with_stats',

  // Investments
  INVESTMENTS: 'investments',

  // Loans
  LOAN_OFFERS: 'loan_offers',
  LOAN_PAYMENTS: 'loan_payments',
  LOAN_CATEGORIES: 'loan_categories',
  LOAN_COLLATERAL: 'loan_collateral',

  // Cat (AI Assistant)
  CAT_CONVERSATIONS: 'cat_conversations',
  CAT_MESSAGES: 'cat_messages',
  CAT_PERMISSIONS: 'cat_permissions',
  CAT_ACTION_LOG: 'cat_action_log',
  CAT_PENDING_ACTIONS: 'cat_pending_actions',
  CAT_MEMORIES: 'cat_memories',
  CAT_FORGOTTEN_FACTS: 'cat_forgotten_facts',
  COMPANION_MEMORIES: 'companion_memories',
  CAT_WATCHES: 'cat_watches',
  CAT_INTERESTS: 'cat_interests',
  USER_ECONOMIC_PROFILE: 'user_economic_profile',
  USER_ECONOMIC_PROFILE_PUBLIC: 'user_economic_profile_public',
  CAT_CREDIT_ENTRIES: 'cat_credit_entries',
  CAT_CREDIT_TOPUPS: 'cat_credit_topups',

  // Public feedback + Ask Cat (server-only writes; see /api/feedback)
  PLATFORM_FEEDBACK: 'platform_feedback',
  NEWSLETTER_SUBSCRIBERS: 'newsletter_subscribers',

  // Search (aggregate demand signal — server-only)
  SEARCH_QUERIES: 'search_queries',

  // Messaging Views
  MESSAGE_DETAILS: 'message_details',
  CONVERSATION_DETAILS: 'conversation_details',

  // Entity Tables (for direct access when not using entity-registry)
  USER_ASSETS: 'assets',
  AI_ASSISTANTS: 'ai_assistants',

  // Cat nudges
  USER_NUDGES: 'user_nudges',

  // Search / embeddings
  CONTENT_EMBEDDINGS: 'content_embeddings',
  MATCH_INTRODUCTIONS: 'match_introductions',

  // Collaboration
  PROJECT_ROLES: 'project_roles',

  // Plans
  USER_PLANS: 'user_plans',

  // Solon governance (platform allocation policies)
  ALLOCATION_POLICIES: 'allocation_policies',
  SOLON_TRUSTED_KEYS: 'solon_trusted_keys',

  // OAuth provider ("Login with OrangeCat")
  OAUTH_CLIENTS: 'oauth_clients',
  OAUTH_AUTH_CODES: 'oauth_auth_codes',
  OAUTH_REFRESH_TOKENS: 'oauth_refresh_tokens',
  OAUTH_USER_GRANTS: 'oauth_user_grants',
} as const;

// Timeline tables shorthand (for backward compatibility with timeline services)
export const TIMELINE_TABLES = {
  EVENTS: DATABASE_TABLES.TIMELINE_EVENTS,
  EVENT_STATS: DATABASE_TABLES.TIMELINE_EVENT_STATS,
  EVENT_VISIBILITY: DATABASE_TABLES.TIMELINE_EVENT_VISIBILITY,
  COMMENTS: DATABASE_TABLES.TIMELINE_COMMENTS,
  LIKES: DATABASE_TABLES.TIMELINE_LIKES,
  DISLIKES: DATABASE_TABLES.TIMELINE_DISLIKES,
  ENRICHED_EVENTS: DATABASE_TABLES.ENRICHED_TIMELINE_EVENTS,
  ENRICHED_VIEW: DATABASE_TABLES.ENRICHED_TIMELINE_EVENTS,
  COMMUNITY: DATABASE_TABLES.COMMUNITY_TIMELINE,
  COMMUNITY_VIEW: DATABASE_TABLES.COMMUNITY_TIMELINE,
} as const;

/**
 * Supabase Storage Bucket Names
 *
 * SSOT for all storage bucket identifiers. Use these instead of
 * hardcoded strings in supabase.storage.from('...') calls.
 */
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  BANNERS: 'banners',
  PROJECT_MEDIA: 'project-media',
  PROOFS: 'proofs',
  DOCUMENTS: 'documents',
} as const;

/**
 * Every wallets column EXCEPT the write-only secret `nwc_connection_uri`.
 *
 * Client roles have a column-level SELECT grant for exactly this list
 * (migration 20260802120000_wallets_select_lockdown) — `select('*')` on the
 * wallets table therefore fails with permission-denied for anon/authenticated.
 * Use this constant wherever a non-service-role client selects wallet rows.
 */
export const WALLET_CLIENT_COLUMNS =
  'id, profile_id, project_id, user_id, label, description, address_or_xpub, ' +
  'wallet_type, category, category_icon, behavior_type, budget_amount, ' +
  'budget_period, goal_amount, goal_currency, goal_deadline, balance_btc, ' +
  'balance_updated_at, is_active, display_order, is_primary, created_at, ' +
  'updated_at, lightning_address, next_derivation_index';
