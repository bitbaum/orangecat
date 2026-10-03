import type { Metadata } from 'next';
import { PageHeading } from '@/components/layout/PageHeading';
import { FLEET_PROFILE_URL, loadOrangeCatProfile } from '@/lib/development/records';
import { buildJourney } from '@/lib/development/roadmap-journey';
import { RoadmapJourney } from '@/components/roadmap/RoadmapJourney';
import { BackTheRoad } from '@/components/capital/BackTheRoad';
import { loadOpenCapital } from '@/services/capital/open-capital';

/** The capital figures are live; the fleet map is itself cached five minutes. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Roadmap',
  description:
    'What OrangeCat supports today and the focused path to a Bitcoin fund-to-build loop.',
};

/**
 * /roadmap — rendered from the fleet map, never from a local copy. The record
 * is ROADMAP.md at the repository root; Loki's map ingests it. This page owns
 * the markup only.
 */
export default async function RoadmapPage() {
  const [profile, capital] = await Promise.all([
    loadOrangeCatProfile(),
    loadOpenCapital('orangecat'),
  ]);

  return (
    <main className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-caps text-fg-tertiary">
            Product direction
          </p>
          <PageHeading className="mt-4">Roadmap</PageHeading>
          <p className="mt-5 text-lg text-fg-secondary sm:text-xl">
            First make public entities effortless to share, fund in Bitcoin, and turn into
            supervised Loki projects. Broaden the rails only after that loop is dependable.
          </p>
        </div>

        {profile === null ? (
          <p className="mt-14 rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            The roadmap is temporarily unavailable. It is read from the fleet map, which did not
            answer just now; try again in a few minutes.
          </p>
        ) : profile.roadmap.length === 0 ? (
          <p className="mt-14 rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            Nothing recorded yet.
          </p>
        ) : (
          // Drawn as a road — behind us, you are here, ahead — instead of four
          // stacked lists of equal weight (see RoadmapJourney).
          <div className="mt-14">
            <RoadmapJourney journey={buildJourney(profile.roadmap)} />
          </div>
        )}

        {/* The money behind the road, in the open: fund, lend, invest. */}
        {capital && <BackTheRoad capital={capital} />}

        <p className="mt-16 border-t border-default pt-8 text-sm text-fg-tertiary">
          Read from the fleet map. The record is{' '}
          <a
            href="https://github.com/bitbaum/orangecat/blob/main/ROADMAP.md"
            className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
          >
            ROADMAP.md
          </a>{' '}
          in the repository; the project&apos;s place in the fleet is{' '}
          <a
            href={FLEET_PROFILE_URL}
            className="text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
          >
            on Loki
          </a>
          .
        </p>
      </div>
    </main>
  );
}
