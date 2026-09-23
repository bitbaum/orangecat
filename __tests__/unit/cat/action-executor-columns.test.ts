/**
 * Cat action executor — forbidden / required column names.
 *
 * April 2026: handlers wrote price_btc, goal_btc, hourly_rate_btc, etc. Every
 * create failed at runtime. This file pins that class of bug in ONE table, not
 * ninety-four cases that restated every default. Edge-case behaviour of each
 * create path belongs next to the handler, not here.
 */

import { CatActionExecutor } from '@/services/cat/action-executor';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';

vi.mock('@/services/cat/permission-service', () => ({
  CatPermissionService: vi.fn().mockImplementation(function () {
    return {
      checkPermission: vi.fn().mockResolvedValue({ allowed: true, requiresConfirmation: false }),
      checkSpendCaps: vi.fn().mockResolvedValue({ allowed: true }),
    };
  }),
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function buildMockSupabase() {
  const insertsByTable: Record<string, unknown[]> = {};
  const updatesByTable: Record<string, unknown[]> = {};

  const makeChain = (tableName: string) => {
    const chain: Record<string, unknown> = {};
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
    chain.single = vi
      .fn()
      .mockResolvedValue({ data: { id: 'mock-id', title: 'mock' }, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
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

  return {
    from: vi.fn((table: string) => makeChain(table)),
    _insertsByTable: insertsByTable,
    _updatesByTable: updatesByTable,
  };
}

const USER_ID = 'user-123';
const ACTOR_ID = 'actor-456';

async function run(
  supabase: ReturnType<typeof buildMockSupabase>,
  actionId: string,
  parameters: Record<string, unknown>
) {
  return new CatActionExecutor(supabase as never).executeAction(USER_ID, ACTOR_ID, {
    actionId,
    parameters,
  });
}

function firstInsert(
  supabase: ReturnType<typeof buildMockSupabase>,
  tableName: string
): Record<string, unknown> {
  const row = supabase._insertsByTable[tableName]?.[0] as Record<string, unknown> | undefined;
  expect(row, `expected insert into ${tableName}`).toBeDefined();
  return row!;
}

/** The regressions that burned production: wrong money / ownership columns. */
const CASES: Array<{
  actionId: string;
  table: string;
  parameters: Record<string, unknown>;
  expect: Record<string, unknown>;
  forbid: string[];
}> = [
  {
    actionId: 'create_product',
    table: ENTITY_REGISTRY.product.tableName,
    parameters: { title: 'Widget', price_btc: 0.001, category: 'electronics' },
    expect: { price: 0.001, currency: 'BTC', actor_id: ACTOR_ID, user_id: USER_ID },
    forbid: ['price_btc'],
  },
  {
    actionId: 'create_service',
    table: ENTITY_REGISTRY.service.tableName,
    parameters: { title: 'Consulting', hourly_rate_btc: 0.0005 },
    expect: { hourly_rate: 0.0005, currency: 'BTC' },
    forbid: ['hourly_rate_btc'],
  },
  {
    actionId: 'create_service',
    table: ENTITY_REGISTRY.service.tableName,
    parameters: { title: 'Fixed', fixed_price_btc: 0.01 },
    expect: { fixed_price: 0.01 },
    forbid: ['fixed_price_btc'],
  },
  {
    actionId: 'create_project',
    table: ENTITY_REGISTRY.project.tableName,
    parameters: { title: 'Space', goal_btc: 1.5 },
    expect: { goal_amount: 1.5, currency: 'BTC' },
    forbid: ['goal_btc'],
  },
  {
    actionId: 'create_cause',
    table: ENTITY_REGISTRY.cause.tableName,
    parameters: { title: 'Cause', goal_btc: 10, category: 'climate' },
    expect: { target_amount: 10, cause_category: 'climate' },
    forbid: ['goal_btc', 'category'],
  },
  {
    actionId: 'create_investment',
    table: ENTITY_REGISTRY.investment.tableName,
    parameters: { title: 'Fund', target_amount_btc: 1.5, minimum_investment_btc: 0.001 },
    expect: { target_amount: 1.5, minimum_investment: 0.001 },
    forbid: ['target_amount_btc', 'minimum_investment_btc'],
  },
  {
    actionId: 'create_loan',
    table: ENTITY_REGISTRY.loan.tableName,
    parameters: { title: 'Loan', amount_btc: 0.05 },
    expect: { original_amount: 0.05 },
    forbid: ['amount_btc', 'amount_sats'],
  },
  {
    actionId: 'create_organization',
    table: ENTITY_REGISTRY.group.tableName,
    parameters: { name: 'Circle', type: 'circle' },
    expect: { label: 'circle' },
    forbid: ['type'],
  },
  {
    actionId: 'create_task',
    table: DATABASE_TABLES.TASKS,
    parameters: { title: 'Do it', priority: 'medium' },
    expect: { current_status: 'idle', priority: 'normal' },
    forbid: ['status'],
  },
  {
    actionId: 'create_research',
    table: ENTITY_REGISTRY.research.tableName,
    parameters: { title: 'Paper', funding_goal_btc: 0.5 },
    expect: { user_id: USER_ID, funding_goal_btc: 0.5 },
    forbid: ['actor_id', 'goal_btc', 'funding_goal_sats'],
  },
];

describe('Cat action-executor — column contract', () => {
  it.each(CASES)(
    '$actionId writes the live columns and never the retired ones',
    async ({ actionId, table, parameters, expect: want, forbid }) => {
      const supabase = buildMockSupabase();
      const result = await run(supabase, actionId, parameters);
      expect(result.status).toBe('completed');
      const insert = firstInsert(supabase, table);
      for (const [key, value] of Object.entries(want)) {
        expect(insert[key], key).toEqual(value);
      }
      for (const key of forbid) {
        expect(insert[key], `forbidden ${key}`).toBeUndefined();
      }
    }
  );

  it('archive_entity sets status=archived on the registry table', async () => {
    const supabase = buildMockSupabase();
    const result = await run(supabase, 'archive_entity', {
      entity_type: 'product',
      entity_id: 'mock-id',
    });
    expect(result.status).toBe('completed');
    const update = supabase._updatesByTable[ENTITY_REGISTRY.product.tableName]?.[0] as
      Record<string, unknown> | undefined;
    expect(update?.status).toBe('archived');
  });
});
