import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { ROUTES } from '@/config/routes';
import { CTA_LABELS, FEE_CLAIMS, HERO_COPY } from '@/config/landing-page';
import HomePulse from './HomePulse';

/**
 * The first screen: one statement, the mark alive above it, two actions,
 * and what is on OrangeCat right now.
 *
 * It replaced a two-column template — headline on the left, a mock "Cat"
 * card with three bullet points and a fee table on the right — that read as
 * a SaaS pricing page while Loki's and Solon's first screens read as
 * products with a point of view. The structure is theirs now, deliberately:
 * centred, viewport-relative display type, one warm action, depth behind it
 * instead of a card beside it. All copy comes from HERO_COPY / CTA_LABELS /
 * FEE_CLAIMS; this file arranges, it does not write.
 */
export default function HeroSection() {
  return (
    <section className="oc-public-hero" aria-labelledby="hero-heading">
      <div className="oc-public-backdrop" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-12 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-20 lg:px-8">
        <div className="oc-public-hero-mark">
          <BrandMarkIcon size={128} animated />
        </div>

        <p className="oc-public-hero-badge">
          <span>{HERO_COPY.badgeLead}</span>
          <span aria-hidden="true">·</span>
          <span>{HERO_COPY.badgeIdentity}</span>
          <span aria-hidden="true">·</span>
          <span>{FEE_CLAIMS.feeBadgeLabel}</span>
        </p>

        <h1 id="hero-heading" className="oc-public-hero-title">
          {HERO_COPY.headlineLead}{' '}
          <span className="oc-public-hero-title-dim">{HERO_COPY.headlineTail}</span>
        </h1>

        <p className="oc-public-hero-lede">{HERO_COPY.lede}</p>

        <div className="oc-public-hero-actions">
          <Button href={ROUTES.AUTH} variant="accent" size="xl">
            {CTA_LABELS.primaryAction}
            <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
          </Button>
          <Button href={ROUTES.DISCOVER} variant="outline" size="xl">
            {CTA_LABELS.discoverAction}
          </Button>
        </div>

        <Link
          href={ROUTES.HOW_IT_WORKS}
          className="mt-5 inline-flex min-h-11 items-center text-sm text-fg-secondary transition-colors hover:text-fg-primary sm:mt-6"
        >
          {CTA_LABELS.learnMore} →
        </Link>

        <HomePulse />
      </div>
    </section>
  );
}
