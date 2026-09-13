import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Zap, TreePine, Cat, Clapperboard } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export const metadata: Metadata = {
  title: 'About',
  description:
    'OrangeCat is your AI economic agent — make the work, fund it, sell it, lend, invest, and govern with any identity. Bitcoin is the first live payment rail.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section — monochrome per migration 6/N */}
      <div className="bg-surface-base border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="font-heading tracking-display text-4xl font-bold text-fg-primary sm:text-5xl md:text-6xl">
              About OrangeCat
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-fg-secondary sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Your AI economic agent — and the platform where it operates.
            </p>
          </div>
        </div>
      </div>

      {/* Mission & Values */}
      <div className="bg-surface-page">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-fg-primary mb-4">Our Mission</h2>
            <p className="text-lg text-fg-secondary max-w-3xl mx-auto">
              Enable anyone — any person, pseudonym, or organization — to participate in the full
              spectrum of economic and governance activity: making, exchanging, funding, lending,
              investing, and governing, without gatekeepers. We are starting with Bitcoin so
              settlement can be independently verified.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Mission cards — monochrome neutral tiles per migration 6/N */}
            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Clapperboard className="w-8 h-8 text-fg-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Making Counts as Work</h3>
              <p className="text-fg-secondary">
                A film, a record, a novel — the Studio makes them here, and the same platform
                finances them and sells them. Creation is not a hobby the economy tolerates.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <TreePine className="w-8 h-8 text-fg-secondary" />
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
                <Cat className="w-8 h-8 text-fg-secondary" />
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

      {/* CTA Section — public-surface (near-black) per FleetCrown pattern */}
      <div className="bg-surface-public">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="font-heading tracking-display text-3xl sm:text-4xl font-bold text-fg-inverted mb-4">
              Join the Open Economy
            </h2>
            <p className="text-xl text-fg-inverted/70 mb-8">
              Make it, fund it, sell it — and lend, invest and govern from the same place, with your
              AI agent, under any identity, in Bitcoin.
            </p>
            <Link href={`${ROUTES.AUTH}?mode=register`}>
              <Button variant="accent" size="lg">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
