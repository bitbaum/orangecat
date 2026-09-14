'use client';

import { fromTable } from '@/lib/supabase/untyped';
import { useCallback } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { API_ROUTES } from '@/config/api-routes';
import { unwrapApiResponse } from '@/lib/api/client-response';
import type { AISettingsState, UserAIPreferences } from './useAISettings';
import type { AddKeyInput } from '@/data/aiProviders';
import type { Dispatch, SetStateAction } from 'react';

interface MutationsProps {
  preferences: UserAIPreferences | null;
  setState: Dispatch<SetStateAction<AISettingsState>>;
  fetchData: () => Promise<void>;
}

interface UseAISettingsMutationsReturn {
  updatePreferences: (updates: Partial<UserAIPreferences>) => Promise<UserAIPreferences>;
  addKey: (params: AddKeyInput) => Promise<void>;
  deleteKey: (keyId: string) => Promise<void>;
  setPrimaryKey: (keyId: string) => Promise<void>;
  completeOnboarding: () => Promise<UserAIPreferences>;
  updateOnboardingStep: (step: number) => Promise<UserAIPreferences>;
}

export function useAISettingsMutations({
  preferences,
  setState,
  fetchData,
}: MutationsProps): UseAISettingsMutationsReturn {
  const updatePreferences = useCallback(
    async (updates: Partial<UserAIPreferences>): Promise<UserAIPreferences> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      if (!preferences) {
        const { data, error } = await fromTable(supabase, DATABASE_TABLES.USER_AI_PREFERENCES)
          .insert({ user_id: user.id, ...updates })
          .select()
          .single();

        if (error) {
          throw error;
        }

        setState(prev => ({ ...prev, preferences: data }));
        return data;
      }

      const { data, error } = await fromTable(supabase, DATABASE_TABLES.USER_AI_PREFERENCES)
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setState(prev => ({ ...prev, preferences: data }));
      return data;
    },
    [preferences, setState]
  );

  const addKey = useCallback(
    async (params: AddKeyInput) => {
      const response = await fetch(API_ROUTES.USER.API_KEYS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      await unwrapApiResponse(response, 'Failed to add key');
      await fetchData();
    },
    [fetchData]
  );

  const deleteKey = useCallback(
    async (keyId: string) => {
      const response = await fetch(`${API_ROUTES.USER.API_KEYS}/${keyId}`, {
        method: 'DELETE',
      });

      await unwrapApiResponse(response, 'Failed to delete key');
      await fetchData();
    },
    [fetchData]
  );

  const setPrimaryKey = useCallback(
    async (keyId: string) => {
      const response = await fetch(`${API_ROUTES.USER.API_KEYS}/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      });

      await unwrapApiResponse(response, 'Failed to set primary key');
      await fetchData();
    },
    [fetchData]
  );

  const completeOnboarding = useCallback(
    () =>
      updatePreferences({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      }),
    [updatePreferences]
  );

  const updateOnboardingStep = useCallback(
    (step: number) => updatePreferences({ onboarding_step: step }),
    [updatePreferences]
  );

  return {
    updatePreferences,
    addKey,
    deleteKey,
    setPrimaryKey,
    completeOnboarding,
    updateOnboardingStep,
  };
}
