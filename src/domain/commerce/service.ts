import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import type { UserProduct, UserService, UserCause } from '@/types/database';
import { STATUS } from '@/config/database-constants';
import { getUserActorId } from '@/domain/actors';
import { createEntity } from '@/domain/base/entityService';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';

// Table type - using entity registry table names
// Accept string to allow dynamic table names from entity registry
type Table = string;

interface ListParams {
  limit?: number;
  offset?: number;
  category?: string | null;
  userId?: string | null;
  includeOwnDrafts?: boolean;
}

export async function listEntitiesPage(
  table: Table,
  params: ListParams & { limit: number; offset: number }
) {
  // One code path serves every entity table, so the table name and several of
  // the filtered columns are only known at runtime — see `looseClient`.
  const supabase = looseClient(await createServerClient());
  const { limit, offset, category, userId, includeOwnDrafts } = params;

  // base query for items - dynamic table access for entity registry pattern
  let itemsQuery = supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // base query for count (head=true) - dynamic table access
  let countQuery = supabase.from(table).select('*', { count: 'exact', head: true });

  // Sandbox isolation: this helper is the anonymous + session-auth read
  // path. Test entities (is_test=true) are only visible via sandbox
  // integration keys, which take a different code path in
  // entityListHandler. Anonymous + session reads always show live data.
  itemsQuery = itemsQuery.eq('is_test', false);
  countQuery = countQuery.eq('is_test', false);

  // Circles table doesn't have a 'status' column like commerce tables
  const isCirclesTable = table === 'circles';

  // Resolve user_id to actor_id for ownership filtering (if userId provided)
  let actorId: string | null = null;
  if (userId) {
    // GET/list paths do not provision actors. No actor means this owner has no
    // commerce rows yet; creation flows still provision through createEntity.
    actorId = await getUserActorId(supabase, userId);
    if (!actorId) {
      return { items: [], total: 0, limit, offset };
    }
  }

  if (userId && includeOwnDrafts && actorId) {
    itemsQuery = itemsQuery.eq('actor_id', actorId);
    countQuery = countQuery.eq('actor_id', actorId);
  } else if (isCirclesTable) {
    // For circles, filter by visibility and created_by for user filtering
    itemsQuery = itemsQuery.eq('visibility', 'public');
    countQuery = countQuery.eq('visibility', 'public');
    if (userId) {
      itemsQuery = itemsQuery.eq('created_by', userId);
      countQuery = countQuery.eq('created_by', userId);
    }
    if (category) {
      itemsQuery = itemsQuery.eq('category', category);
      countQuery = countQuery.eq('category', category);
    }
  } else {
    // For commerce tables (user_products, user_services, user_causes)
    itemsQuery = itemsQuery.eq('status', STATUS.PRODUCTS.ACTIVE);
    countQuery = countQuery.eq('status', STATUS.PRODUCTS.ACTIVE);

    if (actorId) {
      itemsQuery = itemsQuery.eq('actor_id', actorId);
      countQuery = countQuery.eq('actor_id', actorId);
    }
    if (category) {
      itemsQuery = itemsQuery.eq('category', category);
      countQuery = countQuery.eq('category', category);
    }
  }

  const [{ data: items, error: itemsError }, { count: _count, error: countError }] =
    await Promise.all([itemsQuery, countQuery]);
  if (itemsError) {
    throw itemsError;
  }
  if (countError) {
    throw countError;
  }

  // Filter out example/test data after fetching
  // FUTURE: Add is_example boolean column to entity tables and filter at query level — requires a DB migration; current title-based filtering is a temporary workaround
  const exampleTitles = ["Assassin's Creed", 'Example Service', 'Test Service', 'Sample Service'];
  const filteredItems = ((items || []) as Record<string, unknown>[]).filter(item => {
    // Rows come back column-agnostic (the table varies): some entities title the
    // record `title`, some `name`.
    const title = typeof item.title === 'string' ? item.title : String(item.name ?? '');
    return !exampleTitles.some(exampleTitle =>
      title.toLowerCase().includes(exampleTitle.toLowerCase())
    );
  });

  return { items: filteredItems, total: filteredItems.length, limit, offset };
}

interface CreateProductInput {
  title: string;
  description?: string | null;
  price: number;
  currency?: 'BTC' | 'USD' | 'EUR' | 'CHF';
  product_type?: 'physical' | 'digital' | 'service';
  images?: string[];
  thumbnail_url?: string | null;
  inventory_count?: number;
  fulfillment_type?: 'manual' | 'automatic' | 'digital';
  category?: string | null;
  tags?: string[];
  is_featured?: boolean;
  show_on_profile?: boolean;
}

