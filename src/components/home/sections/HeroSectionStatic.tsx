import Link from 'next/link';
import { ArrowRight, Globe, Cat } from 'lucide-react';
import Button from '@/components/ui/Button';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import { ROUTES } from '@/config/routes';
import { CTA_LABELS, FEE_CLAIMS, HERO_COPY } from '@/config/landing-page';

/**
 * Static Hero Section - Renders immediately without animations
 * This provides instant content while the animated version loads
 */
export default function HeroSectionStatic() {
  return (
    <section className="relative overflow-hidden bg-surface-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div>
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-base border border-default mb-6">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-status-positive rounded-full" />
                <span className="text-sm font-medium text-fg-primary">{HERO_COPY.badgeLead}</span>
              </div>
              <span className="text-fg-tertiary">•</span>
              <span className="text-sm font-medium text-fg-primary">{HERO_COPY.badgeIdentity}</span>
              <span className="text-fg-tertiary">•</span>
              <span className="text-sm font-medium text-fg-primary">
                {FEE_CLAIMS.feeBadgeLabel}
              </span>
            </div>

            <h1 className="font-heading tracking-display text-3xl sm:text-5xl lg:text-6xl font-bold text-fg-primary leading-[1.05] mb-4 sm:mb-6">
              {HERO_COPY.headline}
            </h1>

            <p className="text-lg sm:text-xl lg:text-2xl text-fg-secondary leading-relaxed mb-6 sm:mb-8">
              {HERO_COPY.lede}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link href={ROUTES.AUTH} className="w-full sm:w-auto">
                <Button variant="accent" size="lg" className="w-full sm:w-auto">
                  <Cat className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  {CTA_LABELS.primaryAction}
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <Link href={ROUTES.DISCOVER} className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  <Globe className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  {CTA_LABELS.discoverAction}
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column - Visual Demo */}
          <div className="relative">
            {/* Demo Card */}
            <div className="relative bg-surface-base rounded-lg border border-default shadow-sm">
              {/* Card Header */}
              <div className="p-4 sm:p-6 border-b border-default">
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Cat avatar — monochrome neutral per migration 6/N; the
                      warm accent is reserved for CTAs, not the brand mark */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-raised border border-subtle flex items-center justify-center text-fg-primary flex-shrink-0">
                    <BrandMarkIcon size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-fg-primary text-sm sm:text-base">Cat</h3>
                    <p className="text-xs sm:text-sm text-fg-secondary">Your AI economic agent</p>
                  </div>
                  <div className="hidden sm:flex items-center rounded-full border border-default bg-surface-raised/40 px-2.5 py-1 text-xs font-medium text-fg-primary">
                    {FEE_CLAIMS.feeBadgeLabel}
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                {/* Platform capabilities */}
                <div className="space-y-2">
                  {[
                    'Interviews you, sets up your offerings',
                    'Suggests ways to earn from what you have',
                    'Funded in Bitcoin, non-custodial',
                  ].map(feature => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-sm text-fg-secondary"
                    >
                      <div className="w-4 h-4 rounded-full bg-surface-raised flex items-center justify-center flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-fg-primary" />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>

                {/* Stats — derived from FEE_CLAIMS so they can't drift between
                    the hero badge above and the headline numbers here. */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1 sm:pt-2">
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-fg-primary">
                      {FEE_CLAIMS.platformFee}
                    </div>
                    <div className="text-xs text-fg-secondary">{FEE_CLAIMS.feeStatTopLabel}</div>
                  </div>
                  <div>
                    <div className="text-xl sm:text-2xl font-bold text-fg-primary">
                      {FEE_CLAIMS.creatorShare}
                    </div>
                    <div className="text-xs text-fg-secondary">{FEE_CLAIMS.feeStatBottomLabel}</div>
                  </div>
                </div>

                {/* CTA Button in Demo */}
                <Link
                  href={ROUTES.AUTH}
                  className="block w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-fg-primary text-fg-inverted text-sm sm:text-base font-semibold rounded-lg hover:bg-muted-strong transition-colors duration-150 flex items-center justify-center gap-2"
                >
                  <Cat className="w-4 h-4 sm:w-5 sm:h-5" />
                  {CTA_LABELS.primaryAction}
                </Link>

                <div className="flex flex-wrap gap-2 text-xs font-medium">
                  <span className="rounded-full border border-default bg-surface-raised/40 px-2.5 py-1 text-fg-primary">
                    Proactive agent
                  </span>
                  <span className="rounded-full border border-default bg-surface-raised/40 px-2.5 py-1 text-fg-primary">
                    Non-custodial
                  </span>
                  <span className="rounded-full border border-default bg-surface-raised/40 px-2.5 py-1 text-fg-primary">
                    Builds on Loki
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
