import type { Metadata } from 'next';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { cn } from '@/lib/utils';
import { FLEET_PROFILE_URL, loadOrangeCatProfile } from '@/lib/development/records';
import { linkDevelopment } from '@bitbaum/bip-kit';
import { RoadmapJourney } from '@/components/roadmap/RoadmapJourney';
import { BackTheRoad } from '@/components/capital/BackTheRoad';
import { loadOpenCapital } from '@/services/capital/open-capital';
import { withinDbBudget } from '@/lib/supabase/within-budget';
import { logger } from '@/utils/logger';

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
    // Prerendered: a database that does not answer drops the capital card
    // for this render instead of failing the build (withinDbBudget).
    withinDbBudget(loadOpenCapital('orangecat')).catch(error => {
      logger.warn(
        'Roadmap: capital not read — card omitted this render',
        { error: error instanceof Error ? error.message : String(error) },
        'Roadmap'
      );
      return null;
    }),
  ]);

  return (
    <div className="min-h-screen bg-surface-page">
      <div className={cn(PUBLIC_PAGE_WIDTH.reading, 'pb-16')}>
        <PublicPageHeader
          align="start"
          eyebrow="Product direction"
          title="Roadmap"
          lede="First make public entities effortless to share, fund in Bitcoin, and turn into supervised Loki projects. Broaden the rails only after that loop is dependable."
        />

        {profile === null ? (
          <p className="rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            The roadmap is temporarily unavailable. It is read from the fleet map, which did not
            answer just now; try again in a few minutes.
          </p>
        ) : profile.roadmap.length === 0 ? (
          <p className="rounded-lg border border-default bg-surface-base p-6 text-fg-secondary">
            Nothing recorded yet.
          </p>
        ) : (
          // Drawn as a road — behind us, you are here, ahead — instead of four
          // stacked lists of equal weight (see RoadmapJourney).
          <RoadmapJourney journey={linkDevelopment(profile).journey} />
        )}

        {/* The money behind the road, in the open: fund, lend, invest. */}
        {capital && <BackTheRoad capital={capital} />}

        <p className="mt-16 border-t border-default pt-8 text-sm text-fg-tertiary">
          Read from the fleet map. The record is{' '}
          <a
            href="https://github.com/bitbaum/orangecat/blob/main/ROADMAP.md"
            className="oc-text-link"
          >
            ROADMAP.md
          </a>{' '}
          in the repository; the project&apos;s place in the fleet is{' '}
          <a href={FLEET_PROFILE_URL} className="oc-text-link">
            on Loki
          </a>
          .
        </p>
      </div>
    </div>
  );
}
