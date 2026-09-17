/**
 * My Cat Permission Service
 *
 * Manages user permissions for My Cat actions.
 * Users can grant/revoke permissions for specific action categories or individual actions.
 *
 * Created: 2026-01-21
 * Last Modified: 2026-01-21
 * Last Modified Summary: Initial implementation
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { CAT_ACTIONS, ACTION_CATEGORIES, type ActionCategory } from '@/config/cat-actions';
import type { AiErrorCode } from '@/config/ai-errors';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getActiveAllocationPolicy } from '@/services/solon/allocation-policy';

// ==================== TYPES ====================

interface CatPermission {
  id: string;
  user_id: string;
  action_id: string; // Specific action ID or '*' for category-wide
  category: ActionCategory;
  granted: boolean;
  requires_confirmation: boolean; // Override: always confirm even if action doesn't require it
  daily_limit?: number; // Max executions per day (null = unlimited)
  max_btc_per_action?: number; // Max BTC per payment action (decimal, e.g. 0.001)
  max_btc_per_day?: number; // Max total BTC across payment actions per day
  created_at: string;
  updated_at: string;
}

interface PermissionCheck {
  allowed: boolean;
  /**
   * Why it was refused, as a code the UI can turn into copy + a fix link
   * (@/config/ai-errors). `reason` stays as the audit-log string; it is not
   * user-facing copy and must not be rendered as if it were.
   */
  code?: AiErrorCode;
  reason?: string;
  requiresConfirmation: boolean;
  dailyUsage?: number;
  dailyLimit?: number;
}

export interface SpendCaps {
  maxBtcPerAction: number | null;
  maxBtcPerDay: number | null;
}

export interface SpendCapCheck {
  allowed: boolean;
  code?: AiErrorCode;
  reason?: string;
  /** BTC already spent (or in flight) today across payment actions. */
  spentTodayBtc?: number;
}

interface UserPermissionSummary {
  categories: {
    category: ActionCategory;
    name: string;
    description: string;
    enabled: boolean;
    actionCount: number;
    enabledActionCount: number;
  }[];
  totalActions: number;
  enabledActions: number;
  highRiskEnabled: boolean;
}

// Default permissions for new users - conservative by default.
// Exported so any surface that must show the EFFECTIVE level (settings UI via
// the permissions API) resolves it exactly like checkPermission does.
export const DEFAULT_PERMISSIONS: Partial<Record<ActionCategory, boolean>> = {
  context: true, // Can manage their own context
  entities: false, // Must explicitly enable
  communication: false,
  payments: false, // High risk - never default
  organization: false,
};

/**
 * Per-action defaults that override the category default.
 *
 * `payments: false` is right for actions that MOVE money, and wrong for the one
 * that decides where the user's own money arrives. Without this override,
 * connect_wallet — the action that makes a profile payable at all — is denied
 * for every new user, and the only way to reach it is to enable the whole
 * payments category, which ALSO unlocks send_payment. Defaulting one harmless
 * action on is strictly safer than pushing people to unlock the harmful ones.
 *
 * The bar for adding a row here: the action moves no funds, writes only the
 * user's own row under RLS, and still requires confirmation. An explicitly
 * stored permission always wins — this is a default, not an override of intent.
 */
export const DEFAULT_ACTION_PERMISSIONS: Partial<Record<string, boolean>> = {
  connect_wallet: true,
};

/** Resolve the shipped default for an action: per-action first, then category. */
export function defaultAllowedFor(actionId: string, category: ActionCategory): boolean {
  return DEFAULT_ACTION_PERMISSIONS[actionId] ?? DEFAULT_PERMISSIONS[category] ?? false;
}

/**
 * Combine caps from the matched permission rows (specific action + category '*').
 * The stricter (lower) non-null cap wins. Exported for tests.
 */
export function effectiveSpendCaps(
  rows: { max_btc_per_action?: number | null; max_btc_per_day?: number | null }[]
): SpendCaps {
  const min = (values: (number | null | undefined)[]): number | null => {
    const present = values.filter((v): v is number => typeof v === 'number' && v > 0);
    return present.length > 0 ? Math.min(...present) : null;
  };
  return {
    maxBtcPerAction: min(rows.map(r => r.max_btc_per_action)),
    maxBtcPerDay: min(rows.map(r => r.max_btc_per_day)),
  };
}

// ==================== SERVICE ====================

export class CatPermissionService {
  constructor(private supabase: AnySupabaseClient) {}

