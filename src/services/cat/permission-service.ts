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
import { presetAllows, type PermissionPreset } from '@/config/cat-autonomy';
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

import { effectivePermission, DEFAULT_PERMISSIONS } from './effective-permission';
export {
  DEFAULT_PERMISSIONS,
  DEFAULT_ACTION_PERMISSIONS,
  defaultAllowedFor,
} from './effective-permission';

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

    const effective = effectivePermission(actionId, await this.getUserPermissions(userId));
    if (!effective.allowed) {
      return {
        allowed: false,
        code: 'permission_denied',
        reason: 'Permission not granted',
        requiresConfirmation: true,
      };
    }
    const dailyUsage = effective.dailyLimit
      ? await this.getDailyUsage(userId, actionId)
      : undefined;
    if (effective.dailyLimit && dailyUsage !== undefined && dailyUsage >= effective.dailyLimit) {
      return {
        allowed: false,
        code: 'daily_limit_reached',
        reason: `Daily limit reached (${dailyUsage}/${effective.dailyLimit})`,
        requiresConfirmation: true,
        dailyUsage,
        dailyLimit: effective.dailyLimit,
      };
    }
    return { ...effective, dailyUsage };
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

    const { data: rows, error: capsError } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .select('action_id, max_btc_per_action, max_btc_per_day')
      .eq('user_id', userId)
      .eq('category', action.category)
      .in('action_id', [actionId, '*']);

    if (capsError) {
      throw new Error(`Could not verify spending caps: ${capsError.message}`);
    }
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

    const { data, error } = await query;
    if (error) {
      throw new Error(`Could not verify spending usage: ${error.message}`);
    }

    return (data ?? []).reduce(
      (sum: number, row: { amount_btc: number | null }) => sum + (row.amount_btc ?? 0),
      0
    );
  }

  /**
   * Current spend caps for the payments category (the '*' row — what the UI edits).
   */
  async getSpendCaps(userId: string): Promise<SpendCaps> {
    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.CAT_PERMISSIONS)
      .select('max_btc_per_action, max_btc_per_day')
      .eq('user_id', userId)
      .eq('category', 'payments')
      .eq('action_id', '*')
      .maybeSingle();

    if (error) {
      throw new Error(`Could not verify spending caps: ${error.message}`);
    }
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

    const { count, error } = await this.supabase
      .from(DATABASE_TABLES.CAT_ACTION_LOG)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action_id', actionId)
      .gte('created_at', today.toISOString());

    if (error) {
      throw new Error(`Could not verify daily usage: ${error.message}`);
    }
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
    // Editing caps changes only the category row, preserving individual caps
    // and autonomy. A switch without limits applies to every action atomically.
    if ('dailyLimit' in options || 'maxBtcPerAction' in options || 'maxBtcPerDay' in options) {
      await this.grantPermission(userId, '*', category, options);
      return;
    }
    const base = {
      user_id: userId,
      category,
      granted: true,
      requires_confirmation: options.requiresConfirmation ?? true,
      updated_at: new Date().toISOString(),
    };
    const categoryRow: Record<string, unknown> = { ...base, action_id: '*' };
    const { error } = await this.supabase.from(DATABASE_TABLES.CAT_PERMISSIONS).upsert(
      [
        categoryRow,
        ...Object.values(CAT_ACTIONS)
          .filter(a => a.enabled && a.category === category)
          .map(a => ({
            ...base,
            action_id: a.id,
            requires_confirmation: a.riskLevel === 'high' || base.requires_confirmation,
          })),
      ],
      { onConflict: 'user_id,action_id,category', defaultToNull: false }
    );
    if (error) {
      throw new Error(`Failed to grant category: ${error.message}`);
    }
  }

  /**
   * Revoke all permissions for a category
   */
  async revokeCategory(userId: string, category: ActionCategory): Promise<void> {
    const updated_at = new Date().toISOString();
    const choices = [
      '*',
      ...Object.values(CAT_ACTIONS)
        .filter(a => a.category === category)
        .map(a => a.id),
    ];
    const { error } = await this.supabase.from(DATABASE_TABLES.CAT_PERMISSIONS).upsert(
      choices.map(action_id => ({
        user_id: userId,
        action_id,
        category,
        granted: false,
        requires_confirmation: true,
        updated_at,
      })),
      { onConflict: 'user_id,action_id,category', defaultToNull: false }
    );
    if (error) {
      throw new Error(`Failed to revoke category: ${error.message}`);
    }
  }

  /** A single upsert is one database statement: no partially applied preset. */
  async applyPreset(userId: string, preset: PermissionPreset): Promise<void> {
    const updated_at = new Date().toISOString();
    const choices = [
      ...Object.keys(ACTION_CATEGORIES).map(category => ({ action_id: '*', category })),
      ...Object.values(CAT_ACTIONS)
        .filter(a => a.enabled)
        .map(a => ({ action_id: a.id, category: a.category })),
    ];
    const { error } = await this.supabase.from(DATABASE_TABLES.CAT_PERMISSIONS).upsert(
      choices.map(choice => ({
        ...choice,
        user_id: userId,
        granted: presetAllows(preset, choice.category),
        requires_confirmation: true,
        updated_at,
      })),
      { onConflict: 'user_id,action_id,category', defaultToNull: false }
    );
    if (error) {
      throw new Error(`Failed to apply permission preset: ${error.message}`);
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
  async getPermissionSummary(
    userId: string,
    stored?: CatPermission[]
  ): Promise<UserPermissionSummary> {
    const permissions = stored ?? (await this.getUserPermissions(userId));
    const enabled = Object.values(CAT_ACTIONS).filter(a => a.enabled);
    const permitted = enabled.filter(a => effectivePermission(a.id, permissions).allowed);
    const categories = Object.entries(ACTION_CATEGORIES).map(([cat, meta]) => {
      const category = cat as ActionCategory;
      const actions = enabled.filter(a => a.category === category);
      const count = permitted.filter(a => a.category === category).length;
      return {
        category,
        name: meta.name,
        description: meta.description,
        enabled: count > 0,
        actionCount: actions.length,
        enabledActionCount: count,
      };
    });
    const totalActions = enabled.length;
    const enabledActions = permitted.length;
    const highRiskEnabled = permitted.some(a => a.riskLevel === 'high');

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
