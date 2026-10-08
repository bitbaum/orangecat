'use client';

/**
 * "Where your money goes" — the owner's waterfall, read and edited.
 *
 * Read mode answers the two questions a person has: in what order is my money
 * covering things, and where does the NEXT payment land. Edit mode is the same
 * list with its controls exposed; saving replaces the order in one request and
 * shows the rule exactly as the server will now apply it.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/progress';
import { API_ROUTES } from '@/config/api-routes';
import { CURRENCY_CODES } from '@/config/currencies';
import { COMPONENT_STYLES } from '@/config/design-system';
import { FINANCES_PAGE } from '@/config/finances';
import type { RouteView } from '@/domain/money-routes/service';
import { cn } from '@/lib/utils';
import { APP_LOCALE } from '@/utils/locale';

const COPY = FINANCES_PAGE.routes;

export interface RouteWallet {
  id: string;
  label: string;
  icon: string;
}

export interface MoneyRoutesProps {
  initialLines: RouteView[];
  initialNext: string | null;
  wallets: RouteWallet[];
  /** The person's display currency — the default for a new amount line. */
  currency: string;
}

interface DraftLine {
  walletId: string;
  kind: 'share' | 'fill';
  sharePercent: string;
  targetAmount: string;
  targetCurrency: string;
  period: 'once' | 'monthly';
}

