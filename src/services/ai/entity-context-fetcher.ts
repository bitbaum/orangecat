import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import type { EntitySummary, FullUserContext } from './document-context-types';
import { getUserActorId } from '@/domain/actors';

type AnyQuery = any;

async function fetchEntityBatch(
  supabase: AnySupabaseClient,
  opts: {
    entityType: string;
    tableName: string;
    select: string;
    filterField: string;
    filterValue: string;
    statuses?: string[];
    extraWhere?: (q: AnyQuery) => AnyQuery;
  },
  map: (row: Record<string, unknown>) => EntitySummary
): Promise<EntitySummary[]> {
  let q = (supabase as any)
    .from(opts.tableName)
    .select(opts.select)
    .eq(opts.filterField, opts.filterValue);
  if (opts.statuses) {
    q = q.in('status', opts.statuses);
  }
  if (opts.extraWhere) {
    q = opts.extraWhere(q);
  }
  const { data, error } = await q.limit(20);
  if (error) {
    logger.warn(
      `Failed to fetch ${opts.entityType} for cat`,
      { error: error.message },
      'DocumentContext'
    );
    return [];
  }
  return ((data as Record<string, unknown>[]) || []).map(map);
}

// Entity-specific status sets for Cat context queries (excludes terminal/hidden statuses)
const PRODUCT_STATUSES = [STATUS.PRODUCTS.DRAFT, STATUS.PRODUCTS.ACTIVE, STATUS.PRODUCTS.PAUSED];
const SERVICE_STATUSES = [STATUS.SERVICES.DRAFT, STATUS.SERVICES.ACTIVE, STATUS.SERVICES.PAUSED];
const PROJECT_STATUSES = [
  STATUS.PROJECTS.DRAFT,
  STATUS.PROJECTS.ACTIVE,
  STATUS.PROJECTS.PAUSED,
  STATUS.PROJECTS.COMPLETED,
];
const CAUSE_STATUSES = [STATUS.CAUSES.DRAFT, STATUS.CAUSES.ACTIVE, STATUS.CAUSES.COMPLETED];
const ASSET_STATUSES = [STATUS.ASSETS.DRAFT, STATUS.ASSETS.ACTIVE];
const RESEARCH_STATUSES = [
  STATUS.RESEARCH.DRAFT,
  STATUS.RESEARCH.ACTIVE,
  STATUS.RESEARCH.PAUSED,
  STATUS.RESEARCH.COMPLETED,
];

