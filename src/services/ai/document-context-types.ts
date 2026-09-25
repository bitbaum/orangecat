import type { EconomicProfile } from '@/services/cat/economic-profile';

export interface DocumentContext {
  id: string;
  title: string;
  content: string;
  document_type: string;
  visibility: string;
}

export interface ProfileContext {
  username?: string;
  name?: string;
  bio?: string;
  location_city?: string;
  location_country?: string;
  background?: string;
  website?: string;
}

export interface EntitySummary {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  price_btc?: number;
  category?: string;
  location?: string;
  /** BTC received/raised for this entity (projects, causes, research) */
  raised_btc?: number;
  /** Number of unique supporters/contributors */
  num_supporters?: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  category: string;
  priority: string;
  current_status: string;
  task_type: string;
  schedule_human?: string | null;
  /** ISO timestamp — present on one-time tasks/reminders with a deadline */
  due_date?: string | null;
  /** True if this task was created by the Cat as a reminder (vs a team task) */
  is_reminder?: boolean;
}

export interface WalletSummary {
  label: string;
  description: string | null;
  category: string;
  behavior_type: string;
  goal_amount: number | null;
  goal_currency: string | null;
  goal_deadline: string | null;
  budget_amount: number | null;
  budget_period: string | null;
  is_primary: boolean;
  /** Last-synced on-chain balance in BTC (cached; refreshed from chain, not real-time). */
  balance_btc: number | null;
  /** When balance_btc was last refreshed from the chain. */
  balance_updated_at: string | null;
  /** Whether this wallet has a Nostr Wallet Connect URI configured (can auto-send payments) */
  has_nwc: boolean;
  /** Lightning address for receiving payments, if configured */
  lightning_address: string | null;
}

export interface PaymentCapabilities {
  /** User has at least one wallet with NWC configured — required for send_payment / fund_project actions */
  hasNwcWallet: boolean;
  /** User's primary lightning address (for display / recipient lookup) */
  lightningAddress: string | null;
}

export interface ConversationSummary {
  /** Conversation UUID — use as conversation_id in reply_to_message exec_action */
  id: string;
  /** @username of the other person (null for group chats) */
  other_username: string | null;
  /** Display name of the other person */
  other_name: string | null;
  /** Last message preview (truncated) */
  last_message_preview: string | null;
  /** True if the user sent the last message; false if they received it */
  last_message_is_mine: boolean;
  /** ISO timestamp of last message */
  last_message_at: string | null;
  /** True if there is at least one message the user hasn't read yet */
  has_unread: boolean;
}

/** A completed or recent sale (order where the user is the seller) */
export interface SaleRecord {
  entity_title: string;
  entity_type: string;
  amount_btc: number;
  status: string;
  created_at: string;
}

/** A group the user is a member of (not necessarily the creator) */
export interface GroupMembershipSummary {
  id: string;
  name: string;
  description: string | null;
  label: string;
  role: 'founder' | 'admin' | 'member';
  visibility: 'public' | 'members_only' | 'private';
}

/**
 * A recent activity event about one of the user's projects. Sourced from the
 * timeline_events bus — `source: 'loki'` rows are build updates published
 * by Loki; `'orangecat'` rows are native platform activity.
 */
export interface ProjectActivityEvent {
  projectId: string;
  title: string;
  description: string | null;
  eventType: string;
  source: 'loki' | 'orangecat';
  at: string;
}

/**
 * A typed relationship the user's project has with another party — most
 * importantly "customer" (e.g. Loki built X for this customer).
 */
export interface StakeholderSummary {
  kind: string;
  counterparty: string;
  status: string | null;
}

/** One of the user's public GitHub repositories (cached). */
import type { StudioMapSummary } from './studio-map-fetcher';
import type { LokiProjectStatus } from '@/services/loki/actor-status';
import type { ConnectedGitHub } from '@/services/github/cat-context';

export interface GitHubRepoSummary {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  pushedAt: string;
  fork: boolean;
  archived: boolean;
  /** Only ever true through a connected account; public reads never see these. */
  private?: boolean;
}

/** The user's follow graph — counts plus a few people they follow, for context. */
export interface SocialGraphSummary {
  followers: number;
  following: number;
  /** A handful of accounts the user follows (most recent first), for grounding. */
  recentFollowing: Array<{ username: string | null; name: string | null }>;
}

/**
 * A coalesced group of unread in-app notifications. Repeated alerts with the
 * same title (e.g. the nightly eval harness failing several nights in a row)
 * collapse into one summary with a count, so the Cat sees "×18", not 18 rows.
 */
export interface NotificationSummary {
  type: string;
  title: string;
  message: string;
  /** How many unread notifications share this type+title. */
  count: number;
  /** ISO timestamp of the most recent occurrence. */
  latest_at: string;
  action_url: string | null;
}

/** An upcoming booking where the user is the service/asset provider */
export interface BookingRecord {
  starts_at: string;
  ends_at: string | null;
  status: string;
  customer_display_name: string | null;
  customer_username: string | null;
}

