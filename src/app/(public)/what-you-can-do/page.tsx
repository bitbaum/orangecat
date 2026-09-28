import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeading } from '@/components/layout/PageHeading';
import { CapabilityMap } from '@/components/map/CapabilityMap';
import { TheDoor } from '@/components/map/TheDoor';
import { CAPABILITY_MAP_PAGE } from '@/config/capability-map';
import { DOOR_EXAMPLES } from '@/config/cat-door';
import { INTENT_LIST } from '@/config/intents';
import { ECOSYSTEM_PILLARS } from '@/config/ecosystem';

export const metadata: Metadata = {
  title: CAPABILITY_MAP_PAGE.title,
  description: CAPABILITY_MAP_PAGE.lede,
};

/**
 * The map: every capability, in the visitor's words, with a start button.
 * Public on purpose — the person who most needs it has no account yet.
 * Signed in or not, the same page; the door and every Start lead into the app.
 */
export default function WhatYouCanDoPage() {
  const decide = ECOSYSTEM_PILLARS.find(p => p.key === 'solon');
  return (
    <div className="min-h-screen bg-surface-page pb-16">
      <div className="container mx-auto max-w-5xl px-4">
        <header className="py-12 sm:py-16">
          <PageHeading>{CAPABILITY_MAP_PAGE.title}</PageHeading>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-fg-secondary">
            {CAPABILITY_MAP_PAGE.lede}
          </p>
          <TheDoor className="mt-8 max-w-2xl" examples={DOOR_EXAMPLES} />
          <nav aria-label="On this page" className="mt-8">
            <ul className="flex flex-wrap gap-2">
              {INTENT_LIST.map(intent => (
                <li key={intent.id}>
                  <a
                    href={`#do-${intent.id}`}
                    className="inline-block rounded-full border border-default bg-surface-base px-3 py-1.5 text-sm text-fg-secondary hover:border-interactive hover:text-fg-primary"
                  >
                    {intent.title}
                  </a>
                </li>
              ))}
              {decide && (
                <li>
                  <a
                    href="#do-decide"
                    className="inline-block rounded-full border border-default bg-surface-base px-3 py-1.5 text-sm text-fg-secondary hover:border-interactive hover:text-fg-primary"
                  >
                    Decide
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </header>

        <CapabilityMap />

        {decide && (
          <section id="do-decide" aria-labelledby="do-decide-title" className="mt-12">
            <div className="mb-5 max-w-3xl">
              <h2 id="do-decide-title" className="font-heading text-2xl text-fg-primary">
                Decide
              </h2>
              <p className="mt-1 text-base leading-relaxed text-fg-secondary">
                When a group here needs to decide something — who joins, what to spend, what the
                rules are — it decides in {decide.title}, with signed votes anyone can recount. Same
                identity, no second account.
              </p>
            </div>
            <Link
              href={decide.siteUrl}
              className="inline-flex min-h-11 items-center rounded-lg border border-default bg-surface-base px-4 text-sm font-semibold text-fg-primary hover:border-interactive"
            >
              Open {decide.title} →
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
