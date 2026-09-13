/**
 * /ecosystem — the canonical answer to "what is OrangeCat part of?".
 *
 * The three-pillar story lived in three places that each told a piece of it:
 * the whitepaper (prose), /support (three cards, hand-copied), and the footer
 * (two bare links). This page is the one surface that shows the stack whole —
 * three products that stay different, and the seams that actually bind them.
 *
 * Every pillar fact comes from ECOSYSTEM_PILLARS (config/ecosystem.ts); this
 * page renders, it does not restate.
 */
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ExternalLink, FileSignature, ShieldCheck } from 'lucide-react';
import { ECOSYSTEM, ECOSYSTEM_LINKS, ECOSYSTEM_PILLARS } from '@/config/ecosystem';
import { ROUTES } from '@/config/routes';
import { SOLON_BASE_URL_DEFAULT } from '@/config/solon';

export const metadata: Metadata = {
  title: 'The stack',
  description:
    'OrangeCat, Loki, and Solon are one stack and three products: the economy, the engineering that builds it, and the governance that keeps both honest.',
  openGraph: {
    title: 'One stack, three pillars',
    description:
      'Fund what is being built, build what people choose to fund, and govern both in the open.',
    type: 'website',
  },
};

const solonBase = process.env.SOLON_BASE_URL || SOLON_BASE_URL_DEFAULT;

/**
 * The two seams that make this a stack rather than three logos on a page.
 * Both are code, and both are pointed at deliberately: a reader can go read
 * the mechanism instead of trusting the claim.
 */
const SEAMS = [
  {
    icon: FileSignature,
    title: 'OrangeCat → Loki',
    label: 'Signed build handoff',
    body: 'An owner can send a public OrangeCat entity to Loki as a short-lived, signed build intent. The signature binds the handoff to the owner who approved it. Funding never dispatches an agent on its own — settlement, planning, and execution stay separate events.',
  },
  {
    icon: ShieldCheck,
    title: 'Solon → OrangeCat',
    label: 'Verified, not trusted',
    body: 'The ceiling on what the Cat may spend changes only through a Bitcoin-signed Solon vote. OrangeCat re-verifies every signature against its own pinned keys, re-derives each signed message, and recomputes the tally before a policy activates. A Solon decision is evidence, not authority.',
  },
] as const;

export default function EcosystemPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero */}
      <div className="border-b border-default bg-surface-base">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <span className="inline-flex items-center rounded-full border border-default bg-surface-page px-4 py-1.5 text-xs font-medium uppercase tracking-caps text-fg-secondary">
            {ECOSYSTEM.owner}
          </span>
          <h1 className="mt-6 font-heading text-4xl font-bold tracking-display text-fg-primary sm:text-5xl">
            One stack, three pillars
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-fg-secondary sm:text-xl">
            Fund what is being built, build what people choose to fund, and govern both in the open.
            Three products, deliberately kept apart — and bound where it counts.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* The pillars — different, in their own words */}
        <section>
          <div className="grid gap-4 md:grid-cols-3">
            {ECOSYSTEM_PILLARS.map(pillar => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.key}
                  className="flex flex-col rounded-lg border border-default bg-surface-base p-6"
                >
                  <Icon className="h-5 w-5 text-fg-secondary" aria-hidden />
                  <h2 className="mt-4 font-heading text-xl font-semibold text-fg-primary">
                    {pillar.title}
                    {pillar.isSelf && (
                      <span className="ml-2 align-middle text-xs font-normal text-fg-tertiary">
                        you are here
                      </span>
                    )}
                  </h2>
                  <p className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
                    {pillar.role}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-fg-secondary">{pillar.summary}</p>
                  <p className="mt-3 border-t border-subtle pt-3 text-sm leading-relaxed text-fg-tertiary">
                    {pillar.boundary}
                  </p>
                  {!pillar.isSelf && (
                    <a
                      href={pillar.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-fg-primary hover:underline"
                    >
                      Visit {pillar.title} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* The seams — one */}
        <section className="mt-16">
          <h2 className="font-heading text-2xl font-bold tracking-display text-fg-primary">
            What binds them
          </h2>
          <p className="mt-3 max-w-2xl text-fg-secondary">
            They stay separate products because public economic coordination, agent execution, and
            rule-making have different security boundaries. They are one stack because two of those
            boundaries are crossed by code you can inspect.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {SEAMS.map(seam => {
              const Icon = seam.icon;
              return (
                <div
                  key={seam.title}
                  className="rounded-lg border border-default bg-surface-base p-6"
                >
                  <Icon className="h-5 w-5 text-fg-secondary" aria-hidden />
                  <h3 className="mt-4 font-semibold text-fg-primary">{seam.title}</h3>
                  <p className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
                    {seam.label}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-fg-secondary">{seam.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Verify it — the claims above are links, not assertions */}
        <section className="mt-16 border-t border-subtle pt-10">
          <h2 className="font-heading text-2xl font-bold tracking-display text-fg-primary">
            Check it yourself
          </h2>
          <p className="mt-3 max-w-2xl text-fg-secondary">
            Don&apos;t take this page&apos;s word for any of it. The governed state of the stack is
            published, versioned, and hashed.
          </p>
          <ul className="mt-5 space-y-3">
            <li>
              <Link
                href={ROUTES.GOVERNANCE}
                className="inline-flex items-center gap-1 font-medium text-fg-primary underline underline-offset-4"
              >
                Platform governance <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
              <span className="text-fg-secondary">
                {' '}
                — every version of the Cat&apos;s spending policy, its content hash, and the Solon
                decision that legitimated it.
              </span>
            </li>
            <li>
              <a
                href={`${solonBase}/api/v1/decisions`}
                rel="noopener"
                className="font-medium text-fg-primary underline underline-offset-4"
              >
                Solon decision API
              </a>
              <span className="text-fg-secondary">
                {' '}
                — the signed decision documents themselves, served by Solon.
              </span>
            </li>
            <li>
              <a
                href={`${solonBase}/ecosystem`}
                rel="noopener"
                className="font-medium text-fg-primary underline underline-offset-4"
              >
                Live governed state
              </a>
              <span className="text-fg-secondary">
                {' '}
                — the whole stack as Solon currently sees it.
              </span>
            </li>
          </ul>
        </section>

        {/* Back it */}
        <section className="mt-16 rounded-lg border border-default bg-surface-base p-8 text-center">
          <h2 className="font-heading text-2xl font-bold tracking-display text-fg-primary">
            Back a pillar
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-fg-secondary">
            Each pillar can be supported on its own — or back the founder and follow everything
            being built across the stack.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ROUTES.SUPPORT}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent-warm px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-warm-hover"
            >
              Choose what to support <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href={ECOSYSTEM_LINKS.mao}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-default px-5 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
            >
              Support {ECOSYSTEM.owner} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
