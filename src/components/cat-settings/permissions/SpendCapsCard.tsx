'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { Button } from '@/components/ui/Button';
import { AmountField } from '@/components/money/AmountField';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import type { SpendCaps } from './types';

interface SpendCapsCardProps {
  caps: SpendCaps;
  disabled: boolean;
  onSaved: (caps: SpendCaps) => void;
}

/** Smallest cap the field accepts: one satoshi's worth, written in BTC. */
const MIN_CAP_BTC = 0.00000001;
/** No ceiling of its own: the platform's limits apply on top of whatever is set here. */
const MAX_CAP_BTC = 21_000_000;

/** 0 in the field means no cap. */
const toCap = (btc: number): number | null => (btc > 0 ? btc : null);

interface CapFieldProps {
  label: string;
  value: number;
  saved: number | null;
  disabled: boolean;
  onChange: (btc: number) => void;
}

function CapField({ label, value, saved, disabled, onChange }: CapFieldProps) {
  const { formatAmountBtc } = useDisplayCurrency();
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium text-fg-primary">{label}</legend>
      <AmountField
        value={value}
        onChange={onChange}
        minBtc={MIN_CAP_BTC}
        maxBtc={MAX_CAP_BTC}
        label={label}
      />
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-fg-secondary">
          {saved === null ? 'Saved: no cap' : `Saved: ${formatAmountBtc(saved)}`}
        </span>
        {value > 0 && (
          <Button variant="ghost" size="sm" className="min-h-11" onClick={() => onChange(0)}>
            No cap
          </Button>
        )}
      </div>
    </fieldset>
  );
}

export function SpendCapsCard({ caps, disabled, onSaved }: SpendCapsCardProps) {
  // Entry is in the person's own currency; what is held and sent stays BTC.
  const [perAction, setPerAction] = useState(caps.maxBtcPerAction ?? 0);
  const [perDay, setPerDay] = useState(caps.maxBtcPerDay ?? 0);
  const [saving, setSaving] = useState(false);

  const nextPerAction = toCap(perAction);
  const nextPerDay = toCap(perDay);
  const dirty = nextPerAction !== caps.maxBtcPerAction || nextPerDay !== caps.maxBtcPerDay;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(API_ROUTES.CAT.PERMISSIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: '*',
          category: 'payments',
          requiresConfirmation: true,
          maxBtcPerAction: nextPerAction,
          maxBtcPerDay: nextPerDay,
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
      <p className="mb-4 text-sm text-fg-secondary">
        Hard limits on what Cat can pay, even after you confirm.
      </p>
      <div className="space-y-6">
        <CapField
          label="Most Cat may pay at once"
          value={perAction}
          saved={caps.maxBtcPerAction}
          disabled={disabled || saving}
          onChange={setPerAction}
        />
        <CapField
          label="Most Cat may pay in a day"
          value={perDay}
          saved={caps.maxBtcPerDay}
          disabled={disabled || saving}
          onChange={setPerDay}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button className="min-h-11" onClick={save} disabled={disabled || saving || !dirty}>
          {saving ? 'Saving…' : 'Save caps'}
        </Button>
      </div>
    </div>
  );
}