export interface InboundActivity {
  recentSales: SaleRecord[];
  upcomingBookings: BookingRecord[];
}

/**
 * Runtime session context — what's true RIGHT NOW about the user's session.
 * Distinct from the long-lived profile context (entities, wallets, etc.).
 * Used by the Cat to scope prices, language, and recent-activity awareness.
 */
export interface RuntimeContext {
  /** User's chosen display currency (e.g. 'CHF', 'BTC'). Platform default 'CHF'. */
  preferredCurrency: string;
  /** BCP-47 locale string for response language and date formatting (e.g. 'de-CH', 'en-US'). */
  locale: string;
  /** The actor the user is currently operating as. */
  currentActor: {
    /** Actor UUID — owns any entity Cat creates this session. */
    id: string;
    /** Individual user or a group the user belongs to. */
    type: 'individual' | 'group';
    /** Display name of the actor (the user's name, or the group's name). */
    name: string | null;
  } | null;
  /**
   * Path in the product the user was on immediately before opening Cat (if same-origin).
   * Lets Cat reference "the project you were just looking at" instead of starting cold.
   */
  lastVisitedPath?: string;
  /**
   * The page the user is looking at RIGHT NOW, when Cat is opened as a global
   * overlay on top of a page (not the standalone Cat hub). Makes Cat aware of
   * "this project / this article" the user is currently viewing.
   */
  currentPath?: string;
  /** The entity the current page is about, if recognised (type + id/slug). */
  currentEntity?: { type: string; ref: string };
  /**
   * Verbatim excerpt of what's visible on the current page. App surfaces
   * (settings, wallet, pricing) have no lookup tool — this is the only way
   * Cat can describe the actual page instead of a hallucinated one.
   */
  pageExcerpt?: string;
  /**
   * Live BTC exchange-rate snapshot so Cat quotes real numbers for BTC⇄fiat
   * conversions instead of recalling a stale rate from training data.
   */
  btcRate?: { currency: string; rate: number } | null;
}

export interface FullUserContext {
  profile: ProfileContext | null;
  /**
   * Structured latent economic value (skills, assets, goals, constraints, what
   * people ask them for) — the keystone of the economic agent. Optional: only the
   * full Cat context fetch populates it; null/empty until the user is interviewed.
   */
  economicProfile?: EconomicProfile | null;
  /**
   * Durable facts Cat remembers about this user, recalled semantically for the
   * CURRENT message (see cat/memory.ts). Optional: only the chat path populates
   * it; other context consumers leave it undefined.
   */
  memories?: Array<{ content: string }>;
  documents: DocumentContext[];
  entities: EntitySummary[];
  tasks: TaskSummary[];
  wallets: WalletSummary[];
  conversations: ConversationSummary[];
  /**
   * Unread in-app notifications, coalesced by title. Optional: only the full
   * Cat context fetch populates it; other consumers leave it undefined.
   */
  notifications?: NotificationSummary[];
  /**
   * Exact unread count — the number the bell shows. `notifications` is only
   * the newest rows coalesced, so its counts must never be summed into a total.
   */
  notificationsUnread?: number;
  inboundActivity: InboundActivity;
  memberGroups: GroupMembershipSummary[];
  socialGraph: SocialGraphSummary;
  projectActivity: ProjectActivityEvent[];
  stakeholders: StakeholderSummary[];
  githubRepos: GitHubRepoSummary[];
  /** The studio map from Loki (every bitbaum project: purpose, state,
   *  doors, last movement). Optional: absent or null when Loki is unreachable. */
  studioMap?: StudioMapSummary | null;
  /** This person's projects as Loki sees them (status, live site, feedback).
   *  Optional: absent or null when Loki is unreachable or not linked. */
  lokiProjects?: LokiProjectStatus[] | null;
  /** Through a connected GitHub account: assigned issues + latest releases.
   *  Optional: absent or null when GitHub is not connected. */
  githubWork?: Pick<ConnectedGitHub, 'login' | 'assignedIssues' | 'releases'> | null;
  paymentCapabilities: PaymentCapabilities;
  /**
   * Outcome feedback loop: what actually happened to the entities Cat created
   * with this user (published? funded?), derived from cat_action_log + entity
   * state + settled payments. Optional: only the full Cat context fetch
   * populates it; null when the signal is unavailable.
   */
  trackRecord?: import('@/services/cat/track-record').CatTrackRecord | null;
  /** Runtime session context — what's true RIGHT NOW. See RuntimeContext for fields. */
  runtime: RuntimeContext;
  stats: {
    totalProducts: number;
    totalServices: number;
    totalProjects: number;
    totalCauses: number;
    totalEvents: number;
    totalAssets: number;
    totalLoans: number;
    totalInvestments: number;
    totalResearch: number;
    totalWishlists: number;
    totalTasks: number;
    urgentTasks: number;
    totalWallets: number;
  };
}
