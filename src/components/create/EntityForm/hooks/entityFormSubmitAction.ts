import { ZodError } from 'zod';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import type { CreateOwner } from '../../owner';
import { entityEvents } from '@/lib/analytics';
import type { EntityConfig } from '../../types';

interface WizardMode {
  visibleFields: string[];
  onNext?: () => void;
}

interface EntityFormSubmitParams<T extends Record<string, unknown>> {
  config: EntityConfig<T>;
  formStateData: T;
  mode: 'create' | 'edit';
  entityId?: string;
  user: { id: string } | null;
  onSuccess?: (data: T & { id: string }) => void;
  onError?: (error: string) => void;
  clearDraft: () => void;
  setSubmitting: (v: boolean) => void;
  setErrors: (errors: Record<string, string>) => void;
  onEntityCreated: (entity: { id: string; title: string }) => void;
  router: { push: (url: string) => void };
  existingWalletLinkIdRef: { current: string | undefined };
  wizardMode?: WizardMode;
  /** Who will own it (ADR-0004 D8). Defaults to the signed-in user. */
  owner?: CreateOwner;
}

export async function executeEntityFormSubmit<T extends Record<string, unknown>>({
  config,
  formStateData,
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
}: EntityFormSubmitParams<T>): Promise<void> {
  // Wizard intermediate step: validate only visible fields, then advance without submitting.
  if (wizardMode?.onNext) {
    const dataToValidate = { ...config.defaultValues, ...formStateData };
    try {
      config.validationSchema.parse(dataToValidate);
      // Full schema passed — safe to advance
      setErrors({});
      wizardMode.onNext();
    } catch (error) {
      if (error instanceof ZodError) {
        const visibleErrors = error.issues.filter(err =>
          wizardMode.visibleFields.includes(err.path[0] as string)
        );
        if (visibleErrors.length > 0) {
          const fieldErrors: Record<string, string> = {};
          visibleErrors.forEach(err => {
            fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          return;
        }
        // No errors on visible fields — advance (errors on hidden fields caught at final submit)
        setErrors({});
        wizardMode.onNext();
      }
    }
    return;
  }

  try {
    setSubmitting(true);

    const dataToValidate = { ...config.defaultValues, ...formStateData };
    const validatedData = config.validationSchema.parse(dataToValidate);

    // Owner = someone who is not on the platform yet (ADR-0005). First the
    // PERSON: a claim plus a placeholder actor — an identity that can own rows
    // and cannot receive money. Then the thing itself goes down the ordinary
    // rail below with `actor_id` = that placeholder, so it is hers from the
    // first row, and every field, validation and template is the same one a
    // creator uses for themselves.
    let placeholderActorId: string | undefined;
    let claimIdForShare: string | undefined;
    if (mode === 'create' && owner?.kind === 'someone-else') {
      const recipientName = owner.name.trim();
      if (!recipientName) {
        setErrors({ general: 'Who is this for? Add their name.' });
        setSubmitting(false);
        return;
      }
      const claimResponse = await fetch(API_ROUTES.PROFILE_CLAIMS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: recipientName }),
      });
      const claimBody = await claimResponse.json().catch(() => null);
      if (!claimResponse.ok || !claimBody?.success || !claimBody.data?.actorId) {
        setErrors({
          general: apiErrorMessage(claimBody, `Could not set this up for ${recipientName}.`),
        });
        setSubmitting(false);
        return;
      }
      placeholderActorId = claimBody.data.actorId as string;
      claimIdForShare = claimBody.data.id as string;
    }

    const url =
      mode === 'edit' && entityId ? `${config.apiEndpoint}/${entityId}` : config.apiEndpoint;

    // Merge actor_id only on create; edit mode never reassigns ownership.
    const actorIdForCreate = owner?.kind === 'group' ? owner.actorId : placeholderActorId;
    const requestBody =
      mode === 'create' && actorIdForCreate
        ? { ...(validatedData as Record<string, unknown>), actor_id: actorIdForCreate }
        : validatedData;

    const response = await fetch(url, {
      method: mode === 'edit' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `Failed to ${mode} ${config.name.toLowerCase()}`;
      try {
        const errorData = await response.clone().json();
        logger.error('EntityForm: API error response', { errorData }, 'EntityForm');
        errorMessage =
          errorData.error?.message || errorData.message || errorData.error || errorMessage;
      } catch {
        try {
          const text = await response.clone().text();
          logger.error('EntityForm: API error (non-JSON)', { text }, 'EntityForm');
          errorMessage = text || errorMessage;
        } catch (textError) {
          logger.error('EntityForm: Could not read error response', { textError }, 'EntityForm');
        }
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (mode === 'create') {
      clearDraft();
      if (result.data?.id) {
        entityEvents.created(config.type, result.data.id, user?.id);
      }
    }

    const walletId = (formStateData as Record<string, unknown>)._wallet_id as string | undefined;
    // Awaited, and in the safe order. It used to be fire-and-forget, and on
    // edit it DELETED the old link before POSTing the new one: a failed POST
    // (a 429, a 500) left the page with no wallet — payments then fell back to
    // whatever wallet the owner had as default — while the success toast said
    // all was well. Now the new link goes in first, the old one is removed only
    // once it exists, and a failure is said out loud.
    const walletLinked =
      walletId && result.data?.id
        ? await linkWallet({
            entityType: config.type,
            entityId: result.data.id,
            walletId,
            previousLinkId: mode === 'edit' ? existingWalletLinkIdRef.current : null,
          })
        : true;
    if (!walletLinked) {
      toast.warning('Saved — but the wallet could not be attached', {
        description: 'Open this page again and pick the wallet under "Pay into".',
        duration: 8000,
      });
    }

    const showSuccessToast = () =>
      toast.success(`${config.name} ${mode === 'create' ? 'created' : 'updated'} successfully!`, {
        description:
          mode === 'create'
            ? `Your ${config.name.toLowerCase()} "${result.data?.title || result.data?.name || ''}" has been created.`
            : 'Your changes have been saved.',
        duration: 4000,
      });

    if (onSuccess) {
      showSuccessToast();
      onSuccess(result.data);
    } else if (claimIdForShare) {
      // Created for someone else (ADR-0005 D8): the outcome is a LINK, not a
      // page. Land on the screen that hands it over — the link, a message
      // already written, and one tap to send it — rather than on the entity,
      // which belongs to someone who has not seen it yet.
      clearDraft();
      router.push(ROUTES.DASHBOARD.PROFILE_CLAIMS_SHARE(claimIdForShare));
    } else if (mode === 'create' && result.data?.id) {
      onEntityCreated({
        id: result.data.id,
        title: result.data.title || result.data.name || config.name,
      });
    } else {
      showSuccessToast();
      let redirectUrl = config.successUrl;
      if (result.data) {
        redirectUrl = redirectUrl.replace(/:(\w+)/g, (_, field) => result.data[field] || '');
        redirectUrl = redirectUrl.replace(/\[(\w+)\]/g, (_, field) => result.data[field] || '');
      }
      router.push(redirectUrl);
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      error.issues.forEach(err => {
        const path = err.path[0] as string;
        fieldErrors[path] = err.message;
      });
      // Also say it beside the button that was just tapped. Field errors alone
      // left "Create" looking dead: on a long phone form the field is off
      // screen, in an earlier wizard step, or hidden (showWhen, a custom
      // section) and never renders its message at all.
      setErrors({ ...fieldErrors, general: invalidFieldsSummary(config, Object.keys(fieldErrors)) });
    } else {
      const errorMsg =
        error instanceof Error ? error.message : `Failed to ${mode} ${config.name.toLowerCase()}`;
      // Shown once, inline beside the submit button that was just tapped. A
      // toast with the same words also landed at the top of the screen, over
      // the header, five seconds after the person had already read it.
      setErrors({ general: errorMsg });
      if (onError) {
        onError(errorMsg);
      }
    }
  } finally {
    setSubmitting(false);
  }
}

/** "Check these fields: Title, Price." — labels from the config, raw names never. */
export function invalidFieldsSummary<T extends Record<string, unknown>>(
  config: EntityConfig<T>,
  fields: string[]
): string {
  const labels = new Map(
    config.fieldGroups.flatMap(g => (g.fields ?? []).map(f => [f.name as string, f.label] as const))
  );
  const named = [...new Set(fields.map(f => labels.get(f)).filter((l): l is string => !!l))];
  return named.length > 0
    ? `Check ${named.length === 1 ? 'this field' : 'these fields'}: ${named.join(', ')}.`
    : 'Some details need fixing before this can be saved.';
}

/** Link a wallet to an entity; on edit, retire the previous link only after
 *  the new one exists. True when the page ends up pointing at `walletId`. */
async function linkWallet({
  entityType,
  entityId,
  walletId,
  previousLinkId,
}: {
  entityType: string;
  entityId: string;
  walletId: string;
  previousLinkId: string | null | undefined;
}): Promise<boolean> {
  try {
    const res = await fetch(API_ROUTES.ENTITY_WALLETS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, wallet_id: walletId }),
    });
    // 409: this exact wallet is already linked — the page already points there,
    // and the "previous" link IS this one, so it must not be deleted.
    if (res.status === 409) {
      return true;
    }
    if (!res.ok) {
      logger.warn('Failed to link wallet to entity', { status: res.status }, 'EntityForm');
      return false;
    }
    if (previousLinkId) {
      const del = await fetch(`${API_ROUTES.ENTITY_WALLETS}/${previousLinkId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!del.ok) {
        // The new link exists; a leftover old row is untidy, not wrong money.
        logger.warn('Failed to remove previous wallet link', { status: del.status }, 'EntityForm');
      }
    }
    return true;
  } catch (err) {
    logger.warn('Failed to link wallet to entity', { err }, 'EntityForm');
    return false;
  }
}
