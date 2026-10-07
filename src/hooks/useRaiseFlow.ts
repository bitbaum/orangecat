'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_ROUTES } from '@/config/api-routes';
import { CURRENCY_CODES, type CurrencyCode } from '@/config/currencies';
import { ENTITY_STATUS } from '@/config/database-constants';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import {
  RAISE_DRAFT_STORAGE_KEY,
  RAISE_LIMITS,
  RAISE_RAIL_COPY,
  type RaiseRail,
} from '@/config/raise';
import { ROUTES } from '@/config/routes';
import { planToEntityRequest, planTotal, type CostLine, type RaisePlan } from '@/domain/raise/plan';
import { useAuth } from '@/hooks/useAuth';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { entityEvents } from '@/lib/analytics';
import { formatCurrency } from '@/services/currency';
import { APP_LOCALE } from '@/utils/locale';

export type RaiseStep = 'need' | 'planning' | 'plan' | 'publishing' | 'done';

export interface Published {
  title: string;
  url: string;
  rail: RaiseRail;
  /** False when the draft was saved but going live failed — said, not hidden. */
  live: boolean;
}

/**
 * The raise flow's state: the sentence, the plan the Cat priced, the edits,
 * and publishing. A visitor who is not signed in keeps their plan through
 * sign-in — it waits in sessionStorage and comes back on return to /raise.
 */
export function useRaiseFlow() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { displayCurrency } = useDisplayCurrency();
  const [step, setStep] = useState<RaiseStep>('need');
  const [need, setNeed] = useState('');
  const [plan, setPlan] = useState<RaisePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<Published | null>(null);
  // The rail the Cat suggested, so the picker can keep saying so after a change.
  const [recommended, setRecommended] = useState<RaiseRail | null>(null);

  const currency: CurrencyCode = (CURRENCY_CODES as readonly string[]).includes(displayCurrency)
    ? displayCurrency
    : 'CHF';

  // Back from sign-in with a plan waiting: restore it, exactly as it was left.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(RAISE_DRAFT_STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as RaisePlan;
        setPlan(draft);
        setRecommended(draft.rail);
        setNeed(draft.need);
        setStep('plan');
      }
    } catch {
      /* storage unavailable or corrupt — start fresh */
    }
  }, []);

  // Whole francs read as "CHF 4,430", not "CHF 4,430.00" — the decimals were
  // noise on the one number the page is about. BTC keeps its own formatting.
  const format = (n: number) => {
    const code = plan?.currency ?? currency;
    if (code === 'BTC') {
      return formatCurrency(n, code);
    }
    return new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  };

  const priceIt = async (text = need) => {
    if (text.trim().length < RAISE_LIMITS.needMin) {
      setError('Say a little more about what you need.');
      return;
    }
    setNeed(text);
    setError(null);
    setStep('planning');
    try {
      const res = await fetch(API_ROUTES.RAISE.PLAN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ need: text, currency }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.data?.plan) {
        throw new Error(apiErrorMessage(body, 'The Cat could not price that just now.'));
      }
      setPlan(body.data.plan as RaisePlan);
      setRecommended((body.data.plan as RaisePlan).rail);
      setStep('plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The Cat could not price that just now.');
      setStep('need');
    }
  };

  const edit = (patch: Partial<RaisePlan>) => setPlan(p => (p ? { ...p, ...patch } : p));
  const editLine = (i: number, patch: Partial<CostLine>) =>
    setPlan(p =>
      p
        ? {
            ...p,
            lines: p.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)),
            estimated: patch.amount === undefined ? p.estimated : false,
          }
        : p
    );
  const addLine = () =>
    setPlan(p =>
      p && p.lines.length < RAISE_LIMITS.maxLines
        ? { ...p, lines: [...p.lines, { label: '', amount: 0 }] }
        : p
    );
  const removeLine = (i: number) =>
    setPlan(p => (p ? { ...p, lines: p.lines.filter((_, j) => j !== i) } : p));

  const startOver = () => {
    sessionStorage.removeItem(RAISE_DRAFT_STORAGE_KEY);
    setPlan(null);
    setPublished(null);
    setError(null);
    setStep('need');
  };

  const publish = async () => {
    if (!plan) {
      return;
    }
    const lines = plan.lines.filter(l => l.label.trim() && l.amount > 0);
    if (lines.length === 0 || planTotal({ lines, currency: plan.currency }) <= 0) {
      setError('Add what it costs — at least one line with an amount.');
      return;
    }
    const final = { ...plan, lines };
    if (!isAuthenticated) {
      // Keep the plan through sign-in; /raise restores it on return.
      sessionStorage.setItem(RAISE_DRAFT_STORAGE_KEY, JSON.stringify(final));
      router.push(`${ROUTES.AUTH}?from=${encodeURIComponent(ROUTES.RAISE)}`);
      return;
    }
    setError(null);
    setStep('publishing');
    const { entityType, payload } = planToEntityRequest(final, format);
    const meta = ENTITY_REGISTRY[entityType];
    try {
      const res = await fetch(meta.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      const id = body?.data?.id as string | undefined;
      if (!res.ok || !id) {
        throw new Error(apiErrorMessage(body, 'That did not save. Nothing was published.'));
      }
      const live = await fetch(API_ROUTES.ENTITIES.STATUS(entityType, id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: ENTITY_STATUS.ACTIVE }),
      }).then(r => r.ok);
      if (live) {
        entityEvents.published(entityType, id, user?.id);
      }
      sessionStorage.removeItem(RAISE_DRAFT_STORAGE_KEY);
      setPublished({
        title: final.title,
        url: `${meta.publicBasePath}/${id}`,
        rail: final.rail,
        live,
      });
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Nothing was published.');
      setStep('plan');
    }
  };

  return {
    step,
    need,
    setNeed,
    plan,
    error,
    published,
    recommended,
    currency,
    format,
    total: plan ? planTotal(plan) : 0,
    railCopy: plan ? RAISE_RAIL_COPY[plan.rail] : null,
    isAuthenticated,
    userId: user?.id ?? null,
    priceIt,
    edit,
    editLine,
    addLine,
    removeLine,
    publish,
    startOver,
  };
}

export type RaiseFlow = ReturnType<typeof useRaiseFlow>;
