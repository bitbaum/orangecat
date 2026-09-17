import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Globe, ShieldCheck, Server } from 'lucide-react';
import Button from '@/components/ui/Button';
import { DomainSearch } from '@/components/domains/DomainSearch';
import {
  DOMAINS_SERVICE_URL,
  WEBSITE_BUILD_SERVICE_URL,
  CUSTOM_DOMAIN_PRICE_CHF_PER_MONTH,
} from '@/config/domains-offer';

export const metadata: Metadata = {
  title: 'OrangeCat Domains',
  description:
    'A working site, hosted and managed at yourname.orangecat.ch — free. Move to your own domain when you are ready, and everything keeps working.',
};

export default function DomainsPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero */}
      <div className="bg-surface-base border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="font-heading tracking-display text-4xl font-bold text-fg-primary sm:text-5xl md:text-6xl">
              Your site, running.
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-fg-secondary sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Hosted, deployed, and monitored at{' '}
              <span className="font-mono text-fg-primary">yourname.orangecat.ch</span> — free. Move
              to your own domain when you&apos;re ready, and everything keeps working.
            </p>
          </div>

          {/* The rung before everything else on this page: you cannot host a
              domain you have not found yet. */}
          <div className="mt-10">
            <p className="mb-4 text-center text-sm text-fg-tertiary">
              Don&apos;t have a name yet? Check one against the registries.
            </p>
            <DomainSearch />
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-surface-page">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-fg-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Hosted &amp; managed</h3>
              <p className="text-fg-secondary">
                Deploys on every change, TLS, backups, health checks. The same infrastructure that
                runs OrangeCat itself and a dozen production sites today.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-fg-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Free at .orangecat.ch</h3>
              <p className="text-fg-secondary">
                Every hosted site starts at <span className="font-mono">yourname.orangecat.ch</span>{' '}
                — a real, working address, not a preview. Blog, roadmap, and changelog included when
                you want them.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-fg-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Your domain, yours</h3>
              <p className="text-fg-secondary">
                Ready for <span className="font-mono">yourname.ch</span>? You own the domain, we
                connect it: certificates, redirects from the old address so no link ever breaks,
                ongoing management.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-surface-base border-y border-subtle">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-subtle bg-surface-raised p-8">
              <h3 className="text-lg font-semibold text-fg-primary">Hosted site</h3>
              <p className="mt-1 text-3xl font-bold text-fg-primary">Free</p>
              <ul className="mt-4 space-y-2 text-fg-secondary">
                <li>yourname.orangecat.ch</li>
                <li>Hosting, deploys, TLS, monitoring</li>
                <li>Blog · roadmap · changelog, ready to use</li>
              </ul>
              {/* The rung before hosting: no site yet. Priced on the service
                  page, never restated here. */}
              <p className="mt-6 border-t border-subtle pt-4 text-sm text-fg-secondary">
                Don&apos;t have a site yet?{' '}
                <Link href={WEBSITE_BUILD_SERVICE_URL} className="underline">
                  I&apos;ll build one
                </Link>{' '}
                — billed hourly, quoted before anything starts.
              </p>
            </div>
            <div className="rounded-xl border border-interactive bg-surface-raised p-8">
              <h3 className="text-lg font-semibold text-fg-primary">Custom domain</h3>
              {CUSTOM_DOMAIN_PRICE_CHF_PER_MONTH === null ? (
                <>
                  <p className="mt-1 text-3xl font-bold text-fg-primary">Free for now</p>
                  <p className="mt-1 text-sm text-fg-secondary">Pricing to be announced</p>
                </>
              ) : (
                <p className="mt-1 text-3xl font-bold text-fg-primary">
                  CHF {CUSTOM_DOMAIN_PRICE_CHF_PER_MONTH}
                  <span className="text-base font-normal text-fg-secondary">/month</span>
                </p>
              )}
              <ul className="mt-4 space-y-2 text-fg-secondary">
                <li>Everything in the free tier</li>
                <li>Your own domain, certificates included</li>
                <li>Redirects from the old address — no broken links</li>
                <li>Cancel anytime; your site returns to its free address</li>
              </ul>
              <div className="mt-6">
                <Link href={DOMAINS_SERVICE_URL}>
                  <Button variant="accent" size="lg">
                    Connect your domain
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-fg-tertiary">
            {CUSTOM_DOMAIN_PRICE_CHF_PER_MONTH === null
              ? 'Nothing is charged while pricing is being worked out — early sites keep whatever terms they start on. Questions?'
              : 'Paid in Bitcoin over Lightning — the invoice takes a minute. Questions first?'}{' '}
            <Link href="/profiles/mao" className="underline">
              Message Mao
            </Link>
            .
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-surface-public">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* The CTA points at the path that actually delivers a site.
              Registering an account does not: hosting here is set up per site,
              by hand, on the same box that runs OrangeCat — there is no
              self-serve provisioning behind a signup button, and a button that
              implies one sends people to a dead end wearing a welcome mat. */}
          <div className="text-center">
            <h2 className="font-heading tracking-display text-3xl sm:text-4xl font-bold text-fg-inverted mb-4">
              Start with a site that already works
            </h2>
            <p className="text-xl text-fg-inverted/70 mb-8">
              No preview links, no cold starts — a running site with a real address, set up and
              managed for you. Tell me what you need and I&apos;ll quote it first.
            </p>
            <Link href={WEBSITE_BUILD_SERVICE_URL}>
              <Button variant="accent" size="lg">
                Get your site built
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
