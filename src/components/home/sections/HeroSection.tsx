import Link from 'next/link';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { ROUTES } from '@/config/routes';
import { CTA_LABELS, HERO_COPY } from '@/config/landing-page';
import ClaimLinkForm from './ClaimLinkForm';

/**
 * The first screen: the promise, then the thing it gets you.
 *
 * It used to end in "Meet your Cat", a button that named a mascot the page
 * had not introduced, under a mark that took a third of a phone's screen, and
 * nowhere did it show what a person would have afterwards (2026-11-13
 * review). Now the one action is the outcome itself: type a name, claim
 * orangecat.ch/pay/<name>, and see the page that name makes as you type.
 * Discover and "How it works" stay one tap away, as plain links, so the fold
 * has one button. All copy comes from HERO_COPY, whose statement is the brand
 * promise (config/brand.ts); this file arranges, it does not write.
 */
export default function HeroSection() {
  return (
    <section className="oc-public-hero" aria-labelledby="hero-heading">
      <div className="oc-public-backdrop" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-12 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-16 lg:px-8">
        <div className="oc-public-hero-mark">
          <BrandMarkIcon size={56} animated />
        </div>

        <h1 id="hero-heading" className="oc-public-hero-title">
          {HERO_COPY.headline}
        </h1>

        <p className="oc-public-hero-lede">{HERO_COPY.lede}</p>

        <ClaimLinkForm />

        <nav
          aria-label="Look around first"
          className="mt-6 flex items-center gap-6 text-sm text-fg-secondary"
        >
          <Link
            href={ROUTES.DISCOVER}
            className="inline-flex min-h-11 items-center transition-colors hover:text-fg-primary"
          >
            {CTA_LABELS.discoverAction} →
          </Link>
          <Link
            href={ROUTES.HOW_IT_WORKS}
            className="inline-flex min-h-11 items-center transition-colors hover:text-fg-primary"
          >
            {CTA_LABELS.learnMore} →
          </Link>
        </nav>
      </div>
    </section>
  );
}
