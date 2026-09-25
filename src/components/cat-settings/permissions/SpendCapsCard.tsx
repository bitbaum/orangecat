'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import type { SpendCaps } from './types';

interface SpendCapsCardProps {
  caps: SpendCaps;
  disabled: boolean;
  onSaved: (caps: SpendCaps) => void;
}

/** Parse a cap input: empty = no cap (null), otherwise a positive BTC decimal. */
function parseCap(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined; // invalid
  }
  return parsed;
}

export function SpendCapsCard({ caps, disabled, onSaved }: SpendCapsCardProps) {
  const { formatAmountBtc } = useDisplayCurrency();
  const [perAction, setPerAction] = useState(caps.maxBtcPerAction?.toString() ?? '');
  const [perDay, setPerDay] = useState(caps.maxBtcPerDay?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const parsedPerAction = parseCap(perAction);
  const parsedPerDay = parseCap(perDay);
  const invalid = parsedPerAction === undefined || parsedPerDay === undefined;
  const dirty =
    (parsedPerAction ?? null) !== caps.maxBtcPerAction ||
    (parsedPerDay ?? null) !== caps.maxBtcPerDay;

  const save = async () => {
    if (invalid) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(API_ROUTES.CAT.PERMISSIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: '*',
          category: 'payments',
          requiresConfirmation: true,
          maxBtcPerAction: parsedPerAction,
          maxBtcPerDay: parsedPerDay,
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.spendCaps) {
        onSaved(json.data.spendCaps);
        toast.success('Spending caps updated');
      } else {
        toast.error(json.error?.message || 'Failed to update spending caps');
      }
    } catch {
      toast.error('Failed to update spending caps');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-surface-base rounded-lg border border-default p-4">
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="h-4 w-4 text-fg-secondary" />
        <h3 className="text-base font-semibold text-fg-primary">Spending caps</h3>
      </div>
      <p className="text-sm text-fg-secondary mb-4">
        Hard limits on what Cat can pay, even after you confirm. Leave empty for no cap.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-fg-primary">Max per payment (BTC)</span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.00000001"
            min="0"
            placeholder="No cap"
            value={perAction}
            onChange={e => setPerAction(e.target.value)}
            disabled={disabled || saving}
            className="mt-1"
          />
          {typeof parsedPerAction === 'number' && (
            <span className="mt-1 block text-xs text-fg-tertiary">
              ≈ {formatAmountBtc(parsedPerAction)}
            </span>
          )}
        </label>
        <label className="block">
          <span className="text-sm font-medium text-fg-primary">Daily budget (BTC)</span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.00000001"
            min="0"
            placeholder="No cap"
            value={perDay}
            onChange={e => setPerDay(e.target.value)}
            disabled={disabled || saving}
            className="mt-1"
          />
          {typeof parsedPerDay === 'number' && (
            <span className="mt-1 block text-xs text-fg-tertiary">
              ≈ {formatAmountBtc(parsedPerDay)}
            </span>
          )}
        </label>
      </div>
      {invalid && (
        <p className="mt-2 text-sm text-status-negative">Caps must be positive BTC amounts.</p>
      )}
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={save} disabled={disabled || saving || invalid || !dirty}>
          {saving ? 'Saving…' : 'Save caps'}
        </Button>
      </div>
    </div>
  );
}
