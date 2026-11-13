import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import React from 'react';
import { Metadata } from 'next';
import { Zap, Lock } from 'lucide-react';
import { CONTACT_EMAIL, SOURCE_REPO_URL } from '@/config/brand';
import { ECOSYSTEM } from '@/config/ecosystem';
import { ROUTES } from '@/config/routes';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { PublicLinkList } from '@/components/layout/PublicLinkList';
import { PublicStartBand } from '@/components/layout/PublicStartBand';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'About',
  description:
    'OrangeCat is your AI economic agent — buy, sell, fund, lend, invest, and govern with any identity. Bitcoin is the first live payment rail.',
};

/**
 * Who builds OrangeCat and how to check: the page used to state values and
 * stop, with no way out but sign-up. Each row is a place a reader can verify
 * the claim for themselves.
 */
const WHO_BUILDS_IT = [
  {
    href: ROUTES.COMPANY_ABOUT,
    title: ECOSYSTEM.studio.title,
    line: 'The studio behind OrangeCat, Loki and Solon.',
  },
  {
    href: SOURCE_REPO_URL,
    title: 'Open source (MIT)',
    line: 'The source code, on GitHub.',
  },
  {
    href: ROUTES.ECOSYSTEM,
    title: 'The stack',
    line: 'The three products and what binds them.',
  },
  {
    href: `mailto:${CONTACT_EMAIL}`,
    title: 'Write to us',
    line: CONTACT_EMAIL,
  },
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div className={PUBLIC_PAGE_WIDTH.wide}>
        <PublicPageHeader
          title="About OrangeCat"
          lede="Your AI economic agent — and the platform where it operates."
        />
      </div>

      {/* Mission & Values */}
      <div className="bg-surface-page">
        <div className={cn(PUBLIC_PAGE_WIDTH.wide, 'pb-16')}>
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-fg-primary mb-4">Our Mission</h2>
            <p className="text-lg text-fg-secondary max-w-3xl mx-auto">
              Enable anyone — any person, pseudonym, or organization — to participate in the full
              spectrum of economic and governance activity: exchanging, funding, lending, investing,
              and governing, without gatekeepers. We are starting with Bitcoin so settlement can be
              independently verified.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Mission cards — monochrome neutral tiles per migration 6/N */}
            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-fg-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">
                Pseudonymous by Default
              </h3>
              <p className="text-fg-secondary">
                Any identity — human, pseudonymous, or AI — is a full economic participant. Real
                name is always optional.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-fg-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Bitcoin First</h3>
              <p className="text-fg-secondary">
                Lightning and on-chain Bitcoin are live. Fiat and privacy coins remain roadmap
                research until their accountability tradeoffs are resolved.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <BrandMarkIcon className="w-8 h-8 text-fg-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">
                The Cat is the Interface
              </h3>
              <p className="text-fg-secondary">
                My Cat is the primary AI agent for every user and group — it manages economic
                activity so you don't have to.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(PUBLIC_PAGE_WIDTH.wide, 'pb-16')}>
        <section aria-labelledby="who-builds-it" className="mx-auto max-w-3xl">
          <h2 id="who-builds-it" className="mb-4 text-2xl font-semibold text-fg-primary">
            Who builds it
          </h2>
          <PublicLinkList rows={WHO_BUILDS_IT} />
        </section>

        <PublicStartBand className="mt-16">
          Exchange, fund, lend, invest, and govern — with your AI agent, under any identity, in
          Bitcoin.
        </PublicStartBand>
      </div>
    </div>
  );
}
