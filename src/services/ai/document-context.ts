/**
 * Comprehensive Context Service for My Cat AI
 *
 * Orchestrates fetching all relevant context for personalized AI responses.
 * Sub-modules handle specific concerns:
 *   - document-context-types.ts — shared interfaces
 *   - entity-context-fetcher.ts — entity data (products, services, projects, …)
 *   - social-context-fetcher.ts — conversations, inbound activity, group memberships
 *   - context-string-builder.ts — format context as a prompt string
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fetchStudioMapForCat } from './studio-map-fetcher';
import { fetchLokiActorStatus, type LokiProjectStatus } from '@/services/loki/actor-status';
import { logger } from '@/utils/logger';
import { getAdminClient } from '@/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { isCatHubPath } from '@/config/routes';
import { PAGE_EXCERPT_MAX_CHARS } from '@/config/cat-page-context';

import type {
  DocumentContext,
  ProfileContext,
  WalletSummary,
  TaskSummary,
  PaymentCapabilities,
  FullUserContext,
  RuntimeContext,
} from './document-context-types';
import { isSupportedCurrency, PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { convertBtcToOrNull } from '@/services/currency/rates.server';

import { fetchEntitiesForCat } from './entity-context-fetcher';
import { getEconomicProfile } from '@/services/cat/economic-profile';
import { getCatTrackRecord } from '@/services/cat/track-record';
import {
  fetchConversationsForCat,
  fetchInboundActivityForCat,
  fetchGroupMembershipsForCat,
  fetchSocialGraphForCat,
} from './social-context-fetcher';
import { fetchProjectActivityForCat, fetchStakeholdersForCat } from './project-activity-fetcher';
import { fetchGitHubReposForCat } from './github-repos-fetcher';
import { fetchNotificationsForCat } from './notification-context-fetcher';
import { countUnreadNotifications } from '@/services/notifications/unread-count';
import { getUserActorId } from '@/domain/actors';

// Re-export types so existing callers stay unchanged
export type {
  DocumentContext,
  ProfileContext,
  EntitySummary,
  TaskSummary,
  WalletSummary,
  PaymentCapabilities,
  ConversationSummary,
  SaleRecord,
  GroupMembershipSummary,
  BookingRecord,
  InboundActivity,
  NotificationSummary,
  SocialGraphSummary,
  ProjectActivityEvent,
  StakeholderSummary,
  GitHubRepoSummary,
  FullUserContext,
  RuntimeContext,
} from './document-context-types';

// Re-export string builders so existing callers stay unchanged
export { buildFullContextString } from './context-string-builder';

// Re-export entity fetcher so callers can import directly if needed
export { fetchEntitiesForCat } from './entity-context-fetcher';

// Re-export social fetchers
export {
  fetchConversationsForCat,
  fetchInboundActivityForCat,
  fetchGroupMembershipsForCat,
  fetchSocialGraphForCat,
} from './social-context-fetcher';

// Re-export project-activity / stakeholder fetchers
export { fetchProjectActivityForCat, fetchStakeholdersForCat } from './project-activity-fetcher';

// Re-export GitHub repos fetcher
export { fetchGitHubReposForCat } from './github-repos-fetcher';

// Re-export notifications fetcher
export { fetchNotificationsForCat } from './notification-context-fetcher';

async function fetchDocumentsForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<DocumentContext[]> {
  try {
    const actorId = await getUserActorId(supabase, userId);

    if (!actorId) {
      logger.warn('Could not find actor for user', { userId }, 'DocumentContext');
      return [];
    }

    const { data: documents, error: docsError } = await supabase
      .from(ENTITY_REGISTRY.document.tableName)
      .select('id, title, content, document_type, visibility')
      .eq('actor_id', actorId)
      .in('visibility', ['cat_visible', 'public'])
      .order('document_type', { ascending: true });

    if (docsError) {
      logger.error('Failed to fetch documents for cat', docsError, 'DocumentContext');
      return [];
    }

    return (documents || []) as DocumentContext[];
  } catch (error) {
    logger.error('Exception fetching documents for cat', error, 'DocumentContext');
    return [];
  }
}

async function fetchProfileForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ProfileContext | null> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, name, bio, location_city, location_country, background, website')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return null;
    }

    return {
      username: profile.username,
      name: profile.name,
      bio: profile.bio,
      location_city: profile.location_city,
      location_country: profile.location_country,
      background: profile.background,
      website: profile.website,
    };
  } catch (error) {
    logger.error('Exception fetching profile for cat', error, 'DocumentContext');
    return null;
  }
}

async function fetchWalletsForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<WalletSummary[]> {
  try {
    const { data: profile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return [];
    }

    // No client-role SELECT grant on nwc_connection_uri (write-only secret);
    // the Cat only needs presence, so read via service role and never let the
    // encrypted value into the context assembly.
    const { data: wallets, error } = await (getAdminClient() as unknown as SupabaseClient)
      .from(DATABASE_TABLES.WALLETS)
      .select(
        'label, description, category, behavior_type, goal_amount, goal_currency, goal_deadline, budget_amount, budget_period, is_primary, balance_btc, balance_updated_at, nwc_connection_uri, lightning_address'
      )
      .eq('profile_id', profile.id)
      .eq('is_active', true)
      .limit(20);

    if (error) {
      logger.warn('Failed to fetch wallets for cat', { error: error.message }, 'DocumentContext');
      return [];
    }

    return (wallets || []).map(w => ({
      label: w.label,
      description: w.description,
      category: w.category,
      behavior_type: w.behavior_type,
      goal_amount: w.goal_amount,
      goal_currency: w.goal_currency,
      goal_deadline: w.goal_deadline,
      budget_amount: w.budget_amount,
      budget_period: w.budget_period,
      is_primary: w.is_primary,
      balance_btc: w.balance_btc ?? null,
      balance_updated_at: w.balance_updated_at ?? null,
      has_nwc: !!w.nwc_connection_uri,
      lightning_address: w.lightning_address ?? null,
    })) as WalletSummary[];
  } catch (error) {
    logger.error('Exception fetching wallets for cat', error, 'DocumentContext');
    return [];
  }
}

async function fetchTasksForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<TaskSummary[]> {
  try {
    const { data: tasks, error } = await supabase
      .from(DATABASE_TABLES.TASKS)
      .select(
        'id, title, category, priority, current_status, task_type, schedule_human, due_date, is_reminder'
      )
      .eq('created_by', userId)
      .eq('is_archived', false)
      .eq('is_completed', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: false })
      .limit(30);

    if (error) {
      logger.warn('Failed to fetch tasks for cat', { error: error.message }, 'DocumentContext');
      return [];
    }

    return (tasks || []) as TaskSummary[];
  } catch (error) {
    logger.error('Exception fetching tasks for cat', error, 'DocumentContext');
    return [];
  }
}

/**
 * Client-provided hints about the user's current session.
 * Fully optional — when absent, we fall back to safe defaults (platform currency,
 * en-US locale, individual actor). Server never trusts these for security-critical
 * decisions; they only flavor how Cat phrases responses and which prices it quotes.
 */