  /**
   * Check if a user has permission to execute an action
   */
  async checkPermission(userId: string, actionId: string): Promise<PermissionCheck> {
    const action = CAT_ACTIONS[actionId];
    if (!action) {
      return {
        allowed: false,
        code: 'unknown_action',
        reason: 'Unknown action',
        requiresConfirmation: true,
      };
    }

    if (!action.enabled) {
      return {
        allowed: false,
        code: 'action_disabled',
        reason: 'Action is disabled',
        requiresConfirmation: true,
      };
    }

    // Check for specific action permission first
    const { data: specificPerm } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .select('*')
      .eq('user_id', userId)
      .eq('action_id', actionId)
      .maybeSingle();

    if (specificPerm) {
      if (!specificPerm.granted) {
        return {
          allowed: false,
          code: 'permission_denied',
          reason: 'Permission denied for this action',
          requiresConfirmation: true,
        };
      }

      // Check daily limit
      if (specificPerm.daily_limit) {
        const usage = await this.getDailyUsage(userId, actionId);
        if (usage >= specificPerm.daily_limit) {
          return {
            allowed: false,
            code: 'daily_limit_reached',
            reason: `Daily limit reached (${usage}/${specificPerm.daily_limit})`,
            requiresConfirmation: true,
            dailyUsage: usage,
            dailyLimit: specificPerm.daily_limit,
          };
        }
      }

      return {
        allowed: true,
        requiresConfirmation: specificPerm.requires_confirmation ?? action.requiresConfirmation,
        dailyUsage: specificPerm.daily_limit
          ? await this.getDailyUsage(userId, actionId)
          : undefined,
        dailyLimit: specificPerm.daily_limit ?? undefined,
      };
    }

    // Check category-wide permission
    const { data: categoryPerm } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .select('*')
      .eq('user_id', userId)
      .eq('action_id', '*')
      .eq('category', action.category)
      .maybeSingle();

    if (categoryPerm) {
      if (!categoryPerm.granted) {
        return {
          allowed: false,
          code: 'permission_denied',
          reason: `Permission denied for ${action.category} actions`,
          requiresConfirmation: true,
        };
      }

      return {
        allowed: true,
        requiresConfirmation: categoryPerm.requires_confirmation ?? action.requiresConfirmation,
      };
    }

    // Fall back to defaults
    const defaultAllowed = defaultAllowedFor(action.id, action.category);
    return {
      allowed: defaultAllowed,
      code: defaultAllowed ? undefined : 'permission_denied',
      reason: defaultAllowed ? undefined : 'Permission not granted',
      requiresConfirmation: action.requiresConfirmation,
    };
  }

  /**
   * Enforce BTC spend caps for a payment action.
   *
   * Caps live on cat_permissions rows: the matched specific-action row and/or the
   * category-wide ('*') payments row. When both define a cap the stricter (lower)
   * one wins. Daily spend is derived from cat_action_log.amount_btc — rows still
   * 'executing' count toward the budget (a crash mid-payment may still have
   * settled, so we fail safe).
   */
  async checkSpendCaps(
    userId: string,
    actionId: string,
    amountBtc: number | null,
    options: { excludeLogId?: string } = {}
  ): Promise<SpendCapCheck> {
    const action = CAT_ACTIONS[actionId];
    if (!action || action.category !== 'payments' || !amountBtc || amountBtc <= 0) {
      return { allowed: true };
    }

    const { data: rows } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .select('action_id, max_btc_per_action, max_btc_per_day')
      .eq('user_id', userId)
      .eq('category', action.category)
      .in('action_id', [actionId, '*']);

    const caps = effectiveSpendCaps(rows ?? []);

    if (caps.maxBtcPerAction !== null && amountBtc > caps.maxBtcPerAction) {
      return {
        allowed: false,
        code: 'spend_cap_exceeded',
        reason: `Amount ${amountBtc} BTC exceeds your per-action cap of ${caps.maxBtcPerAction} BTC. Raise the cap in Cat → Permissions if intended.`,
      };
    }

    let spentTodayBtc: number | undefined;
    if (caps.maxBtcPerDay !== null) {
      spentTodayBtc = await this.getDailySpendBtc(userId, options.excludeLogId);
      if (spentTodayBtc + amountBtc > caps.maxBtcPerDay) {
        const remaining = Math.max(0, caps.maxBtcPerDay - spentTodayBtc);
        return {
          allowed: false,
          code: 'spend_cap_exceeded',
          reason: `This payment would exceed your daily budget of ${caps.maxBtcPerDay} BTC (${remaining} BTC remaining today).`,
          spentTodayBtc,
        };
      }
    }

    // Platform-wide ceiling — the Solon-governed allocation policy. This is the
    // Cat's leash for the platform as a whole, an additional min() over the
    // user's own caps. Changing it requires a Bitcoin-signed Solon vote; the
    // limit and its provenance are public at /governance.
    const platform = await getActiveAllocationPolicy(this.supabase);
    if (platform) {
      if (amountBtc > platform.content.max_cat_btc_per_action) {
        return {
          allowed: false,
          code: 'spend_cap_exceeded',
          reason: `Amount ${amountBtc} BTC exceeds the platform's per-action ceiling of ${platform.content.max_cat_btc_per_action} BTC (allocation policy v${platform.version}, set by governance — see /governance).`,
          spentTodayBtc,
        };
      }
      const platformSpentBtc = await this.getPlatformDailySpendBtc(options.excludeLogId);
      if (platformSpentBtc + amountBtc > platform.content.max_cat_daily_spend_btc) {
        const remaining = Math.max(0, platform.content.max_cat_daily_spend_btc - platformSpentBtc);
        return {
          allowed: false,
          code: 'spend_cap_exceeded',
          reason: `This payment would exceed the platform's daily ceiling of ${platform.content.max_cat_daily_spend_btc} BTC (${remaining} BTC remaining today, allocation policy v${platform.version} — see /governance).`,
          spentTodayBtc,
        };
      }
    }

    return { allowed: true, spentTodayBtc };
  }