interface AvailabilitySchedule {
  days?: string[];
  hours?: { start: string; end: string }[];
  timezone?: string;
  [key: string]: unknown;
}

interface CreateServiceInput {
  title: string;
  description?: string | null;
  category: string;
  hourly_rate?: number | null;
  fixed_price?: number | null;
  currency?: 'BTC' | 'USD' | 'EUR' | 'CHF';
  duration_minutes?: number | null;
  availability_schedule?: AvailabilitySchedule;
  service_location_type?: 'remote' | 'onsite' | 'both';
  service_area?: string | null;
  images?: string[];
  portfolio_links?: string[];
  show_on_profile?: boolean;
}

export async function createProduct(
  userId: string,
  input: CreateProductInput
): Promise<UserProduct> {
  // Always write to DB unless explicitly overridden with PRODUCTS_WRITE_MODE=mock
  const mode = process.env.PRODUCTS_WRITE_MODE || 'db';
  if (mode === 'mock') {
    throw new Error('Mock mode is disabled by policy. Set PRODUCTS_WRITE_MODE=db');
  }

  return createEntity<UserProduct>(
    'product',
    userId,
    {
      user_id: userId,
      status: STATUS.PRODUCTS.DRAFT as typeof STATUS.PRODUCTS.DRAFT,
      currency: input.currency ?? PLATFORM_DEFAULT_CURRENCY,
      product_type: input.product_type ?? 'physical',
      images: input.images ?? [],
      thumbnail_url: input.thumbnail_url ?? null,
      inventory_count: input.inventory_count ?? -1,
      fulfillment_type: input.fulfillment_type ?? 'manual',
      category: input.category,
      tags: input.tags ?? [],
      is_featured: input.is_featured ?? false,
      // Respect the form's profile-visibility toggle; DB default (true) would
      // otherwise always win and ignore an unchecked box.
      show_on_profile: input.show_on_profile ?? true,
      title: input.title,
      description: input.description ?? null,
      price: input.price,
    },
    {
      client: createAdminClient(),
    }
  );
}

export async function createService(
  userId: string,
  input: CreateServiceInput
): Promise<UserService> {
  return createEntity<UserService>(
    'service',
    userId,
    {
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      hourly_rate: input.hourly_rate ?? null,
      fixed_price: input.fixed_price ?? null,
      currency: input.currency ?? 'CHF',
      duration_minutes: input.duration_minutes ?? null,
      availability_schedule: input.availability_schedule,
      service_location_type: input.service_location_type ?? 'remote',
      service_area: input.service_area ?? null,
      images: input.images ?? [],
      portfolio_links: input.portfolio_links ?? [],
      // Respect the form's profile-visibility toggle at create time (the schema
      // already carries it, but this insert previously omitted it → DB default
      // true always won).
      show_on_profile: input.show_on_profile ?? true,
      status: STATUS.SERVICES.DRAFT as typeof STATUS.SERVICES.DRAFT,
    },
    {
      client: createAdminClient(),
    }
  );
}

interface DistributionRules {
  type?: 'equal' | 'weighted' | 'custom';
  allocations?: Record<string, number>;
  [key: string]: unknown;
}

interface Beneficiary {
  id?: string;
  name?: string;
  address?: string;
  share?: number;
  [key: string]: unknown;
}

interface CreateCauseInput {
  title: string;
  description?: string | null;
  cause_category: string;
  goal_amount?: number | null;
  currency?: 'BTC' | 'USD' | 'EUR' | 'CHF';
  bitcoin_address?: string | null;
  lightning_address?: string | null;
  distribution_rules?: DistributionRules;
  beneficiaries?: Beneficiary[];
  show_on_profile?: boolean;
}

export async function createCause(userId: string, input: CreateCauseInput): Promise<UserCause> {
  return createEntity<UserCause>(
    'cause',
    userId,
    {
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      cause_category: input.cause_category,
      goal_amount: input.goal_amount ?? null,
      currency: input.currency ?? 'CHF',
      bitcoin_address: input.bitcoin_address ?? null,
      lightning_address: input.lightning_address ?? null,
      distribution_rules: input.distribution_rules,
      beneficiaries: input.beneficiaries ?? [],
      status: STATUS.CAUSES.DRAFT as typeof STATUS.CAUSES.DRAFT,
      total_raised: 0,
      // Respect the form's profile-visibility toggle; DB default (true) would
      // otherwise always win and ignore an unchecked box.
      show_on_profile: input.show_on_profile ?? true,
    },
    {
      client: createAdminClient(),
    }
  );
}