export interface RuntimeContextHints {
  /** ISO currency code from client (e.g. 'CHF'). Validated server-side. */
  preferredCurrency?: string;
  /** BCP-47 locale (e.g. 'de-CH'). Free text but expected to look like a locale. */
  locale?: string;
  /** Same-origin path of the page user came from. Stripped if it looks unsafe. */
  lastVisitedPath?: string;
  /** Same-origin path of the page the user is on NOW (global Cat overlay). */
  currentPath?: string;
  /** Entity the current page is about, if the client recognised one. */
  currentEntity?: { type: string; ref: string };
  /** Visible-page excerpt captured by the client. Only kept when currentPath is valid. */
  pageExcerpt?: string;
}

/**
 * Sanitize a path string. Accepts only absolute same-origin paths (starting with '/').
 * Caps length to 200 chars. Returns undefined for anything that doesn't look right —
 * we'd rather omit the field than feed Cat garbage.
 */
function sanitizeLastVisitedPath(path: string | undefined): string | undefined {
  if (!path || typeof path !== 'string') {
    return undefined;
  }
  if (!path.startsWith('/') || path.startsWith('//')) {
    return undefined;
  }
  if (path.length > 200) {
    return undefined;
  }
  // Avoid pushing the Cat page itself back into the prompt as "where you came from".
  if (isCatHubPath(path)) {
    return undefined;
  }
  return path;
}

