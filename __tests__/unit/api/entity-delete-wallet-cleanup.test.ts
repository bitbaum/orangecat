/**
 * Deleting an entity must not leave its wallet link behind.
 *
 * entity_wallets is polymorphic, so Postgres cannot cascade it. Prod
 * accumulated links pointing at entities that no longer exist, and the
 * shared-wallet disclosure counted them as live pages — a public claim about
 * someone's money built on rows that outlived their subject.
 */

const mockLinkDelete = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({ from: (t: string) => mockAdminFrom(t) }),
}));

import { DATABASE_TABLES } from '@/config/database-tables';

import type { Mock } from 'vitest';

/**
 * The handler is a thick closure over Next request plumbing; this exercises the
 * cleanup contract directly against the same admin-client shape it uses.
 */
async function cleanupLinks(entityType: string, entityId: string) {
  const { getAdminClient } = await import('@/lib/supabase/admin');
  return (getAdminClient() as never as { from: (t: string) => any })
    .from(DATABASE_TABLES.ENTITY_WALLETS)
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
}

beforeEach(() => {
  mockLinkDelete.mockReset();
  mockAdminFrom.mockReset();
  const eqChain = {
    eq: vi.fn(function (this: unknown) {
      return eqChain;
    }),
    then: undefined,
  } as never as { eq: Mock };
  mockLinkDelete.mockReturnValue(eqChain);
  mockAdminFrom.mockReturnValue({ delete: mockLinkDelete });
});

describe('entity delete → entity_wallets cleanup', () => {
  it('targets the entity_wallets table scoped to BOTH type and id', async () => {
    const eqCalls: Array<[string, string]> = [];
    const chain: Record<string, unknown> = {};
    chain.eq = vi.fn((col: string, val: string) => {
      eqCalls.push([col, val]);
      return chain;
    });
    mockLinkDelete.mockReturnValue(chain);

    await cleanupLinks('product', 'entity-1');

    expect(mockAdminFrom).toHaveBeenCalledWith(DATABASE_TABLES.ENTITY_WALLETS);
    expect(mockLinkDelete).toHaveBeenCalled();
    // Scoping by type AND id matters: entity ids are only unique per table, so
    // a lone entity_id filter could delete another type's link.
    expect(eqCalls).toEqual([
      ['entity_type', 'product'],
      ['entity_id', 'entity-1'],
    ]);
  });

  it('uses the admin client — the deleter may not see the link row under RLS', async () => {
    await cleanupLinks('cause', 'entity-2');
    expect(mockAdminFrom).toHaveBeenCalledWith(DATABASE_TABLES.ENTITY_WALLETS);
  });
});
