import React from 'react';
import Link from 'next/link';
import { Check, Sparkles, Cat as CatIcon, Clapperboard } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PageHeading } from '@/components/layout/PageHeading';
import {
  CAT_PLANS,
  CAT_WIRED_PROVIDERS,
  CAT_FREE_DAILY_LIMIT,
  CAT_SUPPORTER_DAILY_LIMIT,
  CAT_FRONTIER_MODELS_OR,
  type CatPlan,
} from '@/config/cat-plans';
import { PRO_DESTINATION_COPY } from '@/config/public-content';
import { getAIProvider } from '@/data/aiProviders';
import { AUDIO_PROVIDER_RUNTIME, VIDEO_PROVIDER_RUNTIME } from '@/config/ai-provider-runtime';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

export const metadata = {
  title: 'Cat plans',
  description:
    'OrangeCat Cat is free for everyone — 10 messages a day, no card. Go further with your own API key, Cat Credits, or a Supporter pass in Bitcoin. Studio renders run on your own key at cost.',
};

/**
 * Derived from the Studio runtime SSOT, so a provider added there shows up in
 * this copy instead of the page naming a stale one.
 */
const STUDIO_RENDER_PROVIDERS = [
  ...new Set([...Object.keys(VIDEO_PROVIDER_RUNTIME), ...Object.keys(AUDIO_PROVIDER_RUNTIME)]),
]
  .map(id => getAIProvider(id)?.name ?? id)
  .join(' or ');

