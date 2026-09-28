/**
 * The overview, rendered on the server from one PersonalFinances object.
 * Every number is in the person's currency; the tax block says "estimate" in
 * the same breath as its number and names its table and sources.
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CIVIC_LEVELS } from '@/config/civic-split';
import { FINANCES_PAGE } from '@/config/finances';
import { ROUTES } from '@/config/routes';
import { TAX_ESTIMATE_COPY } from '@/config/tax-estimates';
import type { PersonalFinances as Finances } from '@/domain/finances/service';
import { APP_LOCALE } from '@/utils/locale';

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-default bg-surface-base p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PersonalFinances({ finances }: { finances: Finances }) {
  const { currency, income, debts, civicSplit, tax } = finances;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Block title={FINANCES_PAGE.income.title}>
        {income.paidOrders + income.settledPayments === 0 ? (
          <p className="text-sm text-fg-secondary">{FINANCES_PAGE.income.empty}</p>
        ) : (
          <>
            <p className="font-heading text-3xl text-fg-primary">
              {income.total === null ? `${income.totalBtc} BTC` : money(income.total, currency)}
            </p>
            <p className="mt-1 text-sm text-fg-tertiary">
              {FINANCES_PAGE.income.hint(income.windowDays)} {income.totalBtc.toFixed(8)} BTC.
            </p>
          </>
        )}
      </Block>

      <Block title={FINANCES_PAGE.debts.title}>
        {debts.length === 0 ? (
          <p className="text-sm text-fg-secondary">{FINANCES_PAGE.debts.empty}</p>
        ) : (
          <ul className="space-y-2">
            {debts.map(debt => (
              <li key={debt.id} className="flex items-baseline justify-between gap-3 text-sm">
                <Link href={debt.href} className="min-w-0 truncate text-fg-primary hover:underline">
                  {debt.title}
                  {debt.lender ? <span className="text-fg-tertiary"> · {debt.lender}</span> : null}
                </Link>
                <span className="shrink-0 text-right">
                  <span className="block font-medium text-fg-primary">
                    {money(debt.remaining, debt.currency)}
                  </span>
                  {debt.monthlyPayment ? (
                    <span className="block text-xs text-fg-tertiary">
                      {money(debt.monthlyPayment, debt.currency)} {FINANCES_PAGE.debts.monthly}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={FINANCES_PAGE.civic.title}>
        {civicSplit ? (
          <>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-fg-primary">
              {CIVIC_LEVELS.map(level => (
                <li key={level.id}>
                  <span className="font-heading text-xl">{civicSplit.shares[level.id]}%</span>{' '}
                  <span className="text-fg-secondary">
                    {level.id === 'locality'
                      ? civicSplit.locality
                      : level.id === 'region'
                        ? civicSplit.region
                        : civicSplit.country_code}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href={ROUTES.DASHBOARD.CIVIC_SPLIT}
              className="mt-3 inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg-primary hover:underline"
            >
              {FINANCES_PAGE.civic.edit}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-fg-secondary">{FINANCES_PAGE.civic.empty}</p>
            <Link
              href={ROUTES.DASHBOARD.CIVIC_SPLIT}
              className="mt-3 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-fg-primary hover:underline"
            >
              {FINANCES_PAGE.civic.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </>
        )}
      </Block>

      <Block title={TAX_ESTIMATE_COPY.title}>
        {tax ? (
          <>
            <p className="font-heading text-3xl text-fg-primary">
              ≈ {money(tax.total, tax.table.currency)}
              <span className="ml-2 text-base text-fg-tertiary">
                {(tax.effectiveRate * 100).toFixed(1)}% of {money(tax.taxableIncome, currency)}
              </span>
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 text-sm text-fg-secondary">
              <dt>Federal</dt>
              <dd className="text-right text-fg-primary">{money(tax.federal, currency)}</dd>
              <dt>Canton and city</dt>
              <dd className="text-right text-fg-primary">
                {money(tax.cantonalAndCommunal, currency)}
              </dd>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-fg-tertiary">
              {TAX_ESTIMATE_COPY.caveat} Table: {tax.table.label}, {tax.table.year}.{' '}
              {tax.table.assumptions.join('; ')}.
            </p>
            <ul className="mt-2 space-y-0.5 text-xs">
              {tax.table.sources.map(source => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    className="text-fg-secondary underline underline-offset-2 hover:text-fg-primary"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {source.name}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-fg-secondary">
            {civicSplit
              ? TAX_ESTIMATE_COPY.noTable(`${civicSplit.locality}, ${civicSplit.region}`)
              : TAX_ESTIMATE_COPY.noPlace}
          </p>
        )}
      </Block>
    </div>
  );
}

export default PersonalFinances;
