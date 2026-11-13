import type { Metadata } from 'next';
import Link from 'next/link';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { CapabilityMap } from '@/components/map/CapabilityMap';
import { PublicStartBand } from '@/components/layout/PublicStartBand';
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
 * Signed in or not, the same page; the door and every Start lead into the app,
 * and it ends on the one start action rather than on another product's link.
 */
export default function WhatYouCanDoPage() {
  const decide = ECOSYSTEM_PILLARS.find(p => p.key === 'solon');
  const sections = [
    ...INTENT_LIST.map(intent => ({ id: intent.id, title: intent.title })),
    ...(decide ? [{ id: 'decide', title: 'Decide' }] : []),
  ];
  return (
    <div className="min-h-screen bg-surface-page pb-16">
      <div className={PUBLIC_PAGE_WIDTH.wide}>
        <PublicPageHeader
          align="start"
          title={CAPABILITY_MAP_PAGE.title}
          lede={CAPABILITY_MAP_PAGE.lede}
        >
          <TheDoor className="max-w-2xl" examples={DOOR_EXAMPLES} />
          {/* The on-page index is plain links in one row that scrolls, so it
              cannot be mistaken for the example sentences above it, which
              send a question to the Cat. */}
          <nav aria-label="On this page" className="mt-8">
            <ul className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {sections.map(section => (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#do-${section.id}`}
                    className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </PublicPageHeader>

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

        <PublicStartBand className="mt-16">
          Not sure which of these is yours? Tell your Cat what you want in a sentence. It picks one
          and sets it up.
        </PublicStartBand>
      </div>
    </div>
  );
}
