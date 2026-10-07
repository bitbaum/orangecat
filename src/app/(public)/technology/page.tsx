import { Metadata } from 'next';
import Link from 'next/link';
import { Bitcoin, Shield, Zap, Lock, Globe, Code, Server, CheckCircle } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { FEE_CLAIMS } from '@/config/landing-page';
import { STACK } from '@/config/stack-versions';

export const metadata: Metadata = {
  title: 'Technology',
  description:
    'Learn about the technology powering OrangeCat - Bitcoin-native economic infrastructure with transparency, security, and zero platform fees.',
  openGraph: {
    title: 'Our Technology',
    description: 'Bitcoin-native economic infrastructure built on modern web technology',
    type: 'website',
  },
};

/**
 * /technology — monochrome surfaces, single Bitcoin Orange accent for
 * actual Bitcoin elements (the chip icon + the Bitcoin tech-stack card).
 * Every other icon flows through fg-secondary; check marks through
 * status-positive. Migration 6/N.
 */
export default function TechnologyPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-surface-page border-b border-default">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-default bg-surface-base px-4 py-2 text-sm font-medium text-fg-primary mb-6">
              <Bitcoin className="h-4 w-4 text-bitcoinOrange" />
              Bitcoin-native
            </div>
            <h1 className="font-heading tracking-display text-4xl font-bold sm:text-5xl lg:text-6xl text-fg-primary">
              Built on Bitcoin
            </h1>
            <p className="mt-6 max-w-3xl mx-auto text-xl text-fg-secondary">
              Direct, transparent, censorship-resistant economic participation powered by the
              world&apos;s most secure network
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Core Principles */}
        <div className="mb-20">
          <h2 className="text-2xl font-semibold text-fg-primary mb-8 text-center">
            Core Principles
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-surface-base p-6 rounded-lg shadow-sm border border-subtle">
              <Bitcoin className="h-12 w-12 text-bitcoinOrange mb-4" />
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Bitcoin-Native</h3>
              <p className="text-fg-secondary">
                True peer-to-peer payments with no intermediaries. Your Bitcoin, your control.
              </p>
            </div>

            <div className="bg-surface-base p-6 rounded-lg shadow-sm border border-subtle">
              <Shield className="h-12 w-12 text-fg-secondary mb-4" />
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Transparent</h3>
              <p className="text-fg-secondary">
                All transactions are publicly verifiable on the Bitcoin blockchain. No hidden fees.
              </p>
            </div>

            <div className="bg-surface-base p-6 rounded-lg shadow-sm border border-subtle">
              <Zap className="h-12 w-12 text-fg-secondary mb-4" />
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Zero Platform Fees</h3>
              <p className="text-fg-secondary">
                We don&apos;t take a cut. Payments go directly between parties —{' '}
                {FEE_CLAIMS.passthroughClaim}
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mb-20">
          <h2 className="text-2xl font-semibold text-fg-primary mb-8 text-center">
            Technology Stack
          </h2>
          <div className="bg-surface-base rounded-lg shadow-sm p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Frontend */}
              <div>
                <div className="flex items-center mb-4">
                  <Globe className="h-6 w-6 text-fg-secondary mr-2" />
                  <h3 className="text-lg font-semibold text-fg-primary">Frontend</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{STACK.next}</span>
                      <p className="text-sm text-fg-secondary">
                        Modern React framework with App Router
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{STACK.typescript}</span>
                      <p className="text-sm text-fg-secondary">Type-safe development</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">{STACK.tailwind}</span>
                      <p className="text-sm text-fg-secondary">Responsive, mobile-first design</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Backend */}
              <div>
                <div className="flex items-center mb-4">
                  <Server className="h-6 w-6 text-fg-secondary mr-2" />
                  <h3 className="text-lg font-semibold text-fg-primary">Backend</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Supabase</span>
                      <p className="text-sm text-fg-secondary">
                        PostgreSQL database with real-time capabilities
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Row Level Security</span>
                      <p className="text-sm text-fg-secondary">Database-level authorization</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Next.js API Routes</span>
                      <p className="text-sm text-fg-secondary">
                        Self-hosted API endpoints on our own infrastructure
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Bitcoin */}
              <div>
                <div className="flex items-center mb-4">
                  <Bitcoin className="h-6 w-6 text-bitcoinOrange mr-2" />
                  <h3 className="text-lg font-semibold text-fg-primary">Bitcoin Integration</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Native Bitcoin Addresses</span>
                      <p className="text-sm text-fg-secondary">Direct wallet-to-wallet transfers</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Lightning Network Ready</span>
                      <p className="text-sm text-fg-secondary">Fast, low-cost micropayments</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Non-Custodial</span>
                      <p className="text-sm text-fg-secondary">You control your private keys</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Security */}
              <div>
                <div className="flex items-center mb-4">
                  <Lock className="h-6 w-6 text-fg-secondary mr-2" />
                  <h3 className="text-lg font-semibold text-fg-primary">Security</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Transport Encryption (TLS 1.3)</span>
                      <p className="text-sm text-fg-secondary">
                        Secure data transmission; E2E messaging planned
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">OAuth 2.0</span>
                      <p className="text-sm text-fg-secondary">Secure authentication</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-status-positive mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">HTTPS Only</span>
                      <p className="text-sm text-fg-secondary">Encrypted connections</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Open Source */}
        <div className="bg-surface-raised/40 rounded-lg p-6 text-center">
          <Code className="h-16 w-16 text-fg-primary mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-fg-primary mb-4">Open Source Philosophy</h2>
          <p className="text-lg text-fg-primary mb-6 max-w-3xl mx-auto">
            We believe in transparency and community-driven development. Our code is open for
            review, contributions, and audits by the Bitcoin community.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href={ROUTES.DISCOVER}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-fg-inverted bg-fg-primary hover:bg-muted-strong"
            >
              Discover Projects
            </Link>
            <Link
              href={ROUTES.FAQ}
              className="inline-flex items-center px-6 py-3 border border-strong text-base font-medium rounded-md text-fg-primary bg-surface-base hover:bg-surface-raised"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
