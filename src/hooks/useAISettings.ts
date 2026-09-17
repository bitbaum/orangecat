'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { ModelTier } from '@/config/ai-models';
import type { Database } from '@/types/database';
import { hasActiveByok, type UserApiKey } from '@/services/ai/api-key-service';
import { applyOrderToKeys, platformPositionFromOrder } from '@/services/ai/key-chain';
import { API_ROUTES } from '@/config/api-routes';
import { useAISettingsMutations } from './useAISettingsMutations';

// ==================== TYPES ====================

export interface UserAIPreferences {
  id: string;
  user_id: string;
  default_model_id: string | null;
  default_tier: ModelTier;
  auto_router_enabled: boolean;
  max_cost_btc: number;
  require_vision: boolean;
  require_function_calling: boolean;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  onboarding_step: number;
  /** Consent: may Cat extract + store memories from conversations? Gates extractAndStoreMemories. */
  memory_enabled: boolean;
  proactive_suggestions_enabled: boolean;
  /** Standing instructions injected into the Cat system prompt (null = none). */
  custom_instructions: string | null;
  /** The free platform default's position in the Cat fallback chain (0 = first). */
  platform_chain_position: number;
  cached_total_requests: number;
  cached_total_tokens: number;
  cached_total_cost_btc: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fill the column defaults the DB declares but the schema types can't express:
 * every nullable column here is `DEFAULT`-backed, so a row read back may still
 * carry `null` if it was written explicitly. The UI treats these as settings
 * with values, so normalize once, on read.
 */
function normalizePreferences(
  row: Database['public']['Tables']['user_ai_preferences']['Row']
): UserAIPreferences {
  return {
    ...row,
    default_tier: (row.default_tier ?? 'economy') as ModelTier,
    auto_router_enabled: row.auto_router_enabled ?? true,
    max_cost_btc: row.max_cost_btc ?? 100,
    require_vision: row.require_vision ?? false,
    require_function_calling: row.require_function_calling ?? false,
    onboarding_completed: row.onboarding_completed ?? false,
    onboarding_step: row.onboarding_step ?? 0,
    cached_total_requests: row.cached_total_requests ?? 0,
    cached_total_tokens: row.cached_total_tokens ?? 0,
    cached_total_cost_btc: row.cached_total_cost_btc ?? 0,
    // The column landed in 20260917150000; `database.generated.ts` is
    // regenerated as its own chore PR and does not know about it yet, so read
    // it structurally. `?? true` is the same default the migration declares —
    // a row written before the column existed must not read as "opted out".
    proactive_suggestions_enabled:
      (row as { proactive_suggestions_enabled?: boolean | null }).proactive_suggestions_enabled ??
      true,
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
  };
}

export interface AISettingsState {
  preferences: UserAIPreferences | null;
  keys: UserApiKey[];
  isLoading: boolean;
  error: string | null;
  hasByok: boolean;
  primaryKey: UserApiKey | null;
}

// ==================== HOOK ====================

export function useAISettings() {
  const [state, setState] = useState<AISettingsState>({
    preferences: null,
    keys: [],
    isLoading: true,
    error: null,
    hasByok: false,
    primaryKey: null,
  });

  // Fetch preferences and keys
  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Not authenticated',
        }));
        return;
      }

      // Fetch preferences. `maybeSingle()` returns `null` (not 406) when a
      // user has no preferences row yet — the row is created lazily on first
      // mutation by useAISettingsMutations.
      const { data: prefsData } = await supabase
        .from(DATABASE_TABLES.USER_AI_PREFERENCES)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch API keys
      const { data: keysData } = await supabase
        .from(DATABASE_TABLES.USER_API_KEYS)
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      const keys: UserApiKey[] = keysData || [];
      const primaryKey = keys.find((k: UserApiKey) => k.is_primary) || keys[0] || null;

      setState({
        preferences: prefsData ? normalizePreferences(prefsData) : null,
        keys,
        isLoading: false,
        error: null,
        hasByok: hasActiveByok(keys),
        primaryKey,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch settings',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const {
    updatePreferences,
    addKey,
    deleteKey,
    setPrimaryKey,
    completeOnboarding,
    updateOnboardingStep,
  } = useAISettingsMutations({
    preferences: state.preferences,
    setState,
    fetchData,
  });

  // Reorder the fallback chain. Optimistically reflects the new order, then
  // persists via PATCH; reverts to server truth if it fails.
  const reorderKeys = useCallback(
    async (orderedIds: string[]) => {
      setState(prev => {
        // Optimistic: stamp new chain indexes via the shared ordering rule so
        // the merged-chain UI reflects the move before the server round-trip.
        const platformIdx = platformPositionFromOrder(orderedIds);
        const preferences =
          prev.preferences && platformIdx >= 0
            ? { ...prev.preferences, platform_chain_position: platformIdx }
            : prev.preferences;
        return { ...prev, keys: applyOrderToKeys(prev.keys, orderedIds), preferences };
      });
      const res = await fetch(API_ROUTES.USER.API_KEYS, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderedIds }),
      });
      if (!res.ok) {
        await fetchData();
        throw new Error('Failed to reorder keys');
      }
      await fetchData();
    },
    [fetchData]
  );

  return {
    // State
    ...state,

    // Actions
    fetchData,
    updatePreferences,
    addKey,
    deleteKey,
    setPrimaryKey,
    reorderKeys,
    completeOnboarding,
    updateOnboardingStep,
  };
}

export default useAISettings;
