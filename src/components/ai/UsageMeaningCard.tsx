'use client';

/**
 * "What this means for you" + "What these numbers mean" — the half of
 * /settings/usage a meter leaves out.
 *
 * The budget card above says "4 of 10 messages left today, resets in 9 h".
 * This says whether today's pace runs into the cap and when, whether the cap
 * is something this person keeps hitting, what Cat forgets as a conversation
 * grows, and which plan would actually change any of it — with each lever's
 * consequence beside it. Every sentence comes from catUsageMeaning() via
 * GET /api/cat/usage; this component only renders.
 *
 * Absent beats wrong: a week that could not be read is not drawn, and a
 * failed read says it could not look rather than implying nothing is left —
 * the budget card above it carries the numbers either way.
 */

import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import type { CatUsageSummary } from '@/services/cat/usage-summary';

function useUsageSummary(): { data: CatUsageSummary | null; failed: boolean } {
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

export function UsageMeaningCard() {
  const { data, failed } = useUsageSummary();
  const { formatAmountBtc } = useDisplayCurrency();
  const meaning = data?.meaning ?? null;

  return (
    <>
      <section className="rounded-lg border border-default bg-surface-base p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-surface-raised p-2">
            <Lightbulb className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <h2 className="font-heading text-base font-semibold text-fg-primary">
              What this means for you
            </h2>

            {!meaning && !failed && <p className="text-sm text-fg-tertiary">Reading your week…</p>}
            {failed && (
              <p className="text-sm text-fg-tertiary">
                Couldn&apos;t read your week just now — this says nothing about what is left. The
                budget above is current.
              </p>
            )}

            {meaning && (
              <>
                <ul className="space-y-1.5 text-sm text-fg-secondary">
                  {meaning.pace && <li>{meaning.pace}</li>}
                  {meaning.week && <li>{meaning.week.line}</li>}
                  {meaning.creditsWeek && (
                    <li>
                      Frontier models this week: {meaning.creditsWeek.messages}{' '}
                      {meaning.creditsWeek.messages === 1 ? 'message' : 'messages'} paid from Cat
                      Credits, {formatAmountBtc(meaning.creditsWeek.btc)}.
                    </li>
                  )}
                  <li>{meaning.memory}</li>
                </ul>

                {/* Each lever with its consequence: a bare "Upgrade" is a guess,
                    "Add your key — no daily cap, your provider bills you" is a
                    decision. Only plans that are really open appear. */}
                <ul className="divide-y divide-border-subtle border-t border-subtle">
                  {meaning.actions.map(action => (
                    <li
                      key={action.id}
                      className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                    >
                      {action.href ? (
                        <Button href={action.href} variant="outline" size="sm">
                          {action.label}
                        </Button>
                      ) : (
                        <span className="text-sm font-medium text-fg-primary">{action.label}</span>
                      )}
                      <span className="min-w-0 flex-1 text-sm text-fg-tertiary">{action.why}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Replaces the old "What counts" list: the same facts, plus why the cap
          exists and what Cat remembers — written once, in usage-meaning.ts. */}
      {meaning && (
        <section className="rounded-lg border border-default bg-surface-base p-6">
          <h2 className="font-heading text-base font-semibold text-fg-primary">
            What these numbers mean
          </h2>
          <dl className="mt-3 space-y-3">
            {meaning.explain.map(item => (
              <div key={item.title}>
                <dt className="text-sm font-medium text-fg-primary">{item.title}</dt>
                <dd className="text-sm text-fg-secondary">{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}
