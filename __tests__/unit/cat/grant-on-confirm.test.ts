/**
 * A category Cat was never allowed to touch used to end every action in
 * "Cat isn't allowed to handle entities actions yet" + a link to Settings.
 * Now it is a consent card: confirming allows the category AND runs the
 * action. Money and high-risk actions are excluded from that shortcut.
 */

import { vi } from 'vitest';
import { CatActionExecutor, canGrantOnConfirm } from '@/services/cat/action-executor';
import { DATABASE_TABLES } from '@/config/database-tables';

const checkPermission = vi.fn();
const grantCategory = vi.fn();
vi.mock('@/services/cat/permission-service', () => ({
  CatPermissionService: vi.fn().mockImplementation(function () {
    return {
      checkPermission: (...a: unknown[]) => checkPermission(...a),
      checkSpendCaps: vi.fn().mockResolvedValue({ allowed: true }),
      grantCategory: (...a: unknown[]) => grantCategory(...a),
    };
  }),
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/cat/action-log', () => ({
  extractBtcAmount: () => null,
  logDeniedAction: vi.fn(),
  updateActionLog: vi.fn(),
}));
const handler = vi.fn().mockResolvedValue({ success: true, data: { displayMessage: 'done' } });
vi.mock('@/services/cat/handlers', () => ({
  ACTION_HANDLERS: { create_project_for_person: (...a: unknown[]) => handler(...a) },
}));

function mockSupabase(pendingRow?: Record<string, unknown>) {
  const inserts: Record<string, unknown[]> = {};
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.insert = vi.fn((payload: unknown) => {
      (inserts[table] ??= []).push(payload);
      return chain;
    });
    chain.update = vi.fn().mockReturnThis();
    chain.select = vi.fn().mockReturnThis();
    chain.eq = vi.fn().mockReturnThis();
    chain.single = vi.fn().mockImplementation(async () => {
      if (table === DATABASE_TABLES.CAT_PENDING_ACTIONS && pendingRow) {
        return { data: pendingRow, error: null };
      }
      const last = inserts[table]?.at(-1) as Record<string, unknown> | undefined;
      return { data: { id: 'row-1', expires_at: '2999-01-01', ...last }, error: null };
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.gt = vi.fn().mockReturnThis();
    chain.order = vi.fn().mockReturnThis();
    chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
    return chain;
  });
  return { supabase: { from } as never, inserts };
}

beforeEach(() => {
  checkPermission.mockReset();
  grantCategory.mockReset();
  handler.mockClear();
});

describe('canGrantOnConfirm', () => {
  it('is only for ungranted, non-payment, non-high-risk actions', () => {
    expect(
      canGrantOnConfirm({ category: 'entities', riskLevel: 'medium' }, 'permission_denied')
    ).toBe(true);
    expect(
      canGrantOnConfirm({ category: 'payments', riskLevel: 'medium' }, 'permission_denied')
    ).toBe(false);
    expect(
      canGrantOnConfirm({ category: 'entities', riskLevel: 'high' }, 'permission_denied')
    ).toBe(false);
    expect(
      canGrantOnConfirm({ category: 'entities', riskLevel: 'medium' }, 'daily_limit_reached')
    ).toBe(false);
  });
});

describe('an ungranted category becomes a consent card', () => {
  it('returns pending_confirmation and records grant_on_confirm instead of failing', async () => {
    checkPermission.mockResolvedValue({
      allowed: false,
      code: 'permission_denied',
      reason: 'Permission not granted',
      requiresConfirmation: true,
    });
    const { supabase, inserts } = mockSupabase();
    const executor = new CatActionExecutor(supabase);
    const result = await executor.executeAction('u', 'a', {
      actionId: 'create_project_for_person',
      parameters: { person_name: 'Annushka', title: 'Network' },
    });
    expect(result.status).toBe('pending_confirmation');
    const row = inserts[DATABASE_TABLES.CAT_PENDING_ACTIONS][0] as Record<string, unknown>;
    expect(row.grant_on_confirm).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it('still denies a payment action outright', async () => {
    checkPermission.mockResolvedValue({
      allowed: false,
      code: 'permission_denied',
      reason: 'Permission denied for payments actions',
      requiresConfirmation: true,
    });
    const { supabase } = mockSupabase();
    const executor = new CatActionExecutor(supabase);
    const result = await executor.executeAction('u', 'a', {
      actionId: 'send_payment',
      parameters: { recipient: '@x', amount_btc: 0.001 },
    });
    expect(result.status).toBe('denied');
  });

  it('confirming grants the category (confirm-each-time) BEFORE running', async () => {
    const calls: string[] = [];
    grantCategory.mockImplementation(async () => {
      calls.push('grant');
    });
    handler.mockImplementation(async () => {
      calls.push('run');
      return { success: true, data: { displayMessage: 'done' } };
    });
    const { supabase } = mockSupabase({
      id: 'pending-1',
      action_id: 'create_project_for_person',
      category: 'entities',
      parameters: { person_name: 'Annushka', title: 'Network' },
      status: 'pending',
      expires_at: '2999-01-01T00:00:00Z',
      grant_on_confirm: true,
    });
    const executor = new CatActionExecutor(supabase);
    const result = await executor.confirmPendingAction('u', 'a', 'pending-1');
    expect(result.status).toBe('completed');
    expect(grantCategory).toHaveBeenCalledWith('u', 'entities', { requiresConfirmation: true });
    expect(calls).toEqual(['grant', 'run']);
  });

  it('a card that did not promise a grant does not grant', async () => {
    const { supabase } = mockSupabase({
      id: 'pending-2',
      action_id: 'create_project_for_person',
      category: 'entities',
      parameters: { person_name: 'A', title: 'B' },
      status: 'pending',
      expires_at: '2999-01-01T00:00:00Z',
      grant_on_confirm: false,
    });
    const executor = new CatActionExecutor(supabase);
    await executor.confirmPendingAction('u', 'a', 'pending-2');
    expect(grantCategory).not.toHaveBeenCalled();
  });
});
