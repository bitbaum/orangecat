import { CAT_ACTIONS } from '@/config/cat-actions';
import { CatPermissionService } from '@/services/cat/permission-service';
import { effectivePermission, type PermissionRow } from '@/services/cat/effective-permission';

const action = CAT_ACTIONS.create_project_for_person;
const category: PermissionRow = { action_id: '*', category: action.category, granted: true };

it('a specific denial wins over a category grant in execution and the summary', async () => {
  const rows: PermissionRow[] = [category, { ...category, action_id: action.id, granted: false }];
  expect(effectivePermission(action.id, rows).allowed).toBe(false);
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: async () => ({ data: rows, error: null }),
  };
  const service = new CatPermissionService({ from: () => chain } as never);
  expect((await service.checkPermission('user', action.id)).allowed).toBe(false);
  const summary = await service.getPermissionSummary('user');
  const entities = summary.categories.find(c => c.category === action.category)!;
  expect(entities.enabledActionCount).toBe(entities.actionCount - 1);
});

it('includes safe per-action defaults and lets an explicit category denial override them', () => {
  expect(effectivePermission('connect_wallet', []).allowed).toBe(true);
  expect(
    effectivePermission('connect_wallet', [
      { action_id: '*', category: 'payments', granted: false },
    ]).allowed
  ).toBe(false);
});

it('never makes a high-risk action automatic, including legacy category grants', () => {
  const risky = Object.values(CAT_ACTIONS).find(a => a.enabled && a.riskLevel === 'high')!;
  expect(
    effectivePermission(risky.id, [
      { action_id: '*', category: risky.category, granted: true, requires_confirmation: false },
    ])
  ).toMatchObject({ allowed: true, requiresConfirmation: true });
});

it('applies a complete preset in one statement and propagates a failed write', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const service = new CatPermissionService({ from: () => ({ upsert }) } as never);
  await service.applyPreset('user', 'none');
  expect(upsert).toHaveBeenCalledTimes(1);
  const rows = upsert.mock.calls[0][0] as Array<PermissionRow & { user_id: string }>;
  expect(rows.filter(r => r.action_id !== '*')).toHaveLength(
    Object.values(CAT_ACTIONS).filter(a => a.enabled).length
  );
  expect(rows.every(r => !r.granted && r.user_id === 'user' && r.requires_confirmation)).toBe(true);
  upsert.mockResolvedValue({ error: { message: 'write failed' } });
  await expect(service.applyPreset('user', 'power')).rejects.toThrow('write failed');
});