function amount(value: number, currency: string): string {
  if (currency === 'BTC') {
    return `${value.toFixed(8)} BTC`;
  }
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function toDraft(line: RouteView): DraftLine {
  return {
    walletId: line.walletId,
    kind: line.kind,
    sharePercent: line.shareBps === null ? '' : String(line.shareBps / 100),
    targetAmount: line.targetAmount === null ? '' : String(line.targetAmount),
    targetCurrency: line.targetCurrency ?? 'CHF',
    period: line.period,
  };
}

function ruleText(line: RouteView): string {
  if (line.kind === 'share') {
    return COPY.share((line.shareBps ?? 0) / 100);
  }
  const target = amount(line.targetAmount ?? 0, line.targetCurrency ?? 'CHF');
  return line.period === 'monthly' ? COPY.fillMonthly(target) : COPY.fillOnce(target);
}

const selectClass = cn(COMPONENT_STYLES.field.control, 'block h-10 w-full px-3 text-sm');

export function MoneyRoutes({ initialLines, initialNext, wallets, currency }: MoneyRoutesProps) {
  const [lines, setLines] = useState(initialLines);
  const [next, setNext] = useState(initialNext);
  const [drafts, setDrafts] = useState<DraftLine[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const walletById = new Map(wallets.map(w => [w.id, w]));
  const unused = (except?: string) =>
    wallets.filter(w => w.id === except || !drafts?.some(d => d.walletId === w.id));

  function startEditing() {
    setNotice(null);
    setError(null);
    setDrafts(lines.length > 0 ? lines.map(toDraft) : []);
  }

  function update(i: number, patch: Partial<DraftLine>) {
    setDrafts(d => d && d.map((line, j) => (j === i ? { ...line, ...patch } : line)));
  }

  function move(i: number, by: -1 | 1) {
    setDrafts(d => {
      if (!d || i + by < 0 || i + by >= d.length) {
        return d;
      }
      const copy = [...d];
      [copy[i], copy[i + by]] = [copy[i + by]!, copy[i]!];
      return copy;
    });
  }

  function addLine() {
    const free = unused()[0];
    if (!free) {
      return;
    }
    setDrafts(d => [
      ...(d ?? []),
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
    if (!drafts) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        lines: drafts.map(d =>
          d.kind === 'share'
            ? { walletId: d.walletId, kind: 'share', sharePercent: Number(d.sharePercent) }
            : {
                walletId: d.walletId,
                kind: 'fill',
                targetAmount: Number(d.targetAmount),
                targetCurrency: d.targetCurrency,
                period: d.period,
              }
        ),
      };
      const res = await fetch(API_ROUTES.MONEY_ROUTES, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? 'Could not save. Check each line and try again.');
        return;
      }
      setLines(json.data.lines);
      setNext(json.data.next);
      setDrafts(null);
      setNotice(COPY.form.saved);
    } catch {
      setError('Could not reach OrangeCat. Your rule was not changed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="rounded-lg border border-default bg-surface-base p-5"
      aria-labelledby="money-routes-title"
    >
      <h2
        id="money-routes-title"
        className="text-xs font-semibold uppercase tracking-wider text-fg-secondary"
      >
        {COPY.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-fg-secondary">{COPY.lede}</p>
      <p className="mt-1 max-w-2xl text-xs text-fg-tertiary">{COPY.scope}</p>

      {wallets.length === 0 ? (
        <p className="mt-4 text-sm text-fg-secondary">
          {COPY.noWallets}{' '}
          <Link href={COPY.walletsHref} className="font-medium text-fg-primary underline">
            {COPY.walletsCta}
          </Link>
        </p>
      ) : drafts === null ? (
        <>
          {lines.length === 0 ? (
            <p className="mt-4 text-sm text-fg-secondary">{COPY.empty}</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {lines.map((line, i) => {
                const w = walletById.get(line.walletId);
                const isNext = line.walletId === next;
                const pct =
                  line.progress.target > 0
                    ? Math.min(100, (line.progress.received / line.progress.target) * 100)
                    : 0;
                return (
                  <li
                    key={line.walletId}
                    className={cn(
                      'rounded-md border p-3',
                      isNext ? 'border-accent-warm bg-surface-raised' : 'border-default'
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-fg-primary">
                        <span className="text-fg-tertiary">{i + 1}.</span>{' '}
                        <span aria-hidden>{w?.icon ?? '💰'}</span> {w?.label ?? 'A removed wallet'}
                      </p>
                      {isNext ? (
                        <span className="rounded-full bg-accent-warm px-2 py-0.5 text-xs font-medium text-on-accent">
                          {COPY.next}
                        </span>
                      ) : (
                        !line.progress.behind && (
                          <span className="rounded-full bg-status-positive-subtle px-2 py-0.5 text-xs font-medium text-status-positive">
                            {line.kind === 'share' ? COPY.covered.share : COPY.covered[line.period]}
                          </span>
                        )
                      )}
                    </div>
                    <p className="mt-1 text-sm text-fg-secondary">{ruleText(line)}</p>
                    <Progress
                      className="mt-2 h-1.5"
                      value={pct}
                      aria-label={`${w?.label ?? 'Line'} progress`}
                    />
                    <p className="mt-1 text-xs text-fg-tertiary">
                      {COPY.holds(
                        amount(line.progress.received, line.progress.unit),
                        amount(line.progress.target, line.progress.unit)
                      )}
                      {line.progress.unvalued > 0 && ` · ${COPY.unvalued(line.progress.unvalued)}`}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
          {lines.length > 0 && next === null && (
            <p className="mt-3 text-sm text-fg-secondary">{COPY.satisfied}</p>
          )}
          {notice && (
            <p className="mt-3 text-sm text-fg-secondary" role="status">
              {notice}
            </p>
          )}
          <div className="mt-4">
            <Button variant="secondary" onClick={startEditing}>
              {lines.length === 0 ? COPY.setUp : COPY.edit}
            </Button>
          </div>
        </>
      ) : (
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
                    {unused(d.walletId).map(w => (
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
                          onChange={e =>
                            update(i, { period: e.target.value as DraftLine['period'] })
                          }
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
                  onClick={() => setDrafts(ds => ds && ds.filter((_, j) => j !== i))}
                  aria-label={COPY.form.remove}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </fieldset>
          ))}

          {unused().length > 0 && (
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
            <Button variant="ghost" onClick={() => setDrafts(null)} disabled={saving}>
              {COPY.form.cancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
