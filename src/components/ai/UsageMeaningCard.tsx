'use client';

/**
 * "What this means for you" + "What these numbers mean" — the half of
 * /settings/usage a meter leaves out.
 *
 * The budget card above says "4 of 10 messages left today, resets in 9 h".
 * This says whether today's pace runs into the cap and when, whether the cap
 * is something this person keeps hitting, and which plan would actually
 * change any of it — with each lever's consequence beside it. What Cat
 * forgets as a conversation grows is reference, so it lives once, in the
 * folded explainer at the foot of the page. Every sentence comes from catUsageMeaning() via
 * GET /api/cat/usage; this component only renders.
 *
 * Absent beats wrong: a week that could not be read is not drawn, and a
 * failed read says it could not look rather than implying nothing is left —
 * the budget card above it carries the numbers either way.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Lightbulb } from 'lucide-react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import type { CatUsageSummary } from '@/services/cat/usage-summary';

export interface UsageSummaryState {
  data: CatUsageSummary | null;
  failed: boolean;
}

/** One read of GET /api/cat/usage, shared by both cards on the page. */
export function useUsageSummary(): UsageSummaryState {
  const [data, setData] = useState<CatUsageSummary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_ROUTES.CAT.USAGE, { credentials: 'include' });
        const body = (await res.json().catch(() => null)) as {
          success?: boolean;
          data?: CatUsageSummary;
        } | null;
        if (cancelled) {
          return;
        }
        if (res.ok && body?.success && body.data) {
          setData(body.data);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, failed };
}

export function UsageMeaningCard({ data, failed }: UsageSummaryState) {
  const { formatAmountBtc } = useDisplayCurrency();
  const meaning = data?.meaning ?? null;

  // A card is drawn only when it has something to say. A quiet week with
  // nothing pressing used to fill this card with the memory paragraph that
  // "What these numbers mean" repeats word for word below it.
  const hasNews =
    meaning !== null &&
    Boolean(meaning.pace || meaning.week || meaning.creditsWeek || meaning.actions.length > 0);

  if (meaning && !hasNews) {
    return null;
  }

  return (
    <section className="rounded-lg border border-default bg-surface-base p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-surface-raised p-2">
          <Lightbulb className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="font-heading text-base font-semibold text-fg-primary">
            What this means for you
          </h2>

          {!meaning && !failed && (
            <p className="text-sm text-fg-tertiary">Reading your last 7 days…</p>
          )}
          {failed && (
            <p className="text-sm text-fg-tertiary">
              Couldn&apos;t read your last 7 days just now — this says nothing about what is left.
              The budget above is current.
            </p>
          )}

          {meaning && (
            <>
              <ul className="space-y-1.5 text-sm text-fg-secondary">
                {meaning.pace && <li>{meaning.pace}</li>}
                {meaning.week && <li>{meaning.week.line}</li>}
                {meaning.creditsWeek && (
                  <li>
                    Frontier models, last 7 days: {meaning.creditsWeek.messages}{' '}
                    {meaning.creditsWeek.messages === 1 ? 'message' : 'messages'} paid from Cat
                    Credits, {formatAmountBtc(meaning.creditsWeek.btc)}.
                  </li>
                )}
              </ul>

              {/* Each lever with its consequence: a bare "Upgrade" is a guess,
                  "Add your key — no daily cap, your provider bills you" is a
                  decision. Only plans that are really open appear. The
                  consequence sits UNDER the button on a phone: side by side,
                  flex-1 squeezed it into a one-word column that spilled out
                  of the card. */}
              {meaning.actions.length > 0 && (
                <ul className="divide-y divide-border-subtle border-t border-subtle">
                  {meaning.actions.map(action => (
                    <li
                      key={action.id}
                      className="flex flex-col items-start gap-1.5 py-3 sm:flex-row sm:items-center sm:gap-3"
                    >
                      {action.href ? (
                        <Button href={action.href} variant="outline" size="sm">
                          {action.label}
                        </Button>
                      ) : (
                        <span className="text-sm font-medium text-fg-primary">{action.label}</span>
                      )}
                      <span className="min-w-0 text-sm text-fg-tertiary sm:flex-1">
                        {action.why}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * "What these numbers mean" — reference, not news, so it is folded: the page
 * a person opens to see what is left should not make them scroll past six
 * paragraphs to reach the rest of it. Rendered at the foot of the page.
 */
export function UsageExplainer({ data }: Pick<UsageSummaryState, 'data'>) {
  const explain = data?.meaning.explain;
  if (!explain) {
    return null;
  }
  return (
    <details className="group rounded-lg border border-default bg-surface-base">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-6 font-heading text-base font-semibold text-fg-primary [&::-webkit-details-marker]:hidden">
        What these numbers mean
        <ChevronDown
          className="h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <dl className="space-y-3 px-6 pb-6">
        {explain.map(item => (
          <div key={item.title}>
            <dt className="text-sm font-medium text-fg-primary">{item.title}</dt>
            <dd className="text-sm text-fg-secondary">
              {item.body}
              {item.link && (
                <>
                  {' '}
                  <Link href={item.link.href} className="underline underline-offset-2">
                    {item.link.label}
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