/**
 * /pricing — honest tier card layout, rendered 1:1 from the CAT_PLANS SSOT
 * (config/cat-plans.ts): every number, status, and CTA comes from there;
 * this file owns layout only. "Pro" in the prose below refers to the FUTURE
 * managed-frontier tier — distinct from the Supporter pass, which is a plan
 * card. One warm-accent CTA on the recommended (BYOK) tier; everything else
 * is monochrome surfaces per the FleetCrown-aligned design tier.
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex justify-center">
            <CatIcon className="h-16 w-16 text-fg-secondary" />
          </div>
          <PageHeading className="mb-4">Your AI, your bill, your choice</PageHeading>
          <p className="mx-auto max-w-2xl text-xl text-fg-secondary">
            Cat works any way you want. Free out of the box, or bring your own key from{' '}
            {CAT_WIRED_PROVIDERS.length} wired providers — {CAT_WIRED_PROVIDERS.join(', ')}.
            OrangeCat doesn&apos;t mark up inference; we earn from the platform, not your AI bill.
          </p>
        </div>

        {/* Plan cards */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CAT_PLANS.map(plan => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        {/* Where this is going — honest about the fiat gap */}
        <section className="mb-16 rounded-lg border border-default bg-surface-base p-8">
          <h2 className="mb-4 font-heading text-2xl font-bold tracking-display text-fg-primary">
            Where this is going
          </h2>
          <div className="space-y-4 text-fg-primary">
            <p>
              {PRO_DESTINATION_COPY.before}
              <strong>{PRO_DESTINATION_COPY.emphasis}</strong>
              {PRO_DESTINATION_COPY.after}
            </p>
            <p>
              We&apos;re not there yet, and we won&apos;t pretend otherwise. OrangeCat doesn&apos;t
              have fiat payment rails — we can&apos;t bill your francs, and we can&apos;t pay the
              inference providers in fiat. So until those rails exist, there are two honest ways to
              get more:
            </p>
            <ul className="space-y-3 pl-4">
              <li>
                <strong className="text-fg-primary">Bring your own key</strong> — the real path to
                frontier models <em>today</em>. Your key, your bill, zero markup. Cat runs{' '}
                {CAT_FRONTIER_MODELS_OR} for you right now.
              </li>
              <li>
                <strong className="text-fg-primary">Cat Credits</strong> — prepaid Bitcoin balance,
                metered per message: managed frontier AI without a subscription.
              </li>
              <li>
                <strong className="text-fg-primary">Become a Supporter</strong> — a flat monthly in
                Bitcoin for a {Math.round(CAT_SUPPORTER_DAILY_LIMIT / CAT_FREE_DAILY_LIMIT)}× daily
                cap, funding the platform AI budget — and first access the day Pro ships.
              </li>
            </ul>
          </div>
        </section>

        {/* What the Studio costs — the one place a render can spend money. */}
        <section className="mb-16 rounded-lg border border-default bg-surface-base p-8">
          <h2 className="mb-4 flex items-center gap-3 font-heading text-2xl font-bold tracking-display text-fg-primary">
            <Clapperboard className="h-6 w-6" aria-hidden="true" />
            What the Studio costs
          </h2>
          <div className="space-y-4 text-fg-primary">
            <p>
              Writing in the Studio runs on the same free OrangeCat models as Cat — nothing to add,
              nothing to pay.
            </p>
            <p>
              Video, music and artwork are different: a render costs real money at a real provider.
              So they run on <strong>your own key</strong> ({STUDIO_RENDER_PROVIDERS}), you pay that
              provider directly at their prices, and OrangeCat adds nothing on top. The free pool is
              text-only and never pays for someone else&apos;s render — which is also why it is
              still free.
            </p>
            <p className="text-fg-secondary">
              Selling or funding what you make is unaffected: OrangeCat takes no cut of a Bitcoin
              payment, whatever made the thing being paid for.
            </p>
            <Link
              href={ROUTES.STUDIO}
              className="inline-flex text-sm font-semibold text-fg-primary underline"
            >
              How the Studio works
            </Link>
          </div>
        </section>

        {/* Founding supporter CTA band */}
        <section
          id="founding"
          className="mb-12 rounded-lg border border-accent-warm/30 bg-accent-warm/5 p-8 text-fg-primary"
        >
          <div className="text-center">
            <Sparkles className="mx-auto mb-4 h-10 w-10 text-accent-warm" aria-hidden="true" />
            <h2 className="mb-3 font-heading text-2xl font-bold tracking-display">
              Help found the permissionless economy
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-fg-secondary">
              We&apos;re building toward a world where anyone can earn, fund, and govern without
              gatekeepers. Fiat billing is coming — until then, back OrangeCat in Bitcoin and get
              first access to Pro the day it&apos;s live.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href={ROUTES.SUPPORT}>
                <Button variant="accent" size="lg">
                  Become a founding supporter
                </Button>
              </Link>
              <Link href={ROUTES.DASHBOARD.CAT}>
                <Button variant="outline" size="lg">
                  Try Cat free
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <div className="text-center text-sm text-fg-secondary">
          <p>
            Payments are Bitcoin/Lightning-native — no card-on-file, ever. When fiat billing lands,
            Pro will price honestly and founding supporters come first.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: CatPlan }) {
  const isComingSoon = plan.status === 'coming-soon';
  const hasBadge = !!plan.badge;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border bg-surface-base p-6 shadow-sm',
        hasBadge ? 'border-accent-warm' : 'border-default'
      )}
    >
      {hasBadge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-warm px-3 py-1 text-xs font-medium uppercase tracking-caps text-fg-inverted">
          {plan.badge}
        </span>
      )}

      <div className="mb-4">
        <h3 className="font-heading text-2xl font-bold tracking-display text-fg-primary">
          {plan.name}
        </h3>
        <p className="mt-1 text-sm text-fg-secondary">{plan.tagline}</p>
      </div>

      <div className="mb-6">
        <p
          className={cn(
            'text-lg font-semibold',
            isComingSoon ? 'text-fg-primary' : 'text-fg-primary'
          )}
        >
          {plan.priceCopy}
        </p>
      </div>

      <ul className="mb-8 flex-1 space-y-3">
        {plan.bullets.map(bullet => (
          <li key={bullet} className="flex items-start gap-2 text-sm text-fg-primary">
            <Check
              className={cn(
                'mt-0.5 h-4 w-4 flex-shrink-0',
                isComingSoon ? 'text-fg-secondary' : 'text-status-positive'
              )}
              aria-hidden="true"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <Link href={plan.cta.href} className="block">
        <Button variant={plan.cta.variant} size="md" className="w-full">
          {plan.cta.label}
        </Button>
      </Link>
    </div>
  );
}