export async function fetchEntitiesForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<{ entities: EntitySummary[]; stats: FullUserContext['stats'] }> {
  const stats = {
    totalProducts: 0,
    totalServices: 0,
    totalProjects: 0,
    totalCauses: 0,
    totalEvents: 0,
    totalAssets: 0,
    totalLoans: 0,
    totalInvestments: 0,
    totalResearch: 0,
    totalWishlists: 0,
    totalTasks: 0,
    urgentTasks: 0,
    totalWallets: 0,
  };
  const entities: EntitySummary[] = [];

  try {
    const actorId = await getUserActorId(supabase, userId);

    if (!actorId) {
      logger.warn(
        'Could not find actor for user when fetching entities',
        { userId },
        'DocumentContext'
      );
      return { entities, stats };
    }

    const d = (r: Record<string, unknown>) =>
      (r.description as string | undefined)?.substring(0, 300);

    const products = await fetchEntityBatch(
      supabase,
      {
        entityType: 'product',
        tableName: ENTITY_REGISTRY.product.tableName,
        select: 'id, title, description, status, price',
        filterField: 'actor_id',
        filterValue: actorId,
        statuses: PRODUCT_STATUSES,
      },
      r => ({
        id: r.id as string,
        type: 'product',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        price_btc: r.price as number | undefined,
      })
    );
    stats.totalProducts = products.length;
    entities.push(...products);

    const services = await fetchEntityBatch(
      supabase,
      {
        entityType: 'service',
        tableName: ENTITY_REGISTRY.service.tableName,
        select: 'id, title, description, status, hourly_rate, fixed_price',
        filterField: 'actor_id',
        filterValue: actorId,
        statuses: SERVICE_STATUSES,
      },
      r => ({
        id: r.id as string,
        type: 'service',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        price_btc: (r.fixed_price as number) || (r.hourly_rate as number) || undefined,
      })
    );
    stats.totalServices = services.length;
    entities.push(...services);

    const projects = await fetchEntityBatch(
      supabase,
      {
        entityType: 'project',
        tableName: ENTITY_REGISTRY.project.tableName,
        select: 'id, title, description, status, goal_amount',
        filterField: 'actor_id',
        filterValue: actorId,
        statuses: PROJECT_STATUSES,
      },
      r => ({
        id: r.id as string,
        type: 'project',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        price_btc: r.goal_amount as number | undefined,
      })
    );
    stats.totalProjects = projects.length;
    entities.push(...projects);

    const causes = await fetchEntityBatch(
      supabase,
      {
        entityType: 'cause',
        tableName: ENTITY_REGISTRY.cause.tableName,
        select: 'id, title, description, status, cause_category, goal_amount',
        filterField: 'actor_id',
        filterValue: actorId,
        statuses: CAUSE_STATUSES,
      },
      r => ({
        id: r.id as string,
        type: 'cause',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        category: r.cause_category as string | undefined,
        price_btc: r.goal_amount as number | undefined,
      })
    );
    stats.totalCauses = causes.length;
    entities.push(...causes);

    const events = await fetchEntityBatch(
      supabase,
      {
        entityType: 'event',
        tableName: ENTITY_REGISTRY.event.tableName,
        select: 'id, title, description, status, venue_name, venue_city, venue_country',
        filterField: 'actor_id',
        filterValue: actorId,
        statuses: [
          STATUS.EVENTS.DRAFT,
          STATUS.EVENTS.PUBLISHED,
          STATUS.EVENTS.OPEN,
          STATUS.EVENTS.FULL,
          STATUS.EVENTS.ONGOING,
        ],
      },
      r => ({
        id: r.id as string,
        type: 'event',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        location:
          [r.venue_name, r.venue_city, r.venue_country].filter(Boolean).join(', ') || undefined,
      })
    );
    stats.totalEvents = events.length;
    entities.push(...events);

    const assets = await fetchEntityBatch(
      supabase,
      {
        entityType: 'asset',
        tableName: ENTITY_REGISTRY.asset.tableName,
        select: 'id, title, description, status, location, estimated_value',
        filterField: 'actor_id',
        filterValue: actorId,
        statuses: ASSET_STATUSES,
      },
      r => ({
        id: r.id as string,
        type: 'asset',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        price_btc: r.estimated_value as number | undefined,
        location: r.location as string | undefined,
      })
    );
    stats.totalAssets = assets.length;
    entities.push(...assets);

    // loans: show non-terminal statuses only
    const loans = await fetchEntityBatch(
      supabase,
      {
        entityType: 'loan',
        tableName: ENTITY_REGISTRY.loan.tableName,
        select: 'id, title, description, status, original_amount, interest_rate',
        filterField: 'actor_id',
        filterValue: actorId,
        statuses: [STATUS.LOANS.DRAFT, STATUS.LOANS.ACTIVE],
      },
      r => ({
        id: r.id as string,
        type: 'loan',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        price_btc: r.original_amount as number | undefined,
        category:
          r.interest_rate !== null && r.interest_rate !== undefined
            ? `${r.interest_rate}% interest`
            : undefined,
      })
    );
    stats.totalLoans = loans.length;
    entities.push(...loans);

    // investments: non-terminal statuses (exclude closed/cancelled)
    const investments = await fetchEntityBatch(
      supabase,
      {
        entityType: 'investment',
        tableName: ENTITY_REGISTRY.investment.tableName,
        select: 'id, title, description, status, investment_type, target_amount',
        filterField: 'actor_id',
        filterValue: actorId,
        statuses: [
          STATUS.INVESTMENTS.DRAFT,
          STATUS.INVESTMENTS.OPEN,
          STATUS.INVESTMENTS.ACTIVE,
          STATUS.INVESTMENTS.FUNDED,
        ],
      },
      r => ({
        id: r.id as string,
        type: 'investment',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        price_btc: r.target_amount as number | undefined,
        category: r.investment_type as string | undefined,
      })
    );
    stats.totalInvestments = investments.length;
    entities.push(...investments);

    // research: uses user_id (references profiles), NOT actor_id
    const research = await fetchEntityBatch(
      supabase,
      {
        entityType: 'research',
        tableName: ENTITY_REGISTRY.research.tableName,
        select: 'id, title, description, status, field, funding_goal_btc, funding_raised_btc',
        filterField: 'user_id',
        filterValue: userId,
        statuses: RESEARCH_STATUSES,
      },
      r => ({
        id: r.id as string,
        type: 'research',
        title: r.title as string,
        description: d(r),
        status: r.status as string,
        price_btc: r.funding_goal_btc as number | undefined,
        category: r.field as string | undefined,
        raised_btc:
          (r.funding_raised_btc as number) > 0 ? (r.funding_raised_btc as number) : undefined,
      })
    );
    stats.totalResearch = research.length;
    entities.push(...research);

    // wishlists: no status column — filter by is_active instead
    const wishlists = await fetchEntityBatch(
      supabase,
      {
        entityType: 'wishlist',
        tableName: ENTITY_REGISTRY.wishlist.tableName,
        select: 'id, title, description, type, visibility',
        filterField: 'actor_id',
        filterValue: actorId,
        extraWhere: q => q.eq('is_active', true),
      },
      r => ({
        id: r.id as string,
        type: 'wishlist',
        title: r.title as string,
        description: d(r),
        status: r.visibility as string,
        category: r.type as string | undefined,
      })
    );
    stats.totalWishlists = wishlists.length;
    entities.push(...wishlists);

    // Enrich projects with funding stats from project_support_stats view.
    const projectIds = entities.filter(e => e.type === 'project').map(e => e.id);
    if (projectIds.length > 0) {
      const { data: supportStats } = await supabase
        .from(DATABASE_TABLES.PROJECT_SUPPORT_STATS)
        .select('project_id, total_bitcoin_btc, total_supporters')
        .in('project_id', projectIds);

      if (supportStats && supportStats.length > 0) {
        const statsMap = new Map(
          supportStats.map(
            (s: { project_id: string; total_bitcoin_btc: number; total_supporters: number }) => [
              s.project_id,
              { raised: s.total_bitcoin_btc, supporters: s.total_supporters },
            ]
          )
        );
        entities.forEach(e => {
          if (e.type === 'project') {
            const s = statsMap.get(e.id);
            if (s && s.raised > 0) {
              e.raised_btc = s.raised;
              e.num_supporters = s.supporters;
            }
          }
        });
      }
    }

    logger.info(
      'Fetched entities for cat',
      { userId, actorId, stats, totalEntities: entities.length },
      'DocumentContext'
    );

    return { entities, stats };
  } catch (error) {
    logger.error('Exception fetching entities for cat', error, 'DocumentContext');
    return { entities, stats };
  }
}
