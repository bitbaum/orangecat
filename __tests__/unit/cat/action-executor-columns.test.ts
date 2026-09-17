/**
 * Cat Action Executor — DB Column Name Regression Tests
 *
 * These tests verify that each entity create handler sends the correct
 * column names to Supabase. They exist to catch the class of bug found
 * in April 2026, where 5 handlers used non-existent column names
 * (price_btc, hourly_rate_btc, goal_btc, category-vs-cause_category, etc.)
 * causing every Cat entity-creation action to fail at runtime.
 *
 * Strategy: mock Supabase + CatPermissionService, call executeAction,
 * then assert that the insert sent to the entity table used correct column names.
 * The action log insert (cat_action_log) is separated by table name so we
 * only verify the entity-specific payload.
 */

import { CatActionExecutor } from '@/services/cat/action-executor';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';

import type { Mock } from 'vitest';

// ── Mock CatPermissionService ─────────────────────────────────────────────────
// Auto-allow every action: allowed=true, requiresConfirmation=false
vi.mock('@/services/cat/permission-service', () => ({
  // function (not arrow): vitest constructs mock implementations with `new`.
  CatPermissionService: vi.fn().mockImplementation(function () {
    return {
      checkPermission: vi.fn().mockResolvedValue({ allowed: true, requiresConfirmation: false }),
      checkSpendCaps: vi.fn().mockResolvedValue({ allowed: true }),
    };
  }),
}));

