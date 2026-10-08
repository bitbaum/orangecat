'use client';

/**
 * "Where your money goes" — the owner's waterfall.
 *
 * Answers the two questions a person has: in what order is my money covering
 * things, and where does the NEXT payment land. Editing happens in
 * MoneyRoutesEditor; what comes back from a save is the server's rule, shown
 * exactly as it will now be applied.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import type { RouteView } from '@/domain/money-routes/service';
import { cn } from '@/lib/utils';
import { MoneyRoutesEditor } from './MoneyRoutesEditor';
import {
  ROUTES_COPY as COPY,
  formatAmount,
  ruleText,
  type RouteOverview,
  type RouteWallet,
} from './moneyRoutesFormat';

export interface MoneyRoutesProps {
  initialLines: RouteView[];
  initialNext: string | null;
  wallets: RouteWallet[];
  /** The person's display currency — the default for a new amount line. */
  currency: string;
}

function LineStatus({ line, isNext }: { line: RouteView; isNext: boolean }) {
  if (isNext) {
    return (
      <span className="rounded-full bg-accent-warm px-2 py-0.5 text-xs font-medium text-on-accent">
        {COPY.next}
      </span>
    );
  }
  if (line.progress.behind) {
    return null;
  }
  return (
    <span className="rounded-full bg-status-positive-subtle px-2 py-0.5 text-xs font-medium text-status-positive">
      {line.kind === 'share' ? COPY.covered.share : COPY.covered[line.period]}
    </span>
  );
}

function RouteLineItem({
  line,
  position,
  wallet,
  isNext,
}: {
  line: RouteView;
  position: number;
  wallet: RouteWallet | undefined;
  isNext: boolean;
}) {
  const { received, target, unit, unvalued } = line.progress;
  const pct = target > 0 ? Math.min(100, (received / target) * 100) : 0;
  return (
    <li
      className={cn(
        'rounded-md border p-3',
        isNext ? 'border-accent-warm bg-surface-raised' : 'border-default'
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-fg-primary">
          <span className="text-fg-tertiary">{position}.</span>{' '}
          <span aria-hidden>{wallet?.icon ?? '💰'}</span> {wallet?.label ?? 'A removed wallet'}
        </p>
        <LineStatus line={line} isNext={isNext} />
      </div>
      <p className="mt-1 text-sm text-fg-secondary">{ruleText(line)}</p>
      <Progress
        className="mt-2 h-1.5"
        value={pct}
        aria-label={`${wallet?.label ?? 'Line'} progress`}
      />
      <p className="mt-1 text-xs text-fg-tertiary">
        {COPY.holds(formatAmount(received, unit), formatAmount(target, unit))}
        {unvalued > 0 && ` · ${COPY.unvalued(unvalued)}`}
      </p>
    </li>
  );
}

export function MoneyRoutes({ initialLines, initialNext, wallets, currency }: MoneyRoutesProps) {
  const [overview, setOverview] = useState<RouteOverview>({
    lines: initialLines,
    next: initialNext,
  });
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const walletById = new Map(wallets.map(w => [w.id, w]));
  const { lines, next } = overview;

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
      ) : editing ? (
        <MoneyRoutesEditor
          lines={lines}
          wallets={wallets}
          currency={currency}
          onSaved={saved => {
            setOverview(saved);
            setEditing(false);
            setNotice(COPY.form.saved);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {lines.length === 0 ? (
            <p className="mt-4 text-sm text-fg-secondary">{COPY.empty}</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {lines.map((line, i) => (
                <RouteLineItem
                  key={line.walletId}
                  line={line}
                  position={i + 1}
                  wallet={walletById.get(line.walletId)}
                  isNext={line.walletId === next}
                />
              ))}
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
            <Button
              variant="secondary"
              onClick={() => {
                setNotice(null);
                setEditing(true);
              }}
            >
              {lines.length === 0 ? COPY.setUp : COPY.edit}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
