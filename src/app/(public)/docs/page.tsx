import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Bot,
  Clapperboard,
  Coins,
  Shield,
  Zap,
  Users,
  Database,
  Code2,
  Lock,
  Globe,
  ArrowRight,
} from 'lucide-react';
import { ENTITY_REGISTRY, ENTITY_TYPES as ENTITY_TYPE_KEYS } from '@/config/entity-registry';
import { STUDIO_MEDIA, STUDIO_MEDIUMS } from '@/config/studio';
import Button from '@/components/ui/Button';
import { PageHeading } from '@/components/layout/PageHeading';
import { ROUTES } from '@/config/routes';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Platform documentation for OrangeCat — how the AI economic agent works, how the Studio makes video, music and writing, entity types, payments, and security.',
};

const ENTITY_TYPES = ENTITY_TYPE_KEYS.filter(t => t !== 'wallet') // wallet is infrastructure, not a user-listable entity type
  .map(t => ({ name: ENTITY_REGISTRY[t].name, description: ENTITY_REGISTRY[t].description }));

/**
 * /docs — monochrome surfaces, single Bitcoin Orange accent on the
 * Lightning Network entry where it semantically marks Bitcoin. Every
 * other section icon tile flows through bg-surface-raised + fg-secondary;
 * info boxes use bg-surface-raised/40. Migration 6/N.
 */
