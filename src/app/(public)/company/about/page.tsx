import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Users, Heart, Zap, TreePine, Target, Award } from 'lucide-react';
import BitBaumLogo from '@/components/layout/BitBaumLogo';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import Button from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'About bitbaum',
  description:
    'Learn about bitbaum, the studio behind OrangeCat and Loki — building open economic infrastructure for the Bitcoin era.',
};

/**
 * /company/about — the studio behind the products. Migrated to Loki
 * semantic tier in migration 6/N: monochrome surfaces, neutral
 * value-card tiles, single warm accent on the 'Join Our Team' CTA.
 * Timeline number badges and vision boxes all unified neutral.
 */
export default function BitBaumAboutPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section */}
      <div className="bg-surface-base border-b border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <BitBaumLogo className="scale-150" />
            </div>
            <h1 className="font-heading tracking-display text-4xl font-bold text-fg-primary sm:text-5xl mb-4">
              About bitbaum
            </h1>
            <p className="text-xl text-fg-secondary max-w-3xl mx-auto">
              Building open economic infrastructure for the Bitcoin era. The studio behind
              OrangeCat and Loki.
            </p>
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-raised border border-subtle rounded-full mb-6">
            <Target className="w-8 h-8 text-fg-secondary" />
          </div>
          <h2 className="text-2xl font-semibold text-fg-primary mb-6">Our Mission</h2>
          <p className="text-lg text-fg-secondary max-w-4xl mx-auto leading-relaxed">
            Enable anyone — any person, pseudonym, or organization — to participate in the full
            spectrum of economic activity: exchanging, funding, lending, investing, and governing
            without gatekeepers. Bitcoin is the accountable settlement rail available today;
            broader rails remain part of the long-term mission.
          </p>
        </div>

        {/* Brand Relationship */}
        <div className="bg-surface-base rounded-lg shadow-sm p-8 mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-fg-primary mb-4">Our Brand Structure</h3>
            <p className="text-fg-secondary">
              Like TikTok and ByteDance, we separate our consumer product from our corporate
              identity
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* BitBaum */}
            <div className="text-center p-6 border border-default rounded-lg">
              <div className="flex justify-center mb-4">
                <BitBaumLogo />
              </div>
              <h4 className="text-xl font-semibold text-fg-primary mb-3">bitbaum</h4>
              <p className="text-fg-secondary mb-4">
                The studio the products are built in — focused on Bitcoin innovation, community
                building, and platforms that empower creators and communities worldwide.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-surface-raised text-fg-primary rounded-full text-sm">
                  Studio
                </span>
                <span className="px-3 py-1 bg-surface-raised text-fg-primary rounded-full text-sm">
                  Switzerland
                </span>
                <span className="px-3 py-1 bg-surface-raised text-fg-primary rounded-full text-sm">
                  Innovation
                </span>
              </div>
            </div>

            {/* OrangeCat */}
            <div className="text-center p-6 border border-default rounded-lg">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 bg-surface-raised border border-subtle rounded-lg flex items-center justify-center text-fg-primary">
                  <BrandMarkIcon size={24} />
                </div>
              </div>
              <h4 className="text-xl font-semibold text-fg-primary mb-3">OrangeCat</h4>
              <p className="text-fg-secondary mb-4">
                Our flagship consumer product — an AI economic platform where people and agents can
                organize and fund work. Settlement is Bitcoin-only today.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-surface-raised text-fg-primary rounded-full text-sm">
                  Consumer Product
                </span>
                <span className="px-3 py-1 bg-surface-raised text-fg-primary rounded-full text-sm">
                  Bitcoin Native
                </span>
                <span className="px-3 py-1 bg-surface-raised text-fg-primary rounded-full text-sm">
                  Community
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold text-fg-primary text-center mb-12">bitbaum Values</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <TreePine className="w-8 h-8 text-fg-secondary" />
              </div>
              <h4 className="text-lg font-semibold text-fg-primary mb-2">Grow Together</h4>
              <p className="text-fg-secondary text-sm">
                Build interconnected communities where ideas branch and flourish like trees in a
                forest.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-fg-secondary" />
              </div>
              <h4 className="text-lg font-semibold text-fg-primary mb-2">Bitcoin First</h4>
              <p className="text-fg-secondary text-sm">
                Every platform we build is Bitcoin-native, transparent, and censorship-resistant.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-fg-secondary" />
              </div>
              <h4 className="text-lg font-semibold text-fg-primary mb-2">Community First</h4>
              <p className="text-fg-secondary text-sm">
                Empower creators, supporters, and communities to thrive through collective action.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-fg-secondary" />
              </div>
              <h4 className="text-lg font-semibold text-fg-primary mb-2">Always Day 1</h4>
              <p className="text-fg-secondary text-sm">
                Maintain entrepreneurial mindset, innovate relentlessly, and stay humble.
              </p>
            </div>
          </div>
        </div>

        {/* History & Future */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* History */}
          <div className="bg-surface-base rounded-lg shadow-sm p-8">
            <h3 className="text-2xl font-bold text-fg-primary mb-6">Our Story</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-8 h-8 bg-fg-primary rounded-full flex items-center justify-center mr-4 mt-1">
                  <span className="text-fg-inverted text-sm font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-fg-primary">Started in Switzerland</h4>
                  <p className="text-fg-secondary text-sm">
                    bitbaum began in Switzerland as a place to build Bitcoin-native products in the
                    open.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-8 h-8 bg-fg-primary rounded-full flex items-center justify-center mr-4 mt-1">
                  <span className="text-fg-inverted text-sm font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-fg-primary">OrangeCat Launch</h4>
                  <p className="text-fg-secondary text-sm">
                    Released our flagship AI economic agent platform — OrangeCat.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-8 h-8 bg-fg-primary rounded-full flex items-center justify-center mr-4 mt-1">
                  <span className="text-fg-inverted text-sm font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-fg-primary">Community Growth</h4>
                  <p className="text-fg-secondary text-sm">
                    An open, censorship-resistant home for creators and supporters building with
                    Bitcoin.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Future Vision */}
          <div className="bg-surface-base rounded-lg shadow-sm p-8">
            <h3 className="text-2xl font-bold text-fg-primary mb-6">Our Vision</h3>
            <div className="space-y-4">
              <div className="p-4 bg-surface-raised/40 border border-subtle rounded-lg">
                <h4 className="font-semibold text-fg-primary mb-2">Open Economic Infrastructure</h4>
                <p className="text-fg-secondary text-sm">
                  Build Bitcoin-native platforms for every form of economic activity — exchange,
                  funding, lending, investing, and collective governance.
                </p>
              </div>

              <div className="p-4 bg-surface-raised/40 border border-subtle rounded-lg">
                <h4 className="font-semibold text-fg-primary mb-2">AI-Native Economics</h4>
                <p className="text-fg-secondary text-sm">
                  Build AI agents that act as economic participants — creating entities, finding
                  opportunities, and coordinating on behalf of users.
                </p>
              </div>

              <div className="p-4 bg-surface-raised/40 border border-subtle rounded-lg">
                <h4 className="font-semibold text-fg-primary mb-2">Global Communities</h4>
                <p className="text-fg-secondary text-sm">
                  Empower communities worldwide to organize, fund, and govern collectively.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Section Placeholder */}
        <div className="bg-surface-base rounded-lg shadow-sm p-8 text-center">
          <Users className="w-12 h-12 text-fg-tertiary/50 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-fg-primary mb-4">Our Team</h3>
          <p className="text-fg-secondary mb-6">
            A passionate team of Bitcoin enthusiasts, developers, and community builders working
            from Switzerland and around the world.
          </p>
          <Link href="/company/careers">
            <Button variant="accent" size="lg">
              Join Our Team
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
