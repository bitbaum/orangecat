'use client';

import type { CreateOwner } from '../../owner';
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import type { EntityConfig, FormState } from '../../types';
import { executeEntityFormSubmit } from './entityFormSubmitAction';

interface WizardMode {
  currentStep: number;
  totalSteps: number;
  visibleFields: string[];
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  isLastStep?: boolean;
}

interface UseEntityFormSubmitParams<T extends Record<string, unknown>> {
  config: EntityConfig<T>;
  formState: FormState<T>;
  mode: 'create' | 'edit';
  entityId?: string;
  user: { id: string } | null;
  onSuccess?: (data: T & { id: string }) => void;
  onError?: (error: string) => void;
  clearDraft: () => void;
  setSubmitting: (v: boolean) => void;
  setErrors: (errors: Record<string, string>) => void;
  onEntityCreated: (entity: { id: string; title: string }) => void;
  handleFieldChange: (name: keyof T, value: unknown) => void;
  wizardMode?: WizardMode;
  /** Selected actor (null = personal). Sent as `actor_id` in the create body. */
  /** Who will own it (ADR-0004 D8). Defaults to the signed-in user. */
  owner?: CreateOwner;
}

export function useEntityFormSubmit<T extends Record<string, unknown>>({
  config,
  formState,
  mode,
  entityId,
  user,
  onSuccess,
  onError,
  clearDraft,
  setSubmitting,
  setErrors,
  onEntityCreated,
  handleFieldChange,
  wizardMode,
  owner,
}: UseEntityFormSubmitParams<T>) {
  const router = useRouter();
  const existingWalletLinkIdRef = useRef<string | undefined>(undefined);

  // Load the entity's existing wallet link once when editing. Keyed on entityId
  // via a ref: without this guard the effect re-ran on every render (its
  // `handleFieldChange` dep is a fresh identity each render, and the effect
  // itself calls handleFieldChange → state write → re-render), hammering
  // /api/entity-wallets in an infinite loop.
  const walletLinkFetchedForRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const hasWalletGroup = config.fieldGroups.some(g => g.customComponent);
    if (mode !== 'edit' || !entityId || !hasWalletGroup) {
      return;
    }
    if (walletLinkFetchedForRef.current === entityId) {
      return;
    }
    walletLinkFetchedForRef.current = entityId;

    fetch(`${API_ROUTES.ENTITY_WALLETS}?entity_type=${config.type}&entity_id=${entityId}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        const link = data.data?.[0];
        if (link?.wallet_id) {
          handleFieldChange('_wallet_id' as keyof T, link.wallet_id);
          existingWalletLinkIdRef.current = link.id;
        }
      })
      .catch((err: unknown) => {
        logger.warn('Wallet link failed (non-blocking)', { err }, 'EntityForm');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per entityId; config.type/handleFieldChange read but must not re-trigger
  }, [mode, entityId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await executeEntityFormSubmit({
        config,
        formStateData: formState.data,
        mode,
        entityId,
        user,
        onSuccess,
        onError,
        clearDraft,
        setSubmitting,
        setErrors,
        onEntityCreated,
        router,
        existingWalletLinkIdRef,
        wizardMode,
        owner,
      });
    },
    [
      config,
      formState.data,
      mode,
      entityId,
      onSuccess,
      onError,
      router,
      clearDraft,
      setSubmitting,
      setErrors,
      user,
      onEntityCreated,
      wizardMode,
      owner,
    ]
  );

  return { handleSubmit };
}