  /**
   * BTC spent (or in flight) today across all payment actions, from the action log.
   */
  async getDailySpendBtc(userId: string, excludeLogId?: string): Promise<number> {
    return this.sumDailySpendBtc({ userId, excludeLogId });
  }

  /**
   * BTC spent (or in flight) today platform-wide — every user's Cat payments
   * combined. Feeds the Solon-governed allocation policy ceiling.
   */
  async getPlatformDailySpendBtc(excludeLogId?: string): Promise<number> {
    return this.sumDailySpendBtc({ excludeLogId });
  }

  private async sumDailySpendBtc(filter: {
    userId?: string;
    excludeLogId?: string;
  }): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let query = this.supabase
      .from(DATABASE_TABLES.CAT_ACTION_LOG)
      .select('amount_btc')
      .eq('category', 'payments')
      .in('status', ['executing', 'completed'])
      .gte('created_at', today.toISOString());

    if (filter.userId) {
      query = query.eq('user_id', filter.userId);
    }
    // The caller's own in-flight log row must not count against its budget check.
    if (filter.excludeLogId) {
      query = query.neq('id', filter.excludeLogId);
    }

    const { data } = await query;

    return (data ?? []).reduce(
      (sum: number, row: { amount_btc: number | null }) => sum + (row.amount_btc ?? 0),
      0
    );
  }

  /**
   * Current spend caps for the payments category (the '*' row — what the UI edits).
   */
  async getSpendCaps(userId: string): Promise<SpendCaps> {
    const { data } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .select('max_btc_per_action, max_btc_per_day')
      .eq('user_id', userId)
      .eq('category', 'payments')
      .eq('action_id', '*')
      .maybeSingle();

    return {
      maxBtcPerAction: data?.max_btc_per_action ?? null,
      maxBtcPerDay: data?.max_btc_per_day ?? null,
    };
  }

  /**
   * Get daily usage count for an action
   */
  async getDailyUsage(userId: string, actionId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await this.supabase
      .from(DATABASE_TABLES.CAT_ACTION_LOG)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_id', actionId)
      .gte('created_at', today.toISOString());

    return count || 0;
  }

  /**
   * Grant permission for an action or category
   */
  async grantPermission(
    userId: string,
    actionId: string,
    category: ActionCategory,
    options: {
      requiresConfirmation?: boolean;
      dailyLimit?: number | null;
      maxBtcPerAction?: number | null;
      maxBtcPerDay?: number | null;
    } = {}
  ): Promise<CatPermission> {
    const record: Record<string, unknown> = {
      user_id: userId,
      action_id: actionId,
      category,
      granted: true,
      requires_confirmation: options.requiresConfirmation ?? true,
      updated_at: new Date().toISOString(),
    };
    // Limits/caps: omitted = leave as-is (a grant toggle must not wipe them);
    // explicit null = clear.
    if ('dailyLimit' in options) {
      record.daily_limit = options.dailyLimit;
    }
    if ('maxBtcPerAction' in options) {
      record.max_btc_per_action = options.maxBtcPerAction;
    }
    if ('maxBtcPerDay' in options) {
      record.max_btc_per_day = options.maxBtcPerDay;
    }

    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .upsert(record, {
        onConflict: 'user_id,action_id,category',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to grant permission: ${error.message}`);
    }

    return data;
  }

  /**
   * Revoke permission for an action or category
   */
  async revokePermission(
    userId: string,
    actionId: string,
    category: ActionCategory
  ): Promise<void> {
    const { error } = await this.supabase.from(DATABASE_TABLES.CAT_PERMISSIONS).upsert(
      {
        user_id: userId,
        action_id: actionId,
        category,
        granted: false,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,action_id,category',
      }
    );

    if (error) {
      throw new Error(`Failed to revoke permission: ${error.message}`);
    }
  }

  /**
   * Grant all permissions for a category
   */
  async grantCategory(
    userId: string,
    category: ActionCategory,
    options: {
      requiresConfirmation?: boolean;
      dailyLimit?: number | null;
      maxBtcPerAction?: number | null;
      maxBtcPerDay?: number | null;
    } = {}
  ): Promise<void> {
    await this.grantPermission(userId, '*', category, options);
  }

  /**
   * Revoke all permissions for a category
   */
  async revokeCategory(userId: string, category: ActionCategory): Promise<void> {
    // Remove category-wide permission
    await this.revokePermission(userId, '*', category);

    // Also revoke all specific actions in this category
    const { error } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .update({ granted: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('category', category);

    if (error) {
      throw new Error(`Failed to revoke category: ${error.message}`);
    }
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<CatPermission[]> {
    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .select('*')
      .eq('user_id', userId)
      .order('category');

    if (error) {
      throw new Error(`Failed to get permissions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get permission summary for a user (for UI display)
   */
  async getPermissionSummary(userId: string): Promise<UserPermissionSummary> {
    const permissions = await this.getUserPermissions(userId);
    const permissionMap = new Map<string, CatPermission>();

    for (const perm of permissions) {
      permissionMap.set(`${perm.category}:${perm.action_id}`, perm);
    }

    const categories = Object.entries(ACTION_CATEGORIES).map(([cat, meta]) => {
      const category = cat as ActionCategory;
      const actionsInCategory = Object.values(CAT_ACTIONS).filter(
        a => a.category === category && a.enabled
      );

      // Check if category is enabled (either specific category grant or all actions granted)
      const categoryPerm = permissionMap.get(`${category}:*`);
      const categoryEnabled = categoryPerm?.granted ?? DEFAULT_PERMISSIONS[category] ?? false;

      // Count enabled actions
      let enabledCount = 0;
      if (categoryEnabled) {
        enabledCount = actionsInCategory.length;
      } else {
        for (const action of actionsInCategory) {
          const actionPerm = permissionMap.get(`${category}:${action.id}`);
          if (actionPerm?.granted) {
            enabledCount++;
          }
        }
      }

      return {
        category,
        name: meta.name,
        description: meta.description,
        enabled: categoryEnabled || enabledCount > 0,
        actionCount: actionsInCategory.length,
        enabledActionCount: categoryEnabled ? actionsInCategory.length : enabledCount,
      };
    });

    const totalActions = Object.values(CAT_ACTIONS).filter(a => a.enabled).length;
    const enabledActions = categories.reduce((sum, c) => sum + c.enabledActionCount, 0);

    // Check if any high-risk actions are enabled
    const highRiskActions = Object.values(CAT_ACTIONS).filter(
      a => a.riskLevel === 'high' && a.enabled
    );
    let highRiskEnabled = false;
    for (const action of highRiskActions) {
      const perm = await this.checkPermission(userId, action.id);
      if (perm.allowed) {
        highRiskEnabled = true;
        break;
      }
    }

    return {
      categories,
      totalActions,
      enabledActions,
      highRiskEnabled,
    };
  }

  /**
   * Initialize default permissions for a new user
   */
  async initializeDefaults(userId: string): Promise<void> {
    for (const [category, enabled] of Object.entries(DEFAULT_PERMISSIONS)) {
      if (enabled) {
        await this.grantCategory(userId, category as ActionCategory, {
          requiresConfirmation: true,
        });
      }
    }
  }
}

export function createPermissionService(supabase: AnySupabaseClient): CatPermissionService {
  return new CatPermissionService(supabase);
}
