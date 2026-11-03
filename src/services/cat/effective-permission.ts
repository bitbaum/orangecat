import { CAT_ACTIONS, type ActionCategory } from '@/config/cat-actions';

export interface PermissionRow {
  action_id: string;
  category: ActionCategory;
  granted: boolean;
  requires_confirmation?: boolean | null;
  daily_limit?: number | null;
}

export const DEFAULT_PERMISSIONS: Partial<Record<ActionCategory, boolean>> = {
  context: true,
  entities: false,
  communication: false,
  payments: false,
  organization: false,
};

export const DEFAULT_ACTION_PERMISSIONS: Partial<Record<string, boolean>> = {
  connect_wallet: true,
  note_transaction: true,
};

export function defaultAllowedFor(actionId: string, category: ActionCategory): boolean {
  return DEFAULT_ACTION_PERMISSIONS[actionId] ?? DEFAULT_PERMISSIONS[category] ?? false;
}

/** The executor and every settings projection use the same precedence. */
export function effectivePermission(actionId: string, rows: readonly PermissionRow[]) {
  const action = CAT_ACTIONS[actionId];
  const row = action
    ? (rows.find(p => p.action_id === actionId && p.category === action.category) ??
      rows.find(p => p.action_id === '*' && p.category === action.category))
    : undefined;
  return {
    allowed: !!action?.enabled && (row?.granted ?? defaultAllowedFor(actionId, action.category)),
    requiresConfirmation:
      !action || action.riskLevel === 'high'
        ? true
        : (row?.requires_confirmation ?? action.requiresConfirmation),
    dailyLimit: row?.daily_limit ?? undefined,
  };
}
