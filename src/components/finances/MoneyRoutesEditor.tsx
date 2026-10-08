'use client';

/**
 * Editing "Where your money goes": the same ordered list, with its controls.
 *
 * Owns the draft and the save. Saving replaces the whole order in one request;
 * on success it hands the server's answer back, so the view shows the rule
 * exactly as it will now be applied — never the draft it was built from.
 */

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { API_ROUTES } from '@/config/api-routes';
import { CURRENCY_CODES } from '@/config/currencies';
import { COMPONENT_STYLES } from '@/config/design-system';
import type { RouteView } from '@/domain/money-routes/service';
import {
  ROUTES_COPY as COPY,
  selectClass,
  toDraft,
  type DraftLine,
  type RouteOverview,
  type RouteWallet,
} from './moneyRoutesFormat';

export interface MoneyRoutesEditorProps {
  lines: RouteView[];
  wallets: RouteWallet[];
  /** The default currency for a new amount line. */
  currency: string;
  onSaved: (overview: RouteOverview) => void;
  onCancel: () => void;
}

function toRequestLine(d: DraftLine) {
  return d.kind === 'share'
    ? { walletId: d.walletId, kind: 'share', sharePercent: Number(d.sharePercent) }
    : {
        walletId: d.walletId,
        kind: 'fill',
        targetAmount: Number(d.targetAmount),
        targetCurrency: d.targetCurrency,
        period: d.period,
      };
}

export function MoneyRoutesEditor({
  lines,
  wallets,
  currency,
  onSaved,
  onCancel,
}: MoneyRoutesEditorProps) {
  const [drafts, setDrafts] = useState<DraftLine[]>(() => lines.map(toDraft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Wallets not yet in the rule — plus `keep`, the one this line already uses. */
  const available = (keep?: string) =>
    wallets.filter(w => w.id === keep || !drafts.some(d => d.walletId === w.id));

  function update(i: number, patch: Partial<DraftLine>) {
    setDrafts(d => d.map((line, j) => (j === i ? { ...line, ...patch } : line)));
  }

  function move(i: number, by: -1 | 1) {
    setDrafts(d => {
      if (i + by < 0 || i + by >= d.length) {
        return d;
      }
      const copy = [...d];
      [copy[i], copy[i + by]] = [copy[i + by]!, copy[i]!];
      return copy;
    });
  }

  function addLine() {
    const free = available()[0];
    if (!free) {
      return;
    }
    setDrafts(d => [
      ...d,
      {
        walletId: free.id,
        kind: 'fill',
        sharePercent: '',
        targetAmount: '',
        targetCurrency: currency === 'BTC' ? 'CHF' : currency,
        period: 'once',
      },
    ]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.MONEY_ROUTES, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: drafts.map(toRequestLine) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? 'Could not save. Check each line and try again.');
        return;
      }
      onSaved(json.data as RouteOverview);
    } catch {
      setError('Could not reach OrangeCat. Your rule was not changed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {drafts.map((d, i) => (
        <fieldset key={`${d.walletId}-${i}`} className="rounded-md border border-default p-3">
          <legend className="px-1 text-xs text-fg-tertiary">{i + 1}.</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className={COMPONENT_STYLES.field.label}>{COPY.form.wallet}</span>
              <select
                className={selectClass}
                value={d.walletId}
                onChange={e => update(i, { walletId: e.target.value })}
              >
                {available(d.walletId).map(w => (
                  <option key={w.id} value={w.id}>
                    {w.icon} {w.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={COMPONENT_STYLES.field.label}>{COPY.form.kind}</span>
              <select
                className={selectClass}
                value={d.kind}
                onChange={e => update(i, { kind: e.target.value as DraftLine['kind'] })}
              >
                <option value="share">{COPY.form.share}</option>
                <option value="fill">{COPY.form.fill}</option>
              </select>
            </label>
            {d.kind === 'share' ? (
              <Input
                label={COPY.form.percent}
                type="number"
                inputMode="decimal"
                min={0.01}
                max={100}
                step="0.01"
                value={d.sharePercent}
                onChange={e => update(i, { sharePercent: e.target.value })}
              />
            ) : (
              <>
                <Input
                  label={COPY.form.amount}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={d.targetAmount}
                  onChange={e => update(i, { targetAmount: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className={COMPONENT_STYLES.field.label}>{COPY.form.currency}</span>
                    <select
                      className={selectClass}
                      value={d.targetCurrency}
                      onChange={e => update(i, { targetCurrency: e.target.value })}
                    >
                      {CURRENCY_CODES.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className={COMPONENT_STYLES.field.label}>{COPY.form.period}</span>
                    <select
                      className={selectClass}
                      value={d.period}
                      onChange={e => update(i, { period: e.target.value as DraftLine['period'] })}
                    >
                      <option value="once">{COPY.form.once}</option>
                      <option value="monthly">{COPY.form.monthly}</option>
                    </select>
                  </label>
                </div>
              </>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={COPY.form.up}
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => move(i, 1)}
              disabled={i === drafts.length - 1}
              aria-label={COPY.form.down}
            >
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDrafts(ds => ds.filter((_, j) => j !== i))}
              aria-label={COPY.form.remove}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </fieldset>
      ))}

      {available().length > 0 && (
        <Button variant="ghost" onClick={addLine}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          {COPY.form.add}
        </Button>
      )}

      {error && (
        <p className="text-sm text-status-negative" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="accent" onClick={save} isLoading={saving} disabled={saving}>
          {COPY.form.save}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          {COPY.form.cancel}
        </Button>
      </div>
    </div>
  );
}
