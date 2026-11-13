'use client';

/**
 * WalletVisibilityToggle — owner control for a fundraise's transparency level.
 *
 * Sets entity_wallets.visibility (private | total | public) for a wallet linked
 * to an entity. Options come from the SSOT in config/wallet-visibility.ts, so
 * the three levels never drift from the DB CHECK constraint. Ownership is
 * enforced server-side by RLS; this control just PATCHes and reports.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2 } from 'lucide-react';
import type { EntityType } from '@/config/entity-registry';
import { WALLET_VISIBILITY_OPTIONS, type WalletVisibility } from '@/config/wallet-visibility';
import { API_ROUTES } from '@/config/api-routes';
import { cn } from '@/lib/utils';

interface WalletVisibilityToggleProps {
  walletId: string;
  entityType: EntityType;
  entityId: string;
  initialVisibility: WalletVisibility;
}

export function WalletVisibilityToggle({
  walletId,
  entityType,
  entityId,
  initialVisibility,
}: WalletVisibilityToggleProps) {
  const [visibility, setVisibility] = useState<WalletVisibility>(initialVisibility);
  const [pending, setPending] = useState<WalletVisibility | null>(null);

  async function select(next: WalletVisibility) {
    if (next === visibility || pending) {
      return;
    }
    const previous = visibility;
    setPending(next);
    setVisibility(next); // optimistic
    try {
      const res = await fetch(API_ROUTES.WALLETS.ENTITY_VISIBILITY, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_id: walletId,
          entity_type: entityType,
          entity_id: entityId,
          visibility: next,
        }),
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      toast.success('Funding visibility updated');
    } catch (err) {
      setVisibility(previous); // roll back
      toast.error('Could not update funding visibility');
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-fg-primary">Funding visibility</legend>
      <div className="space-y-2">
        {WALLET_VISIBILITY_OPTIONS.map(option => {
          const active = option.value === visibility;
          const isPending = option.value === pending;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => void select(option.value)}
              disabled={Boolean(pending)}
              aria-pressed={active}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                active
                  ? 'border-fg-primary bg-surface-raised'
                  : 'border-default hover:bg-surface-raised',
                pending && !isPending && 'opacity-60'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  active ? 'border-fg-primary bg-fg-primary text-fg-inverted' : 'border-default'
                )}
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : active ? (
                  <Check className="h-3 w-3" />
                ) : null}
              </span>
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-fg-primary">{option.label}</span>
                <span className="block text-xs text-fg-secondary">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