export default function DocsPage() {
  return (
    <div className="min-h-screen bg-surface-page py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <PageHeading className="mb-4">Platform Documentation</PageHeading>
          <p className="text-xl text-fg-secondary max-w-2xl mx-auto">
            How OrangeCat works — the AI agent, the Studio, the entity system, payments, and
            security.
          </p>
        </div>

        {/* The Cat */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-surface-raised border border-subtle">
              <Bot className="h-5 w-5 text-fg-secondary" />
            </div>
            <h2 className="text-2xl font-semibold text-fg-primary">Your Cat — AI Economic Agent</h2>
          </div>
          <div className="bg-surface-base rounded-lg border border-default p-6 space-y-4">
            <p className="text-fg-secondary leading-relaxed">
              Every user and group has a <strong>Cat</strong> — a personal AI agent that understands
              your context and acts on your behalf. The Cat can create entities, draft content,
              search for opportunities, send messages, and coordinate economic activity in plain
              language.
            </p>
            <p className="text-fg-secondary leading-relaxed">
              The Cat reads your authorized data — your own entities, public profiles you interact
              with, and conversations you start. It proposes actions and waits for your confirmation
              before executing them. You stay in control; the Cat handles complexity.
            </p>
            <div className="bg-surface-raised/40 border border-subtle rounded-lg p-4">
              <p className="text-sm text-fg-primary font-medium mb-2">Example Cat commands:</p>
              <ul className="text-sm text-fg-secondary space-y-1">
                <li>
                  &ldquo;Create a project for my open-source library with a 0.1 BTC goal&rdquo;
                </li>
                <li>&ldquo;Find investors interested in renewable energy&rdquo;</li>
                <li>&ldquo;Draft a consulting service listing at my usual rate&rdquo;</li>
                <li>&ldquo;Send a message to the group about this week&apos;s proposal&rdquo;</li>
              </ul>
            </div>
          </div>
        </section>

        {/* The Studio */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-surface-raised border border-subtle">
              <Clapperboard className="h-5 w-5 text-fg-secondary" />
            </div>
            <h2 className="text-2xl font-semibold text-fg-primary">The Studio — making the work</h2>
          </div>
          <div className="bg-surface-base rounded-lg border border-default p-6 space-y-4">
            <p className="text-fg-secondary leading-relaxed">
              OrangeCat does not only list work that already exists. The <strong>Studio</strong>{' '}
              makes it:
            </p>
            <ul className="space-y-2">
              {STUDIO_MEDIUMS.map(medium => (
                <li key={medium} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-fg-primary mt-2 flex-shrink-0" />
                  <p className="text-sm text-fg-secondary">
                    <span className="font-medium text-fg-primary">{STUDIO_MEDIA[medium].name}</span>{' '}
                    — {STUDIO_MEDIA[medium].tagline}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-fg-secondary leading-relaxed">
              The loop that matters is revision. You describe what you want, look at or listen to
              it, and then say what should be different in ordinary words — &ldquo;the middle
              drags&rdquo;, &ldquo;colder light&rdquo;. That note is translated into the craft
              vocabulary the model responds to and becomes the next version, so the work is
              changeable by anyone who can judge it, not only by someone trained to make it.
            </p>
            <p className="text-fg-secondary leading-relaxed">
              Writing runs on OrangeCat&apos;s own free models. Video, music and artwork run on your
              own provider key (Settings → AI): you pay that provider directly and OrangeCat adds no
              markup. Finished work becomes a product; unfinished work becomes a project people can
              fund.
            </p>
            <Link href={ROUTES.STUDIO} className="inline-flex text-sm font-medium text-fg-primary">
              More about the Studio →
            </Link>
          </div>
        </section>

        {/* Entity System */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-surface-raised border border-subtle">
              <Coins className="h-5 w-5 text-fg-secondary" />
            </div>
            <h2 className="text-2xl font-semibold text-fg-primary">Entity System</h2>
          </div>
          <div className="bg-surface-base rounded-lg border border-default p-6">
            <p className="text-fg-secondary leading-relaxed mb-5">
              Everything on OrangeCat is an <strong>entity</strong> — a structured unit of economic
              or governance activity. Entities give the Cat a rich world model to read and operate
              on. There are {ENTITY_TYPES.length} entity types covering the full economic spectrum:
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {ENTITY_TYPES.map(entity => (
                <div
                  key={entity.name}
                  className="flex items-start gap-3 p-3 bg-surface-raised rounded-lg"
                >
                  <div className="w-2 h-2 rounded-full bg-fg-primary mt-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-fg-primary text-sm">{entity.name}</span>
                    <p className="text-fg-secondary text-xs mt-0.5">{entity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Payments */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-surface-raised border border-subtle">
              <Zap className="h-5 w-5 text-fg-secondary" />
            </div>
            <h2 className="text-2xl font-semibold text-fg-primary">Payments</h2>
          </div>
          <div className="bg-surface-base rounded-lg border border-default p-6 space-y-4">
            <p className="text-fg-secondary leading-relaxed">
              Bitcoin and Lightning Network are the native and preferred payment rails. Once you
              connect a Lightning-capable wallet, your username becomes a Lightning address (e.g.{' '}
              <code className="bg-surface-raised px-1 py-0.5 rounded text-sm font-mono">
                yourname@orangecat.ch
              </code>
              ) anyone can pay at instantly, near-zero-fee. On-chain Bitcoin is also supported.
            </p>
            <p className="text-fg-secondary leading-relaxed">
              Other rails are intentionally unavailable today. Fiat methods such as Twint rely on
              banks and private reconciliation without producing a shared public ledger. Privacy
              coins make public attribution impossible by design. Both stay on the roadmap while the
              Bitcoin funding loop is hardened.
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Highlight cards — uniform neutral tiles per migration 6/N */}
              <div className="p-4 bg-surface-raised/40 border border-subtle rounded-lg text-center">
                <p className="font-medium text-fg-primary text-sm">No platform fees</p>
                <p className="text-fg-secondary text-xs mt-1">
                  Payments go directly between parties
                </p>
              </div>
              <div className="p-4 bg-surface-raised/40 border border-subtle rounded-lg text-center">
                <p className="font-medium text-fg-primary text-sm">Non-custodial</p>
                <p className="text-fg-secondary text-xs mt-1">OrangeCat never holds your funds</p>
              </div>
              <div className="p-4 bg-surface-raised/40 border border-subtle rounded-lg text-center">
                <p className="font-medium text-fg-primary text-sm">Auditable settlement</p>
                <p className="text-fg-secondary text-xs mt-1">
                  Confirmed Bitcoin can be publicly verified
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Identity & Privacy */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-surface-raised border border-subtle">
              <Shield className="h-5 w-5 text-fg-secondary" />
            </div>
            <h2 className="text-2xl font-semibold text-fg-primary">Identity &amp; Privacy</h2>
          </div>
          <div className="bg-surface-base rounded-lg border border-default p-6 space-y-4">
            <p className="text-fg-secondary leading-relaxed">
              OrangeCat is <strong>pseudonymous by default</strong>. You can participate fully —
              sell, fund, lend, invest, govern — under any identity you choose. Real-name
              verification is opt-in, never required.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-fg-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-fg-primary text-sm">Row-Level Security</p>
                  <p className="text-fg-secondary text-sm">
                    All database queries are enforced at the database level — one user cannot access
                    another&apos;s private data, even if there is an application bug.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-fg-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-fg-primary text-sm">Visibility control</p>
                  <p className="text-fg-secondary text-sm">
                    Each entity has a visibility setting: public, followers-only, or private. Your
                    profile information is also configurable.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-fg-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-fg-primary text-sm">Authentication</p>
                  <p className="text-fg-secondary text-sm">
                    Handled by Supabase Auth with industry-standard practices. Passwords are hashed
                    and never stored in plaintext.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Groups & Governance */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-surface-raised border border-subtle">
              <Users className="h-5 w-5 text-fg-secondary" />
            </div>
            <h2 className="text-2xl font-semibold text-fg-primary">Groups &amp; Governance</h2>
          </div>
          <div className="bg-surface-base rounded-lg border border-default p-6 space-y-4">
            <p className="text-fg-secondary leading-relaxed">
              <strong>Organizations</strong> are shared accounts on OrangeCat with a shared
              identity, treasury, and governance. Members can have different roles, propose and vote
              on decisions, manage shared funds, and run economic activities collectively. Think
              DAOs, cooperatives, clubs, or any collective that needs to coordinate.
            </p>
            <p className="text-fg-secondary leading-relaxed">
              Every group has its own Cat — a group AI agent that coordinates on behalf of the
              collective, same as individual Cats work for users.
            </p>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-surface-raised">
              <Code2 className="h-5 w-5 text-fg-secondary" />
            </div>
            <h2 className="text-2xl font-semibold text-fg-primary">Technology Stack</h2>
          </div>
          <div className="bg-surface-base rounded-lg border border-default p-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-fg-primary mb-3">Frontend</h3>
                <ul className="space-y-2 text-sm text-fg-secondary">
                  <li className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-fg-tertiary" />
                    Next.js 15 (App Router)
                  </li>
                  <li className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-fg-tertiary" />
                    TypeScript 5.8
                  </li>
                  <li className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-fg-tertiary" />
                    Tailwind CSS 3
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-fg-primary mb-3">Backend</h3>
                <ul className="space-y-2 text-sm text-fg-secondary">
                  <li className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-fg-tertiary" />
                    Supabase (PostgreSQL + Auth + RLS)
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-fg-tertiary" />
                    Row-Level Security on all tables
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-bitcoinOrange" />
                    Lightning Network + BTCPay
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Getting Started — public-surface near-black band per FleetCrown pattern */}
        <section className="mb-10">
          <div className="bg-surface-public border border-subtle rounded-lg p-8 text-center">
            <h2 className="font-heading tracking-display text-2xl font-bold text-fg-inverted mb-3">
              Ready to get started?
            </h2>
            <p className="text-fg-inverted/70 mb-6 max-w-xl mx-auto">
              Create an account, set up your profile and payment methods, then ask your Cat to help
              you launch your first entity.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={`${ROUTES.AUTH}?mode=register`}>
                <Button variant="accent" size="lg">
                  Create Account
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href={ROUTES.FAQ}>
                {/* Outline inverted for the dark band — the default outline
                    (dark text/border) is invisible on bg-surface-public. */}
                <Button
                  variant="outline"
                  size="lg"
                  className="border-fg-inverted/40 text-fg-inverted hover:bg-fg-inverted/10"
                >
                  View FAQ
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