/**
 * Sanitize the client-supplied "currently viewing" entity. Both fields are short
 * and URL-safe; anything else is dropped rather than fed to Cat.
 */
function sanitizeCurrentEntity(
  entity: { type?: unknown; ref?: unknown } | undefined
): { type: string; ref: string } | undefined {
  if (!entity || typeof entity.type !== 'string' || typeof entity.ref !== 'string') {
    return undefined;
  }
  const type = entity.type.trim().slice(0, 32);
  const ref = entity.ref.trim().slice(0, 120);
  if (!/^[a-z_]+$/i.test(type) || !ref) {
    return undefined;
  }
  return { type, ref };
}

async function fetchRuntimeContextForCat(
  supabase: AnySupabaseClient,
  userId: string,
  hints: RuntimeContextHints | undefined,
  profile: ProfileContext | null
): Promise<RuntimeContext> {
  // Currency: validate client hint against supported list; fall back to platform default.
  const candidateCurrency = hints?.preferredCurrency;
  const preferredCurrency =
    candidateCurrency && isSupportedCurrency(candidateCurrency)
      ? candidateCurrency
      : PLATFORM_DEFAULT_CURRENCY;

  // Locale: accept anything that looks like BCP-47 (letters and one optional '-region').
  // Default to 'en-US' — keeps existing date-format behavior when no hint provided.
  const candidateLocale = hints?.locale;
  const locale =
    candidateLocale && /^[a-z]{2,3}(-[a-zA-Z0-9]{2,4})?$/i.test(candidateLocale)
      ? candidateLocale
      : 'en-US';

  const lastVisitedPath = sanitizeLastVisitedPath(hints?.lastVisitedPath);
  const currentPath = sanitizeLastVisitedPath(hints?.currentPath);
  const currentEntity = currentPath ? sanitizeCurrentEntity(hints?.currentEntity) : undefined;
  // Excerpt only makes sense anchored to a valid current page; strip control
  // chars (keep newlines) and re-cap server-side — the client is untrusted.
  const rawExcerpt = currentPath && typeof hints?.pageExcerpt === 'string' ? hints.pageExcerpt : '';
  const cleanedExcerpt = rawExcerpt
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .trim()
    .slice(0, PAGE_EXCERPT_MAX_CHARS + 1);
  const pageExcerpt = cleanedExcerpt || undefined;

  // Current actor: for Tier 1 we always use the individual actor. Group-context
  // switching plumbs through later (Tier 5), with its own server-side validation
  // that the user is actually a member.
  let currentActor: RuntimeContext['currentActor'] = null;
  try {
    const { data: actorRow } = await supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('id, actor_type')
      .eq('actor_type', 'user')
      .eq('user_id', userId)
      .maybeSingle();
    if (actorRow?.id) {
      currentActor = {
        id: actorRow.id,
        type: 'individual',
        name: profile?.name ?? profile?.username ?? null,
      };
    }
  } catch (error) {
    logger.warn('Could not resolve current actor for cat runtime', { error }, 'DocumentContext');
  }

  // Live BTC price so Cat quotes real conversions instead of recalling a stale
  // training-data rate. Non-fatal: on failure Cat just omits the rate line and
  // is instructed (in the system prompt) not to invent one.
  let btcRate: RuntimeContext['btcRate'] = null;
  try {
    // Ask for the currency the user actually thinks in, and fall back to the
    // platform default only if that one is unknown. Omitting the line entirely
    // is the correct outcome when we have no rate — Cat is told not to invent
    // one, and a made-up rate quoted with confidence is worse than silence.
    const fiat = preferredCurrency === 'BTC' ? 'CHF' : preferredCurrency.toUpperCase();
    const rate = await convertBtcToOrNull(1, fiat);
    if (rate !== null && rate > 0) {
      btcRate = { currency: fiat, rate };
    } else {
      const chf = await convertBtcToOrNull(1, 'CHF');
      btcRate = chf !== null && chf > 0 ? { currency: 'CHF', rate: chf } : null;
    }
  } catch (error) {
    logger.warn('Could not fetch BTC rate for cat runtime', { error }, 'DocumentContext');
  }

  return {
    preferredCurrency,
    locale,
    currentActor,
    lastVisitedPath,
    currentPath,
    currentEntity,
    pageExcerpt,
    btcRate,
  };
}

