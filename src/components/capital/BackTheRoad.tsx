import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { formatCurrency } from '@/services/currency';
import type {
  CapitalRail,
  CapitalRailKind,
  OpenCapital,
  OpenRail,
} from '@/services/capital/open-capital';

/**
 * Back the road — the money behind a product, in the open, under its roadmap.
 *
 * Three rails, from no strings to more strings: fund (a gift toward the road),
 * lend (repaid on stated terms), invest (a return is owed). Each card carries
 * the live figure from the public ledger and goes straight to the entity where
 * the reader acts. A rail that is not open says so and points at one that is —
 * never hidden, never a dead end.
 */

const RAILS: Record<
  CapitalRailKind,
  { label: string; strings: string; closed: string; action: string }
> = {
  fund: {
    label: 'Fund',
    strings: 'A gift toward the road. No strings, no repayment.',
    closed: 'The funding project is not public right now.',
    action: 'Fund it',
  },
  lend: {
    label: 'Lend',
    strings: 'Repaid to you on stated terms: amount, interest and term up front.',
    closed: 'No loan is open. When one is, its amount, interest and term will be here first.',
    action: 'See the loan',
  },
  invest: {
    label: 'Invest',
    strings: 'Capital for a return. You share in what it earns, and in the risk.',
    closed: 'No investment offering is open.',
    action: 'Read the terms',
  },
};

export function BackTheRoad({ capital }: { capital: OpenCapital }) {
  const { fund, lend, invest } = capital.rails;
  const fallback = [fund, invest].find((r): r is OpenRail => r.open) ?? null;
  return (
    <section aria-labelledby="back-the-road" className="mt-20">
      <p className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
        Capital in the open
      </p>
      <h2 id="back-the-road" className="mt-3 text-2xl font-semibold text-fg-primary sm:text-3xl">
        Back the road
      </h2>
      <p className="mt-3 max-w-2xl text-fg-secondary">
        Three ways to put money behind what comes next for {capital.title}. Every figure is read
        live from the same public records anyone can open.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[fund, lend, invest].map(rail => (
          <RailCard
            key={rail.rail}
            rail={rail}
            primary={rail.rail === 'fund'}
            fallback={fallback}
          />
        ))}
      </div>
      <p className="mt-6 text-sm text-fg-secondary">
        Need money for something yourself?{' '}
        <Link
          href={ROUTES.RAISE}
          className="font-medium text-fg-primary underline-offset-4 hover:underline"
        >
          Raise it in a sentence
        </Link>{' '}
        — the same three ways, priced and written for you.
      </p>
    </section>
  );
}

function RailCard({
  rail,
  primary,
  fallback,
}: {
  rail: CapitalRail;
  primary: boolean;
  fallback: OpenRail | null;
}) {
  const copy = RAILS[rail.rail];
  if (!rail.open) {
    return (
      <div className="flex min-w-0 flex-col rounded-2xl border border-dashed border-default p-5">
        <Kicker label={copy.label} state="Not open yet" />
        <p className="mt-3 text-sm text-fg-secondary">{copy.strings}</p>
        <p className="mt-3 text-sm text-fg-tertiary">{copy.closed}</p>
        {fallback && (
          <Link
            href={fallback.path}
            className="mt-auto inline-flex min-h-11 items-center gap-1 pt-4 text-sm font-medium text-fg-primary underline-offset-4 hover:underline"
          >
            {RAILS[fallback.rail].label} instead <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    );
  }
  const percent =
    rail.raised !== null && rail.target ? Math.min(100, (rail.raised / rail.target) * 100) : null;
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-default bg-surface-base p-5">
      <Kicker label={copy.label} state={rail.kindLabel ?? 'Open'} />
      <p className="mt-3 text-sm text-fg-secondary">{copy.strings}</p>
      <Figure rail={rail} />
      {percent !== null && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label={`${copy.label}: ${Math.round(percent)}% of the target`}
        >
          {/* A sliver even at zero, so an empty bar reads as a bar. */}
          <div
            className="h-full rounded-full bg-accent-warm"
            style={{ width: `${Math.max(percent, 1.5)}%` }}
          />
        </div>
      )}
      <Terms rail={rail} />
      <Link
        href={rail.path}
        className={
          primary
            ? 'mt-auto inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-accent-warm px-5 text-sm font-medium text-on-accent'
            : 'mt-auto inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-default px-5 text-sm font-medium text-fg-primary hover:bg-surface-raised'
        }
      >
        {copy.action} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function Kicker({ label, state }: { label: string; state: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-lg font-semibold text-fg-primary">{label}</h3>
      <span className="truncate text-xs uppercase tracking-caps text-fg-tertiary">{state}</span>
    </div>
  );
}

const money = (amount: number, currency: string) =>
  formatCurrency(amount, currency, { compact: amount >= 100_000 });

/** "CHF 0 of CHF 5,000" — or, for a loan, the amount sought. */
function Figure({ rail }: { rail: OpenRail }) {
  if (rail.rail === 'lend') {
    return (
      <p className="mt-5 text-2xl font-semibold text-fg-primary">
        {rail.target !== null ? money(rail.target, rail.currency) : 'Amount not set'}
        <span className="block text-sm font-normal text-fg-tertiary">sought</span>
      </p>
    );
  }
  return (
    <p className="mt-5 text-2xl font-semibold text-fg-primary">
      {rail.raised === null ? 'Rate unavailable' : money(rail.raised, rail.currency)}
      {rail.target !== null && (
        <span className="block text-sm font-normal text-fg-tertiary">
          of {money(rail.target, rail.currency)}
          {rail.backers > 0 && ` · ${rail.backers} ${rail.backers === 1 ? 'backer' : 'backers'}`}
        </span>
      )}
    </p>
  );
}

function Terms({ rail }: { rail: OpenRail }) {
  const lines: string[] = [];
  if (rail.minimum !== null) {
    lines.push(`From ${money(rail.minimum, rail.currency)}`);
  }
  if (rail.ratePercent !== null) {
    lines.push(`${rail.ratePercent}% a year${rail.rail === 'invest' ? ' expected' : ''}`);
  }
  if (rail.termMonths !== null) {
    lines.push(`${rail.termMonths} months`);
  }
  if (rail.riskLevel) {
    lines.push(`${rail.riskLevel} risk`);
  }
  return (
    <>
      {lines.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {lines.map(line => (
            <li
              key={line}
              className="rounded-full border border-subtle px-2.5 py-1 text-xs text-fg-secondary first-letter:uppercase"
            >
              {line}
            </li>
          ))}
        </ul>
      )}
      {rail.rail === 'invest' && (
        <p className="mt-3 text-xs text-fg-tertiary">
          Not advice. Returns are not guaranteed; read the terms before committing.
        </p>
      )}
      <div className="h-5" />
    </>
  );
}
