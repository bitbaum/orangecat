import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import {
  CAT_PLANS,
  CAT_WIRED_PROVIDERS,
  CAT_FREE_DAILY_LIMIT,
  CAT_SUPPORTER_DAILY_LIMIT,
  CAT_FRONTIER_MODELS_OR,
  getCatPlan,
  type CatPlan,
  type CatPlanId,
} from '@/config/cat-plans';
import { COMMERCE_CLOSED } from '@/config/commerce';
import { PRICING_COPY } from '@/config/landing-page';
import { PRO_DESTINATION_COPY } from '@/config/public-content';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

export const metadata = {
  title: 'Pricing',
  description: PRICING_COPY.description,
};

/**
 * " Not open yet." after a way to get more Cat that cannot be bought today,
 * read from the plan's own status: the prose under the cards used to offer
 * Cat Credits and the Supporter pass as open while their cards said otherwise.
 */
function NotOpenYet({ plan }: { plan: CatPlanId }) {
  return getCatPlan(plan).status === 'coming-soon' ? <em> {COMMERCE_CLOSED.badge}.</em> : null;
}

/**
 * /pricing opens on what a maker asks: what does it cost to sell and get
 * paid? Nothing (PRICING_COPY). The Cat's plans follow under "More Cat".
 *
 * Honest tier card layout, rendered 1:1 from the CAT_PLANS SSOT
 * (config/cat-plans.ts): every number, status, and CTA comes from there;
 * this file owns layout only. "Pro" in the prose below refers to the FUTURE
 * managed-frontier tier — distinct from the Supporter pass, which is a plan
 * card. One warm-accent CTA, on the plan that brings a newcomer in (Free);
 * everything else is monochrome surfaces per the Loki-aligned design tier.
 * Orange used to be a card border, a "not open yet" badge, the founding band
 * and three buttons, with the warm action on Bring your own key.
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div className={cn(PUBLIC_PAGE_WIDTH.wide, 'pb-12')}>
        <PublicPageHeader title={PRICING_COPY.title} lede={PRICING_COPY.lede} />

        <header className="mx-auto mb-10 max-w-3xl text-center">
          <h2 className="font-heading text-2xl font-bold tracking-display text-fg-primary sm:text-3xl">
            {PRICING_COPY.moreCat}
          </h2>
          <p className="mb-0 mt-3 text-fg-secondary">
            Cat works any way you want. Free out of the box, or bring your own key from{' '}
            {CAT_WIRED_PROVIDERS.length} wired providers: {CAT_WIRED_PROVIDERS.join(', ')}.
            OrangeCat doesn&apos;t mark up inference.
          </p>
        </header>

        {/* Plan cards */}
        {/* From lg the cards are one row, and each card is a subgrid of four
            rows, so name, price, bullets and button line up across plans. */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-0">
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
              inference providers in fiat. So until those rails exist, there are three honest ways
              to get more:
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
                <NotOpenYet plan="credits" />
              </li>
              <li>
                <strong className="text-fg-primary">Become a Supporter</strong> — a flat monthly in
                Bitcoin for a {Math.round(CAT_SUPPORTER_DAILY_LIMIT / CAT_FREE_DAILY_LIMIT)}× daily
                cap, funding the platform AI budget — and first access the day Pro ships.
                <NotOpenYet plan="supporter" />
              </li>
            </ul>
          </div>
        </section>

        {/* Founding supporter CTA band */}
        <section id="founding" className="oc-surface mb-12 p-8">
          <div className="text-center">
            <Sparkles className="mx-auto mb-4 h-10 w-10 text-fg-secondary" aria-hidden="true" />
            <h2 className="mb-3 text-balance font-heading text-2xl font-bold tracking-display">
              Help found the permissionless economy
            </h2>
            <p className="mx-auto mb-6 max-w-2xl text-fg-secondary">
              We&apos;re building toward a world where anyone can earn, fund, and govern without
              gatekeepers. Fiat billing is coming — until then, back OrangeCat in Bitcoin and get
              first access to Pro the day it&apos;s live.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button href={ROUTES.SUPPORT} variant="primary" size="lg">
                Become a founding supporter
              </Button>
              <Button href={ROUTES.DASHBOARD.CAT} variant="outline" size="lg">
                Try Cat free
              </Button>
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
    <div className="relative flex flex-col rounded-lg border border-default bg-surface-base p-6 shadow-sm lg:row-span-4 lg:grid lg:grid-rows-subgrid lg:gap-0">
      {hasBadge && (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-default bg-surface-raised px-3 py-1 text-xs font-medium uppercase tracking-caps text-fg-secondary">
          {plan.status === 'available' && (
            <span className="h-1.5 w-1.5 rounded-full bg-status-positive" aria-hidden="true" />
          )}
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
        <p className="text-lg font-semibold text-fg-primary">{plan.priceCopy}</p>
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

      <Button href={plan.cta.href} variant={plan.cta.variant} size="md" className="w-full">
        {plan.cta.label}
      </Button>
    </div>
  );
}