export async function fetchFullContextForCat(
  supabase: AnySupabaseClient,
  userId: string,
  runtimeHints?: RuntimeContextHints
): Promise<FullUserContext> {
  const [
    profile,
    documents,
    { entities, stats },
    tasks,
    wallets,
    conversations,
    notifications,
    notificationsUnread,
    inboundActivity,
    memberGroups,
    socialGraph,
    projectActivity,
    stakeholders,
    githubRepos,
    economicProfile,
    trackRecord,
    studioMap,
    lokiProjects,
  ] = await Promise.all([
    fetchProfileForCat(supabase, userId),
    fetchDocumentsForCat(supabase, userId),
    fetchEntitiesForCat(supabase, userId),
    fetchTasksForCat(supabase, userId),
    fetchWalletsForCat(supabase, userId),
    fetchConversationsForCat(supabase, userId),
    fetchNotificationsForCat(supabase, userId),
    countUnreadNotifications(supabase, userId).catch(() => undefined),
    fetchInboundActivityForCat(supabase, userId),
    fetchGroupMembershipsForCat(supabase, userId),
    fetchSocialGraphForCat(supabase, userId),
    fetchProjectActivityForCat(supabase, userId),
    fetchStakeholdersForCat(supabase, userId),
    fetchGitHubReposForCat(supabase, userId),
    getEconomicProfile(supabase, userId),
    getCatTrackRecord(supabase, userId),
    fetchStudioMapForCat(),
    fetchLokiProjectsForCat(supabase, userId),
  ]);

  const runtime = await fetchRuntimeContextForCat(supabase, userId, runtimeHints, profile);

  const urgentTasks = tasks.filter(
    t => t.priority === 'urgent' || t.current_status === 'needs_attention'
  ).length;

  const paymentCapabilities: PaymentCapabilities = {
    hasNwcWallet: wallets.some(w => w.has_nwc),
    lightningAddress: wallets.find(w => w.lightning_address)?.lightning_address ?? null,
  };

  return {
    profile,
    economicProfile,
    trackRecord,
    documents,
    entities,
    tasks,
    wallets,
    conversations,
    notifications,
    notificationsUnread,
    inboundActivity,
    memberGroups,
    socialGraph,
    projectActivity,
    stakeholders,
    githubRepos,
    studioMap,
    lokiProjects,
    paymentCapabilities,
    runtime,
    stats: {
      ...stats,
      totalTasks: tasks.length,
      urgentTasks,
      totalWallets: wallets.length,
    },
  };
}

/**
 * The person's Loki projects, keyed by their OrangeCat actor — the Loki half
 * of the two-way rail (see services/loki/actor-status). null when unknown or
 * when they have never signed in to Loki with OrangeCat.
 */
async function fetchLokiProjectsForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<LokiProjectStatus[] | null> {
  try {
    const actorId = await getUserActorId(supabase, userId);
    if (!actorId) {
      return null;
    }
    const status = await fetchLokiActorStatus(actorId);
    return status?.linked ? status.projects : null;
  } catch (error) {
    logger.warn('Loki projects unavailable for Cat', { error }, 'DocumentContext');
    return null;
  }
}