// ── Mock logger (suppress noise) ─────────────────────────────────────────────
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Supabase mock factory ─────────────────────────────────────────────────────
// Tracks insert and update payloads per table so tests can inspect what was sent.
function buildMockSupabase() {
  const insertsByTable: Record<string, unknown[]> = {};
  const updatesByTable: Record<string, unknown[]> = {};

  const makeChain = (tableName: string) => {
    const chain: Record<string, unknown> = {};

    // Mutation trackers
    chain.insert = vi.fn((payload: unknown) => {
      if (!insertsByTable[tableName]) insertsByTable[tableName] = [];
      insertsByTable[tableName].push(payload);
      return chain;
    });
    chain.update = vi.fn((payload: unknown) => {
      if (!updatesByTable[tableName]) updatesByTable[tableName] = [];
      updatesByTable[tableName].push(payload);
      return chain;
    });

    // Terminal resolvers — single returns a row, maybeSingle returns null for participant lookup
    chain.single = vi
      .fn()
      .mockResolvedValue({ data: { id: 'mock-id', title: 'mock' }, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }); // no shared conv → create new

    // Chainable filters / modifiers
    chain.select = vi.fn().mockReturnThis();
    chain.eq = vi.fn().mockReturnThis();
    chain.neq = vi.fn().mockReturnThis();
    chain.or = vi.fn().mockReturnThis();
    chain.in = vi.fn().mockReturnThis();
    chain.not = vi.fn().mockReturnThis();
    chain.order = vi.fn().mockReturnThis();
    chain.limit = vi.fn().mockReturnThis();

    return chain;
  };

  const supabase = {
    from: vi.fn((table: string) => makeChain(table)),
    _insertsByTable: insertsByTable,
    _updatesByTable: updatesByTable,
  };

  return supabase;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const USER_ID = 'user-123';
const ACTOR_ID = 'actor-456';

async function run(
  supabase: ReturnType<typeof buildMockSupabase>,
  actionId: string,
  parameters: Record<string, unknown>
) {
  const executor = new CatActionExecutor(supabase as never);
  return executor.executeAction(USER_ID, ACTOR_ID, { actionId, parameters });
}

function getEntityInsert(
  supabase: ReturnType<typeof buildMockSupabase>,
  tableName: string
): Record<string, unknown> | undefined {
  const rows = supabase._insertsByTable[tableName];
  return rows?.[0] as Record<string, unknown> | undefined;
}

function getEntityUpdate(
  supabase: ReturnType<typeof buildMockSupabase>,
  tableName: string
): Record<string, unknown> | undefined {
  const rows = supabase._updatesByTable[tableName];
  return rows?.[0] as Record<string, unknown> | undefined;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Cat action-executor — correct DB column names', () => {
  // ── create_product ──────────────────────────────────────────────────────────
  describe('create_product', () => {
    it('uses `price` (not price_btc) and includes required defaults', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'create_product', {
        title: 'My Widget',
        price_btc: 0.001,
        category: 'electronics',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.product.tableName);
      expect(insert).toBeDefined();

      // Correct column used
      expect(insert!.price).toBe(0.001);
      // Wrong column must NOT appear
      expect(insert!.price_btc).toBeUndefined();

      // Required defaults
      expect(insert!.currency).toBe('BTC');
      expect(insert!.product_type).toBe('physical');
      expect(insert!.fulfillment_type).toBe('manual');
      expect(Array.isArray(insert!.images)).toBe(true);
      expect(insert!.actor_id).toBe(ACTOR_ID);
      // user_id is NOT NULL + owner RLS checks it — dual-write (July 2026 fix)
      expect(insert!.user_id).toBe(USER_ID);
      expect(insert!.status).toBe('draft');
    });

    it('falls back to `price` param when no price_btc provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_product', { title: 'T', price: 0.005 });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.product.tableName);
      expect(insert!.price).toBe(0.005);
    });

    it('sets status to active when publish=true', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_product', { title: 'T', publish: true });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.product.tableName);
      expect(insert!.status).toBe('active');
    });
  });

  // ── create_service ──────────────────────────────────────────────────────────
  describe('create_service', () => {
    it('uses `hourly_rate` (not hourly_rate_btc) for hourly pricing', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_service', {
        title: 'Consulting',
        hourly_rate_btc: 0.0005,
      });

      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.service.tableName);
      expect(insert!.hourly_rate).toBe(0.0005);
      expect(insert!.hourly_rate_btc).toBeUndefined();
      expect(insert!.currency).toBe('BTC');
      expect(insert!.actor_id).toBe(ACTOR_ID);
      // user_id is NOT NULL + owner RLS checks it — dual-write (July 2026 fix)
      expect(insert!.user_id).toBe(USER_ID);
      expect(insert!.service_location_type).toBe('remote');
      expect(Array.isArray(insert!.images)).toBe(true);
      expect(Array.isArray(insert!.portfolio_links)).toBe(true);
    });

    it('uses `fixed_price` (not fixed_price_btc) for fixed pricing', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_service', {
        title: 'Logo Design',
        fixed_price_btc: 0.01,
      });

      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.service.tableName);
      expect(insert!.fixed_price).toBe(0.01);
      expect(insert!.fixed_price_btc).toBeUndefined();
    });

    it('prefers hourly_rate over fixed_price when both present', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_service', {
        title: 'Svc',
        hourly_rate: 0.001,
        fixed_price: 0.05,
      });

      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.service.tableName);
      expect(insert!.hourly_rate).toBe(0.001);
      expect(insert!.fixed_price).toBeUndefined();
    });
  });

  // ── create_project ──────────────────────────────────────────────────────────
  describe('create_project', () => {
    it('uses `goal_amount` (not goal_btc) and includes currency', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_project', {
        title: 'Open Source Tool',
        goal_btc: 1.5,
        category: 'technology',
      });

      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.project.tableName);
      expect(insert!.goal_amount).toBe(1.5);
      expect((insert as Record<string, unknown>).goal_btc).toBeUndefined();
      expect(insert!.currency).toBe('BTC');
      expect(insert!.actor_id).toBe(ACTOR_ID);
      // user_id is NOT NULL + owner RLS checks it — dual-write (July 2026 fix)
      expect(insert!.user_id).toBe(USER_ID);
    });

    it('falls back to goal_amount param when no goal_btc', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_project', { title: 'P', goal_amount: 0.5 });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.project.tableName);
      expect(insert!.goal_amount).toBe(0.5);
    });
  });

  // ── create_cause ────────────────────────────────────────────────────────────
  describe('create_cause', () => {
    it('uses `cause_category` (not category) and includes target_amount + currency', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_cause', {
        title: 'Feed the World',
        category: 'hunger',
        goal_btc: 10,
      });

      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.cause.tableName);
      expect(insert!.cause_category).toBe('hunger');
      // `category` must NOT appear — it's not a DB column on causes
      expect(insert!.category).toBeUndefined();
      // DB column is `target_amount`, not `goal_amount`
      expect(insert!.target_amount).toBe(10);
      expect(insert!.goal_amount).toBeUndefined();
      expect(insert!.currency).toBe('BTC');
      expect(insert!.actor_id).toBe(ACTOR_ID);
      // user_id is NOT NULL + owner RLS checks it — dual-write (July 2026 fix)
      expect(insert!.user_id).toBe(USER_ID);
    });

    it('accepts explicit cause_category param', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_cause', {
        title: 'Cause',
        cause_category: 'education',
      });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.cause.tableName);
      expect(insert!.cause_category).toBe('education');
      expect(insert!.category).toBeUndefined();
    });

    it('falls back to target_amount param when no goal_btc', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_cause', { title: 'C', target_amount: 5 });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.cause.tableName);
      expect(insert!.target_amount).toBe(5);
      expect(insert!.goal_amount).toBeUndefined();
    });
  });

  // ── create_event ────────────────────────────────────────────────────────────
  describe('create_event', () => {
    it('uses start_date and location with actor_id', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_event', {
        title: 'Bitcoin Meetup',
        start_date: '2026-06-01T18:00:00Z',
        location: 'Zurich',
      });

      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.event.tableName);
      expect(insert!.start_date).toBe('2026-06-01T18:00:00Z');
      expect(insert!.location).toBe('Zurich');
      expect(insert!.actor_id).toBe(ACTOR_ID);
      // user_id is NOT NULL + owner RLS checks it — dual-write (July 2026 fix)
      expect(insert!.user_id).toBe(USER_ID);
      expect(insert!.status).toBe('draft');
    });
  });

  // ── create_asset ────────────────────────────────────────────────────────────
  describe('create_asset', () => {
    it('includes verification_status, currency, and public_visibility defaults', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_asset', {
        title: 'My Apartment',
        asset_type: 'real_estate',
        location: 'Geneva',
      });

      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.asset.tableName);
      expect(insert!.type).toBe('real_estate');
      expect(insert!.location).toBe('Geneva');
      expect(insert!.currency).toBe('BTC');
      expect(insert!.verification_status).toBe('unverified');
      expect(insert!.public_visibility).toBe(false);
      expect(insert!.actor_id).toBe(ACTOR_ID);
    });
  });

  // ── archive_entity ───────────────────────────────────────────────────────────
  describe('archive_entity', () => {
    it('sets status=archived on the entity table and returns a displayMessage', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'archive_entity', {
        entity_type: 'product',
        entity_id: 'prod-abc',
      });

      expect(result.status).toBe('completed');
      const update = getEntityUpdate(supabase, ENTITY_REGISTRY.product.tableName);
      expect(update).toBeDefined();
      expect(update!.status).toBe('archived');
      // Must NOT set to any other status
      expect(update!.status).not.toBe('active');
      expect(update!.status).not.toBe('draft');
    });

    it('works across all entity types via registry', async () => {
      for (const entityType of ['service', 'project', 'cause', 'event'] as const) {
        const supabase = buildMockSupabase();
        const result = await run(supabase, 'archive_entity', {
          entity_type: entityType,
          entity_id: `${entityType}-id`,
        });

        expect(result.status).toBe('completed');
        const update = getEntityUpdate(supabase, ENTITY_REGISTRY[entityType].tableName);
        expect(update!.status).toBe('archived');
      }
    });

    it('returns error for unknown entity type', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'archive_entity', {
        entity_type: 'nonexistent_type',
        entity_id: 'some-id',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/unknown entity type/i);
    });

    it('returns a displayMessage containing the entity title', async () => {
      const supabase = buildMockSupabase();
      // The mock single() returns { id: 'mock-id', title: 'mock' }
      const result = await run(supabase, 'archive_entity', {
        entity_type: 'product',
        entity_id: 'prod-abc',
      });

      expect(result.status).toBe('completed');
      expect((result.data as Record<string, unknown>)?.displayMessage).toContain('archived');
    });
  });

  // ── update_entity ───────────────────────────────────────────────────────────
  describe('update_entity', () => {
    it('passes cause_category through to causes table (not silently dropped)', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'update_entity', {
        entity_type: 'cause',
        entity_id: 'cause-abc',
        updates: { cause_category: 'environment' },
      });

      // Must succeed — not "No valid fields to update"
      expect(result.status).toBe('completed');
      const update = getEntityUpdate(supabase, ENTITY_REGISTRY.cause.tableName);
      expect(update).toBeDefined();
      expect(update!.cause_category).toBe('environment');
      // `category` must NOT appear in the update payload
      expect(update!.category).toBeUndefined();
    });

    it('passes common safe fields through for any entity', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'update_entity', {
        entity_type: 'product',
        entity_id: 'prod-123',
        updates: { title: 'New Title', description: 'Updated', status: 'active' },
      });

      const update = getEntityUpdate(supabase, ENTITY_REGISTRY.product.tableName);
      expect(update!.title).toBe('New Title');
      expect(update!.description).toBe('Updated');
      expect(update!.status).toBe('active');
    });

    it('rejects updates with only non-safe fields', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'update_entity', {
        entity_type: 'product',
        entity_id: 'prod-123',
        // price is intentionally NOT in safeFields (financial field)
        updates: { price: 9999 },
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/no valid fields/i);
    });
  });

  // ── create_task ─────────────────────────────────────────────────────────────
  describe('create_task', () => {
    it('uses current_status (not status) with valid enum values', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'create_task', {
        title: 'Fix the sink',
        description: 'Leaking pipe under kitchen sink',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert).toBeDefined();

      // Correct column name
      expect(insert!.current_status).toBe('idle');
      // Wrong column name must NOT appear
      expect((insert as Record<string, unknown>).status).toBeUndefined();

      // Valid enum values only
      expect(insert!.task_type).toBe('one_time'); // not 'personal'
      expect(insert!.category).toBe('other'); // not 'general'
      expect(insert!.priority).toBe('normal'); // not 'medium'
      expect(insert!.created_by).toBe(USER_ID);
    });

    it('maps priority=medium to normal (medium is not a valid DB enum value)', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_task', { title: 'Task', priority: 'medium' });
      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      // 'medium' must never reach the DB — only 'normal' is valid
      expect(insert!.priority).toBe('normal');
    });

    it('passes valid priority values through unchanged', async () => {
      for (const priority of ['low', 'normal', 'high', 'urgent']) {
        const supabase = buildMockSupabase();
        await run(supabase, 'create_task', { title: 'Task', priority });
        const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
        expect(insert!.priority).toBe(priority);
      }
    });
  });

  // ── create_organization ─────────────────────────────────────────────────────
  describe('create_organization', () => {
    it('uses label (not type) and generates a slug', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'create_organization', {
        name: 'Bitcoin Builders',
        description: 'Building on Bitcoin',
        label: 'company',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.group.tableName);
      expect(insert).toBeDefined();

      // Correct column used
      expect(insert!.label).toBe('company');
      // Wrong column must NOT appear
      expect((insert as Record<string, unknown>).type).toBeUndefined();

      // Slug must be generated (non-empty, derived from name)
      expect(typeof insert!.slug).toBe('string');
      expect((insert!.slug as string).length).toBeGreaterThan(0);
      expect(insert!.slug as string).toMatch(/^bitcoin-builders-/);

      expect(insert!.name).toBe('Bitcoin Builders');
      expect(insert!.created_by).toBe(USER_ID);
    });

    it('defaults label to circle when not provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_organization', { name: 'My Group' });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.group.tableName);
      expect(insert!.label).toBe('circle');
    });

    it('accepts legacy type param as fallback for label', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_organization', { name: 'Coop', type: 'cooperative' });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.group.tableName);
      expect(insert!.label).toBe('cooperative');
    });
  });

  // ── create_investment ────────────────────────────────────────────────────────
  describe('create_investment', () => {
    it('uses `target_amount` (not target_amount_btc) and sets BTC defaults', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'create_investment', {
        title: 'Bitcoin Revenue Share',
        investment_type: 'revenue_share',
        target_amount_btc: 1.5,
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.investment.tableName);
      expect(insert).toBeDefined();

      // Correct column — target_amount (not target_amount_btc)
      expect(insert!.target_amount).toBe(1.5);
      expect((insert as Record<string, unknown>).target_amount_btc).toBeUndefined();

      // Required defaults
      expect(insert!.currency).toBe('BTC');
      expect(insert!.investment_type).toBe('revenue_share');
      expect(insert!.total_raised).toBe(0);
      // `investor_count` is NOT a column on `investments` — writing it made the
      // insert fail with 42703. It is enriched at read time, never persisted.
      expect((insert as Record<string, unknown>).investor_count).toBeUndefined();
      expect(insert!.is_public).toBe(false);
      expect(insert!.status).toBe('draft');
      expect(insert!.actor_id).toBe(ACTOR_ID);
    });

    it('uses `minimum_investment` (not minimum_investment_btc) and defaults to 0.0001', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_investment', {
        title: 'Fund',
        target_amount_btc: 0.5,
        minimum_investment_btc: 0.001,
      });

      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.investment.tableName);
      expect(insert!.minimum_investment).toBe(0.001);
      expect((insert as Record<string, unknown>).minimum_investment_btc).toBeUndefined();
    });

    it('defaults minimum_investment to 0.0001 when not provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_investment', { title: 'Fund', target_amount_btc: 0.5 });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.investment.tableName);
      expect(insert!.minimum_investment).toBe(0.0001);
    });

    it('defaults investment_type to revenue_share when not provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_investment', { title: 'Fund', target_amount_btc: 1 });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.investment.tableName);
      expect(insert!.investment_type).toBe('revenue_share');
    });

    it('uses status=open (not active) when publish=true', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_investment', {
        title: 'Open Fund',
        target_amount_btc: 2,
        publish: true,
      });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.investment.tableName);
      expect(insert!.status).toBe('open');
      expect(insert!.is_public).toBe(true);
    });

    it('falls back to target_amount param when no target_amount_btc', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_investment', { title: 'Fund', target_amount: 0.75 });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.investment.tableName);
      expect(insert!.target_amount).toBe(0.75);
    });
  });

  // ── create_loan ──────────────────────────────────────────────────────────────
  describe('create_loan', () => {
    it('uses original_amount and remaining_balance (not amount_btc) and computes amount_sats', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'create_loan', {
        title: 'Equipment loan',
        description: 'Buy welding gear',
        amount_btc: 0.05,
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.loan.tableName);
      expect(insert).toBeDefined();

      // BTC decimal columns (not amount_btc, not amount_sats — the prod
      // loans table only has original_amount + remaining_balance, both NUMERIC).
      expect(insert!.original_amount).toBe(0.05);
      expect(insert!.remaining_balance).toBe(0.05);
      expect((insert as Record<string, unknown>).amount_btc).toBeUndefined();
      expect((insert as Record<string, unknown>).amount_sats).toBeUndefined();

      // Ownership: both actor_id and user_id
      expect(insert!.actor_id).toBe(ACTOR_ID);
      expect(insert!.user_id).toBe(USER_ID);

      // Required defaults
      expect(insert!.currency).toBe('BTC');
      expect(insert!.status).toBe('active');
      expect(insert!.loan_type).toBe('new_request');
      expect(insert!.fulfillment_type).toBe('manual');
    });

    it('passes interest_rate through when provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_loan', {
        title: 'Loan',
        amount_btc: 0.1,
        interest_rate: 5,
      });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.loan.tableName);
      expect(insert!.interest_rate).toBe(5);
    });

    it('sets interest_rate to null when not provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_loan', { title: 'Loan', amount_btc: 0.01 });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.loan.tableName);
      expect(insert!.interest_rate).toBeNull();
    });

    it('accepts existing_refinance loan_type', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_loan', {
        title: 'Refi',
        amount_btc: 0.2,
        loan_type: 'existing_refinance',
      });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.loan.tableName);
      expect(insert!.loan_type).toBe('existing_refinance');
    });
  });

  // ── send_message ─────────────────────────────────────────────────────────────
  describe('send_message', () => {
    it('resolves @username via profiles and creates a new conversation when none exists', async () => {
      const supabase = buildMockSupabase();
      // maybeSingle returns null → no shared conversation → creates new one
      const result = await run(supabase, 'send_message', {
        recipient: '@alice',
        content: 'Hey, want to collaborate?',
      });

      expect(result.status).toBe('completed');
      // profiles table was queried for username lookup
      expect(supabase.from).toHaveBeenCalledWith(DATABASE_TABLES.PROFILES);
      // conversation_participants was queried for existing conv check
      expect(supabase.from).toHaveBeenCalledWith(DATABASE_TABLES.CONVERSATION_PARTICIPANTS);
      // new conversation was created
      expect(supabase.from).toHaveBeenCalledWith(DATABASE_TABLES.CONVERSATIONS);
      // message was inserted with correct content
      const insert = getEntityInsert(supabase, DATABASE_TABLES.MESSAGES);
      expect(insert).toBeDefined();
      expect(insert!.content).toBe('Hey, want to collaborate?');
      expect(insert!.sender_id).toBe(USER_ID);
      expect(insert!.message_type).toBe('text');
    });

    it('accepts a raw UUID recipient without a profiles lookup', async () => {
      const supabase = buildMockSupabase();
      const rawUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = await run(supabase, 'send_message', {
        recipient: rawUuid,
        content: 'Direct message',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, DATABASE_TABLES.MESSAGES);
      expect(insert).toBeDefined();
      expect(insert!.content).toBe('Direct message');
    });

    it('returns error when recipient param is missing', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'send_message', { content: 'Hello' });
      expect(result.status).toBe('failed');
    });
  });

  // ── reply_to_message ─────────────────────────────────────────────────────────
  describe('reply_to_message', () => {
    it('inserts into messages table with conversation_id, sender_id (userId), and content', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'reply_to_message', {
        conversation_id: 'conv-abc',
        content: 'Thanks for reaching out!',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, DATABASE_TABLES.MESSAGES);
      expect(insert).toBeDefined();

      expect(insert!.conversation_id).toBe('conv-abc');
      expect(insert!.content).toBe('Thanks for reaching out!');
      // sender_id must be the acting userId, not actorId
      expect(insert!.sender_id).toBe(USER_ID);
    });
  });

  // ── invite_to_organization ───────────────────────────────────────────────────
  describe('invite_to_organization', () => {
    it('inserts into group_invitations with group_id, user_id, role, and invited_by', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'invite_to_organization', {
        organization_id: 'org-xyz',
        user_id: 'invitee-789',
        role: 'admin',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, DATABASE_TABLES.GROUP_INVITATIONS);
      expect(insert).toBeDefined();

      // organization_id must be mapped to group_id (the DB column)
      expect(insert!.group_id).toBe('org-xyz');
      expect((insert as Record<string, unknown>).organization_id).toBeUndefined();
      expect(insert!.user_id).toBe('invitee-789');
      expect(insert!.role).toBe('admin');
      // invited_by must be the acting userId
      expect(insert!.invited_by).toBe(USER_ID);
    });

    it('defaults role to member when not provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'invite_to_organization', {
        organization_id: 'org-xyz',
        user_id: 'invitee-789',
      });

      const insert = getEntityInsert(supabase, DATABASE_TABLES.GROUP_INVITATIONS);
      expect(insert!.role).toBe('member');
    });
  });

  // ── create_research ──────────────────────────────────────────────────────────
  describe('create_research', () => {
    it('uses user_id (not actor_id) as ownership column', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'create_research', {
        title: 'Decentralized AI Safety Research',
        field: 'artificial_intelligence',
        funding_goal_btc: 0.5,
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.research.tableName);
      expect(insert).toBeDefined();

      // research_entities uses user_id (profiles FK), NOT actor_id
      expect(insert!.user_id).toBe(USER_ID);
      expect((insert as Record<string, unknown>).actor_id).toBeUndefined();
    });

    it('uses funding_goal_btc column name (not funding_goal_sats or goal_btc)', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_research', {
        title: 'Climate Study',
        funding_goal_btc: 0.25,
      });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.research.tableName);

      expect(insert!.funding_goal_btc).toBe(0.25);
      expect((insert as Record<string, unknown>).funding_goal_sats).toBeUndefined();
      expect((insert as Record<string, unknown>).goal_btc).toBeUndefined();
    });

    it('defaults funding_goal_btc to 0.001 when omitted', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_research', { title: 'Minimal Research' });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.research.tableName);
      expect(insert!.funding_goal_btc).toBe(0.001);
    });

    it('sets funding_raised_btc to 0 and wallet_address to null on creation', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_research', {
        title: 'Blockchain Cryptography Study',
        funding_goal_btc: 0.1,
      });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.research.tableName);
      expect(insert!.funding_raised_btc).toBe(0);
      expect(insert!.wallet_address).toBeNull();
    });

    it('applies sensible defaults for required NOT NULL enum fields', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_research', { title: 'Quick Study' });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.research.tableName);

      expect(insert!.field).toBe('other');
      expect(insert!.methodology).toBe('experimental');
      expect(insert!.timeline).toBe('medium_term');
      expect(insert!.funding_model).toBe('donation');
      expect(insert!.progress_frequency).toBe('monthly');
      expect(insert!.transparency_level).toBe('progress');
    });

    it('passes through provided field and methodology values', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_research', {
        title: 'Advanced Study',
        field: 'neuroscience',
        methodology: 'computational',
      });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.research.tableName);
      expect(insert!.field).toBe('neuroscience');
      expect(insert!.methodology).toBe('computational');
    });

    it('sets is_public=true and status=draft by default', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_research', { title: 'Open Science' });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.research.tableName);
      expect(insert!.is_public).toBe(true);
      expect(insert!.status).toBe('draft');
    });
  });

  // ── create_wishlist ──────────────────────────────────────────────────────────
  describe('create_wishlist', () => {
    it('uses actor_id (not user_id) as ownership column', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'create_wishlist', { title: 'My Birthday List' });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.wishlist.tableName);
      expect(insert).toBeDefined();

      expect(insert!.actor_id).toBe(ACTOR_ID);
      expect((insert as Record<string, unknown>).user_id).toBeUndefined();
    });

    it('defaults type to general and visibility to public', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_wishlist', { title: 'My List' });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.wishlist.tableName);

      expect(insert!.type).toBe('general');
      expect(insert!.visibility).toBe('public');
      expect(insert!.is_active).toBe(true);
    });

    it('passes through type and visibility when provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_wishlist', {
        title: 'Wedding Registry',
        type: 'wedding',
        visibility: 'unlisted',
        event_date: '2026-09-15',
      });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.wishlist.tableName);

      expect(insert!.type).toBe('wedding');
      expect(insert!.visibility).toBe('unlisted');
      expect(insert!.event_date).toBe('2026-09-15');
    });

    it('sets event_date to null when not provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_wishlist', { title: 'General Wishlist' });
      const insert = getEntityInsert(supabase, ENTITY_REGISTRY.wishlist.tableName);
      expect(insert!.event_date).toBeNull();
    });
  });

  // ── post_to_timeline ──────────────────────────────────────────────────────────
  describe('post_to_timeline', () => {
    it('inserts into timeline_events (not timeline_posts) with required fields', async () => {
      const supabase = buildMockSupabase();
      const content = 'Just shipped a new feature on OrangeCat!';
      const result = await run(supabase, 'post_to_timeline', { content });

      expect(result.status).toBe('completed');

      // Must write to timeline_events, never to timeline_posts (which does not exist)
      const insert = getEntityInsert(supabase, DATABASE_TABLES.TIMELINE_EVENTS);
      expect(insert).toBeDefined();
      expect(
        (supabase._insertsByTable as Record<string, unknown>)['timeline_posts']
      ).toBeUndefined();

      // Required fields
      expect(insert!.event_type).toBe('post');
      expect(insert!.event_subtype).toBe('text');
      expect(insert!.subject_type).toBe('profile');
      // timeline_events.actor_id holds the USER id, not the actor id (the INSERT RLS
      // policy is `auth.uid() = actor_id` and the feed views join it → profiles.id).
      // Inserting the distinct actor id fails RLS — so this must be the user id.
      expect(insert!.actor_id).toBe(USER_ID);

      // title is a truncated version of content; description is the full text
      expect(insert!.title).toBe(content);
      expect(insert!.description).toBe(content);

      // content is JSONB { text: "..." }, not a plain string
      expect(insert!.content).toEqual({ text: content });
      expect(typeof insert!.content).toBe('object');

      // No entity_id column (does not exist on timeline_events)
      expect((insert as Record<string, unknown>).entity_id).toBeUndefined();
    });

    it('truncates title to 100 chars but keeps full text in description and content', async () => {
      const supabase = buildMockSupabase();
      const long = 'A'.repeat(120);
      await run(supabase, 'post_to_timeline', { content: long });
      const insert = getEntityInsert(supabase, DATABASE_TABLES.TIMELINE_EVENTS);

      expect(insert!.title).toHaveLength(98); // 97 chars + 1 char ellipsis
      expect(insert!.description).toBe(long);
      expect((insert!.content as { text: string }).text).toBe(long);
    });

    it('defaults visibility to public', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'post_to_timeline', { content: 'Hello world' });
      const insert = getEntityInsert(supabase, DATABASE_TABLES.TIMELINE_EVENTS);
      expect(insert!.visibility).toBe('public');
    });
  });

  // ── set_reminder ─────────────────────────────────────────────────────────────
  // Regression: system prompt documents title/due_date/notes but handler previously
  // read message/when — reminders were silently created with undefined title + no due date.
  describe('set_reminder', () => {
    it('reads `title` param and stores it in the tasks title column', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'set_reminder', {
        title: 'Call the dentist',
        due_date: '2026-05-01T09:00:00Z',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert).toBeDefined();
      // title must reach the DB
      expect(insert!.title).toBe('Call the dentist');
      // Wrong column name must NOT appear
      expect((insert as Record<string, unknown>).message).toBeUndefined();
    });

    it('parses `due_date` (ISO string) and stores it in the tasks due_date column', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'set_reminder', {
        title: 'Submit tax return',
        due_date: '2026-04-30T23:59:00Z',
      });

      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert!.due_date).not.toBeNull();
      // Must be a parseable ISO string; check UTC year and month to avoid timezone flips
      const stored = new Date(insert!.due_date as string);
      expect(stored.getUTCFullYear()).toBe(2026);
      expect(stored.getUTCMonth()).toBe(3); // 0-indexed April
    });

    it('parses `due_date` with natural language ("tomorrow") to a date', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'set_reminder', {
        title: 'Check in with team',
        due_date: 'tomorrow',
      });

      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert!.due_date).not.toBeNull();
      const stored = new Date(insert!.due_date as string);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(stored.getDate()).toBe(tomorrow.getDate());
    });

    it('passes `notes` into the task description with Reminder prefix', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'set_reminder', {
        title: 'Water plants',
        notes: "Don't forget the balcony ones",
      });

      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert!.description).toContain("Don't forget the balcony ones");
    });

    it('still works with legacy `message`/`when` params for backward compatibility', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'set_reminder', {
        message: 'Legacy reminder title',
        when: 'in 1 hour',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert!.title).toBe('Legacy reminder title');
      expect(insert!.due_date).not.toBeNull();
    });

    it('returns error when no title (or message) is provided', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'set_reminder', { due_date: 'tomorrow' });
      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/title/i);
    });

    it('sets is_reminder=true and correct enum values', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'set_reminder', { title: 'Reminder test' });

      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert!.is_reminder).toBe(true);
      expect(insert!.current_status).toBe('idle');
      expect(insert!.task_type).toBe('one_time');
      expect(insert!.priority).toBe('normal');
      expect(insert!.created_by).toBe(USER_ID);
    });
  });

  // ── create_task (notes alias) ─────────────────────────────────────────────────
  // Regression: system prompt documents `notes` param but handler previously only
  // read `description` — notes were silently dropped on task creation.
  describe('create_task — notes param alias', () => {
    it('maps `notes` param to the description column', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'create_task', {
        title: 'Buy groceries',
        notes: 'Milk, eggs, bread',
      });

      expect(result.status).toBe('completed');
      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert!.description).toBe('Milk, eggs, bread');
    });

    it('prefers `description` when both description and notes are provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_task', {
        title: 'Task',
        description: 'The description field',
        notes: 'Notes field',
      });

      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      // description takes priority (truthy short-circuit)
      expect(insert!.description).toBe('The description field');
    });

    it('sets description to null when neither description nor notes provided', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'create_task', { title: 'Bare task' });

      const insert = getEntityInsert(supabase, DATABASE_TABLES.TASKS);
      expect(insert!.description).toBeNull();
    });
  });

  // ── complete_task ────────────────────────────────────────────────────────────
  describe('complete_task', () => {
    // complete_task does a select on tasks first, then inserts into task_completions.
    // We need a table-aware mock so the tasks select returns real task data.
    function buildMockSupabaseForCompleteTask(taskOverrides: Record<string, unknown> = {}) {
      const insertsByTable: Record<string, unknown[]> = {};
      const taskRow = {
        id: 'task-abc',
        title: 'Call dentist',
        task_type: 'one_time',
        is_completed: false,
        created_by: USER_ID,
        ...taskOverrides,
      };

      const supabase = {
        from: vi.fn((table: string) => {
          const chain: Record<string, unknown> = {};
          chain.insert = vi.fn((payload: unknown) => {
            if (!insertsByTable[table]) insertsByTable[table] = [];
            insertsByTable[table].push(payload);
            return chain;
          });
          chain.update = vi.fn().mockReturnThis();
          chain.select = vi.fn().mockReturnThis();
          chain.eq = vi.fn().mockReturnThis();
          chain.in = vi.fn().mockReturnThis();
          chain.order = vi.fn().mockReturnThis();
          chain.limit = vi.fn().mockReturnThis();
          // Tasks select returns real task data; everything else returns a generic insert success
          chain.single = vi
            .fn()
            .mockResolvedValue(
              table === DATABASE_TABLES.TASKS
                ? { data: taskRow, error: null }
                : { data: { id: 'new-id' }, error: null }
            );
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
          return chain;
        }),
        _insertsByTable: insertsByTable,
      };
      return supabase;
    }

    it('inserts into task_completions with task_id, completed_by, and completed_at', async () => {
      const supabase = buildMockSupabaseForCompleteTask();
      const result = await run(supabase as never, 'complete_task', {
        task_id: 'task-abc',
      });

      expect(result.status).toBe('completed');
      const insert = supabase._insertsByTable[DATABASE_TABLES.TASK_COMPLETIONS]?.[0] as Record<
        string,
        unknown
      >;
      expect(insert).toBeDefined();
      expect(insert.task_id).toBe('task-abc');
      expect(insert.completed_by).toBe(USER_ID);
      expect(typeof insert.completed_at).toBe('string');
    });

    it('passes notes through to task_completions when provided', async () => {
      const supabase = buildMockSupabaseForCompleteTask();
      await run(supabase as never, 'complete_task', {
        task_id: 'task-abc',
        notes: 'Done after rescheduling twice',
      });

      const insert = supabase._insertsByTable[DATABASE_TABLES.TASK_COMPLETIONS]?.[0] as Record<
        string,
        unknown
      >;
      expect(insert.notes).toBe('Done after rescheduling twice');
    });

    it('returns error when task belongs to a different user', async () => {
      const supabase = buildMockSupabaseForCompleteTask({ created_by: 'other-user-999' });
      const result = await run(supabase as never, 'complete_task', { task_id: 'task-abc' });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/own/i);
    });

    it('returns error when one-time task is already completed', async () => {
      const supabase = buildMockSupabaseForCompleteTask({
        is_completed: true,
        task_type: 'one_time',
      });
      const result = await run(supabase as never, 'complete_task', { task_id: 'task-abc' });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/already completed/i);
    });

    it('returns a displayMessage confirming completion', async () => {
      const supabase = buildMockSupabaseForCompleteTask();
      const result = await run(supabase as never, 'complete_task', { task_id: 'task-abc' });

      expect(result.status).toBe('completed');
      expect((result.data as Record<string, unknown>)?.displayMessage).toContain('Call dentist');
    });
  });

  // ── update_task ──────────────────────────────────────────────────────────────
  describe('update_task', () => {
    // update_task selects the task first (ownership check), then updates.
    // We need a table-aware mock so the tasks select returns real task data.
    function buildMockSupabaseForUpdateTask(taskOverrides: Record<string, unknown> = {}) {
      const updatesByTable: Record<string, unknown[]> = {};
      const taskRow = {
        id: 'task-xyz',
        title: 'Water plants',
        created_by: USER_ID,
        ...taskOverrides,
      };

      const supabase = {
        from: vi.fn((table: string) => {
          const chain: Record<string, unknown> = {};
          chain.insert = vi.fn().mockReturnThis();
          chain.update = vi.fn((payload: unknown) => {
            if (!updatesByTable[table]) updatesByTable[table] = [];
            updatesByTable[table].push(payload);
            return chain;
          });
          chain.select = vi.fn().mockReturnThis();
          chain.eq = vi.fn().mockReturnThis();
          chain.order = vi.fn().mockReturnThis();
          chain.limit = vi.fn().mockReturnThis();
          // Tasks select returns real task data; update single returns updated row
          chain.single = vi
            .fn()
            .mockResolvedValue(
              table === DATABASE_TABLES.TASKS
                ? { data: { ...taskRow, due_date: null, priority: 'normal' }, error: null }
                : { data: { id: 'new-id' }, error: null }
            );
          chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
          return chain;
        }),
        _updatesByTable: updatesByTable,
      };
      return supabase;
    }

    it('updates due_date from natural language ("next week") via parseReminderDate', async () => {
      const supabase = buildMockSupabaseForUpdateTask();
      const result = await run(supabase as never, 'update_task', {
        task_id: 'task-xyz',
        due_date: 'next week',
      });

      expect(result.status).toBe('completed');
      const update = supabase._updatesByTable[DATABASE_TABLES.TASKS]?.[0] as Record<
        string,
        unknown
      >;
      expect(update).toBeDefined();
      // due_date should be a valid ISO string (next week)
      expect(typeof update.due_date).toBe('string');
      const stored = new Date(update.due_date as string);
      expect(isNaN(stored.getTime())).toBe(false);
    });

    it('updates title when provided', async () => {
      const supabase = buildMockSupabaseForUpdateTask();
      const result = await run(supabase as never, 'update_task', {
        task_id: 'task-xyz',
        title: 'Water ALL the plants',
      });

      expect(result.status).toBe('completed');
      const update = supabase._updatesByTable[DATABASE_TABLES.TASKS]?.[0] as Record<
        string,
        unknown
      >;
      expect(update.title).toBe('Water ALL the plants');
    });

    it('maps `notes` to description column', async () => {
      const supabase = buildMockSupabaseForUpdateTask();
      await run(supabase as never, 'update_task', {
        task_id: 'task-xyz',
        notes: 'Also the ones on the balcony',
      });

      const update = supabase._updatesByTable[DATABASE_TABLES.TASKS]?.[0] as Record<
        string,
        unknown
      >;
      expect(update.description).toBe('Also the ones on the balcony');
      // `notes` must NOT be sent as a DB column
      expect(update.notes).toBeUndefined();
    });

    it('maps priority=medium to normal', async () => {
      const supabase = buildMockSupabaseForUpdateTask();
      await run(supabase as never, 'update_task', {
        task_id: 'task-xyz',
        priority: 'medium',
      });

      const update = supabase._updatesByTable[DATABASE_TABLES.TASKS]?.[0] as Record<
        string,
        unknown
      >;
      expect(update.priority).toBe('normal');
    });

    it('returns error when task belongs to a different user', async () => {
      const supabase = buildMockSupabaseForUpdateTask({ created_by: 'someone-else' });
      const result = await run(supabase as never, 'update_task', {
        task_id: 'task-xyz',
        title: 'Hacked title',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/own/i);
    });

    it('returns error when no fields to update are provided', async () => {
      const supabase = buildMockSupabaseForUpdateTask();
      const result = await run(supabase as never, 'update_task', {
        task_id: 'task-xyz',
        // no title, due_date, notes, or priority
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/no fields/i);
    });

    it('returns a displayMessage with new due date when rescheduling', async () => {
      const supabase = buildMockSupabaseForUpdateTask();
      const result = await run(supabase as never, 'update_task', {
        task_id: 'task-xyz',
        due_date: 'tomorrow',
      });

      expect(result.status).toBe('completed');
      const displayMessage = (result.data as Record<string, unknown>)?.displayMessage as string;
      expect(displayMessage).toContain('📅');
    });
  });

  // ── update_profile ────────────────────────────────────────────────────────────
  // Regression: verify correct column names and safe-field filtering.
  // update_profile updates the profiles table keyed on profiles.id = userId.
  describe('update_profile', () => {
    it('updates the profiles table with bio and name using correct column names', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'update_profile', {
        name: 'Alice the Baker',
        bio: 'I bake sourdough and teach people to do the same.',
      });

      expect(result.status).toBe('completed');
      const update = getEntityUpdate(supabase, DATABASE_TABLES.PROFILES);
      expect(update).toBeDefined();
      expect(update!.name).toBe('Alice the Baker');
      expect(update!.bio).toBe('I bake sourdough and teach people to do the same.');
    });

    it('updates background and website correctly', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'update_profile', {
        background: 'Former software engineer turned artisan baker.',
        website: 'https://alicebakes.com',
      });

      const update = getEntityUpdate(supabase, DATABASE_TABLES.PROFILES);
      expect(update!.background).toBe('Former software engineer turned artisan baker.');
      expect(update!.website).toBe('https://alicebakes.com');
    });

    it('updates location_city and location_country', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'update_profile', {
        location_city: 'Zurich',
        location_country: 'CH',
      });

      const update = getEntityUpdate(supabase, DATABASE_TABLES.PROFILES);
      expect(update!.location_city).toBe('Zurich');
      expect(update!.location_country).toBe('CH');
    });

    it('filters out unsafe fields — email and id must never appear in update payload', async () => {
      // username used to be asserted here too, as a field that must always be
      // dropped. That stopped being true once profile_username_history made a
      // rename safe: the handle is now updatable, validated apart from the
      // free-text fields, and covered in cat/rename-handle.test.ts. email and id
      // are still never writable from a chat action.
      const supabase = buildMockSupabase();
      await run(supabase, 'update_profile', {
        bio: 'Safe bio',
        email: 'hacker@evil.com', // must be silently dropped
        id: 'injected-id', // must be silently dropped
      });

      const update = getEntityUpdate(supabase, DATABASE_TABLES.PROFILES);
      expect(update!.bio).toBe('Safe bio');
      // Unsafe fields must NOT appear in the DB update
      expect((update as Record<string, unknown>).email).toBeUndefined();
      expect((update as Record<string, unknown>).id).toBeUndefined();
    });

    it('keyed on profiles.id = userId (not actorId)', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'update_profile', { bio: 'Test' });

      // The from('profiles').eq('id', ...) chain must have been called
      expect(supabase.from).toHaveBeenCalledWith(DATABASE_TABLES.PROFILES);
      // eq is called on the chain — USER_ID should be used (not ACTOR_ID)
      // We verify via the mock's .eq call — the chain for profiles must be called
      // with eq('id', USER_ID). Since eq returns this, we verify via call order.
      const profileCalls = (supabase.from as Mock).mock.calls.filter(
        ([t]: [string]) => t === DATABASE_TABLES.PROFILES
      );
      expect(profileCalls.length).toBeGreaterThan(0);
    });

    it('returns error when no safe fields are provided', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'update_profile', {
        // Only unsafe fields — nothing valid to update
        email: 'blocked@example.com',
        id: 'injected-id',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/no profile fields/i);
    });

    it('returns a displayMessage listing updated fields', async () => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, 'update_profile', {
        bio: 'New bio',
        website: 'https://example.com',
      });

      expect(result.status).toBe('completed');
      const msg = (result.data as Record<string, unknown>)?.displayMessage as string;
      expect(msg).toContain('✅');
      expect(msg).toContain('bio');
      expect(msg).toContain('website');
    });

    it('includes updated_at in the DB update payload', async () => {
      const supabase = buildMockSupabase();
      await run(supabase, 'update_profile', { name: 'Alice' });

      const update = getEntityUpdate(supabase, DATABASE_TABLES.PROFILES);
      expect(typeof update!.updated_at).toBe('string');
      // Must be a recent ISO timestamp
      const ts = new Date(update!.updated_at as string);
      expect(isNaN(ts.getTime())).toBe(false);
    });
  });

  // ── add_wallet ───────────────────────────────────────────────────────────────

  /**
   * add_wallet mock.
   *
   * The add_wallet handler does TWO queries on the wallets table:
   *   1. A list SELECT (awaited directly after .limit(1)) — returns existing lightning address
   *   2. An INSERT followed by .select().single() — returns the new wallet row
   *
   * To handle the list SELECT, the chain must be "thenable" so that
   * `await chain` resolves to `{ data: [...], error: null }`.
   */
  function buildMockSupabaseForAddWallet(
    existingLightningAddress: string | null = 'alice@getalby.com'
  ) {
    const insertsByTable: Record<string, unknown[]> = {};

    const makeChain = (tableName: string) => {
      let _operation: 'select' | 'insert' | 'update' | 'other' = 'other';

      const chain: Record<string, unknown> = {};

      chain.select = vi.fn(() => {
        _operation = 'select';
        return chain;
      });
      chain.insert = vi.fn((payload: unknown) => {
        _operation = 'insert';
        if (!insertsByTable[tableName]) insertsByTable[tableName] = [];
        insertsByTable[tableName].push(payload);
        return chain;
      });
      chain.update = vi.fn(() => {
        _operation = 'update';
        return chain;
      });
      chain.eq = vi.fn().mockReturnThis();
      chain.not = vi.fn().mockReturnThis();
      chain.order = vi.fn().mockReturnThis();
      chain.limit = vi.fn().mockReturnThis();
      chain.neq = vi.fn().mockReturnThis();
      chain.or = vi.fn().mockReturnThis();
      chain.in = vi.fn().mockReturnThis();
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      // Make chain thenable so `await chain` (for list queries like .limit(1)) resolves correctly.
      // The wallets SELECT returns a list with the lightning address; inserts return the new row.
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
        if (tableName === DATABASE_TABLES.WALLETS && _operation === 'select') {
          resolve({
            data: existingLightningAddress ? [{ lightning_address: existingLightningAddress }] : [],
            error: null,
          });
        } else {
          resolve({ data: [], error: null });
        }
      });

      // single() — used by INSERT .select().single() and by action log
      chain.single = vi.fn().mockImplementation(() => {
        if (tableName === DATABASE_TABLES.WALLETS && _operation === 'insert') {
          return Promise.resolve({
            data: {
              id: 'new-wallet-id',
              label: 'Test Wallet',
              behavior_type: 'one_time_goal',
              category: 'general',
            },
            error: null,
          });
        }
        // action_log table or other
        return Promise.resolve({
          data: { id: 'log-id' },
          error: null,
        });
      });

      return chain;
    };

    const supabase = {
      from: vi.fn((table: string) => makeChain(table)),
      _insertsByTable: insertsByTable,
    };

    return supabase;
  }

  describe('add_wallet', () => {
    it('inserts into the wallets table with correct column names', async () => {
      const supabase = buildMockSupabaseForAddWallet();
      const result = await run(supabase, 'add_wallet', {
        label: 'Vacation Fund',
        behavior_type: 'one_time_goal',
        category: 'general',
        goal_amount: 0.05,
        goal_currency: 'BTC',
        goal_deadline: '2026-12-31',
      });

      expect(result.status).toBe('completed');
      const insert = supabase._insertsByTable[DATABASE_TABLES.WALLETS]?.[0] as Record<
        string,
        unknown
      >;
      expect(insert).toBeDefined();
      expect(insert.label).toBe('Vacation Fund');
      expect(insert.behavior_type).toBe('one_time_goal');
      expect(insert.category).toBe('general');
      expect(insert.goal_amount).toBe(0.05);
      expect(insert.goal_currency).toBe('BTC');
      expect(insert.goal_deadline).toBe('2026-12-31');
    });

    it('uses the existing lightning address from user wallets when none provided', async () => {
      const supabase = buildMockSupabaseForAddWallet('alice@getalby.com');
      await run(supabase, 'add_wallet', {
        label: 'Emergency Fund',
        behavior_type: 'one_time_goal',
      });

      const insert = supabase._insertsByTable[DATABASE_TABLES.WALLETS]?.[0] as Record<
        string,
        unknown
      >;
      expect(insert).toBeDefined();
      expect(insert.lightning_address).toBe('alice@getalby.com');
    });

    it('uses lightning_address param when explicitly provided', async () => {
      const supabase = buildMockSupabaseForAddWallet('alice@getalby.com');
      await run(supabase, 'add_wallet', {
        label: 'Bitcoin Wallet',
        behavior_type: 'general',
        lightning_address: 'custom@wallet.io',
      });

      const insert = supabase._insertsByTable[DATABASE_TABLES.WALLETS]?.[0] as Record<
        string,
        unknown
      >;
      // Provided address takes priority
      expect(insert.lightning_address).toBe('custom@wallet.io');
    });

    it('creates recurring_budget wallet with budget fields', async () => {
      const supabase = buildMockSupabaseForAddWallet();
      await run(supabase, 'add_wallet', {
        label: 'Food Budget',
        behavior_type: 'recurring_budget',
        category: 'food',
        budget_amount: 0.002,
        budget_period: 'monthly',
      });

      const insert = supabase._insertsByTable[DATABASE_TABLES.WALLETS]?.[0] as Record<
        string,
        unknown
      >;
      expect(insert.behavior_type).toBe('recurring_budget');
      expect(insert.budget_amount).toBe(0.002);
      expect(insert.budget_period).toBe('monthly');
      expect(insert.category).toBe('food');
    });

    it('sets profile_id = userId and is_primary = false', async () => {
      const supabase = buildMockSupabaseForAddWallet();
      await run(supabase, 'add_wallet', {
        label: 'My Fund',
        behavior_type: 'general',
      });

      const insert = supabase._insertsByTable[DATABASE_TABLES.WALLETS]?.[0] as Record<
        string,
        unknown
      >;
      expect(insert.profile_id).toBe(USER_ID);
      expect(insert.is_primary).toBe(false);
      expect(insert.is_active).toBe(true);
    });

    it('returns error when label is missing', async () => {
      const supabase = buildMockSupabaseForAddWallet();
      const result = await run(supabase, 'add_wallet', {
        behavior_type: 'one_time_goal',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/label/i);
    });

    it('returns error when no lightning address is available', async () => {
      // buildMockSupabaseForAddWallet(null) → wallets SELECT returns empty array
      const supabase = buildMockSupabaseForAddWallet(null);
      const result = await run(supabase, 'add_wallet', {
        label: 'No Address Fund',
        behavior_type: 'one_time_goal',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toMatch(/lightning address/i);
    });

    it('returns displayMessage with 💰 and wallet name', async () => {
      const supabase = buildMockSupabaseForAddWallet();
      const result = await run(supabase, 'add_wallet', {
        label: 'Vacation Fund',
        behavior_type: 'one_time_goal',
        goal_amount: 0.05,
        goal_currency: 'BTC',
        goal_deadline: '2026-12-31',
      });

      expect(result.status).toBe('completed');
      const msg = (result.data as Record<string, unknown>)?.displayMessage as string;
      expect(msg).toContain('💰');
      expect(msg).toContain('Vacation Fund');
    });
  });
});
