import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DiscoverRailTrack } from '@/components/discover/DiscoverRail';
import { HOME_MAKERS_COPY } from '@/config/landing-page';
import { ROUTES } from '@/config/routes';
import { loadJustListed } from '@/services/discover/view';

/**
 * "Made on OrangeCat": what people have listed, newest first.
 *
 * The proof the hero cannot give on its own. This place used to hold three
 * small counts and then the studio's own product grid (letter plates,
 * internal descriptions), which showed a company's portfolio where a visitor
 * was looking for makers; the studio is on /ecosystem. These are Discover's
 * "Just listed" rows, the same cached query with the same fixture filters,
 * in Discover's own cards, each a link to the page a buyer sees. Nothing is
 * typed here: no listing, no person, no number. With nothing to show (or the
 * read failing) the section is absent, never padded.
 */
export default async function MakersSection() {
  const hits = await loadJustListed();
  if (hits.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="makers-heading"
      className="border-t border-default bg-surface-page py-12 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2
              id="makers-heading"
              className="font-heading text-2xl font-bold tracking-display text-fg-primary sm:text-4xl"
            >
              {HOME_MAKERS_COPY.title}
            </h2>
            <p className="mb-0 mt-3 text-base text-fg-secondary sm:text-lg">
              {HOME_MAKERS_COPY.subtitle}
            </p>
          </div>
          <Link href={ROUTES.DISCOVER} className="oc-discover-see-all">
            {HOME_MAKERS_COPY.seeAll}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </header>
        <DiscoverRailTrack hits={hits} />
      </div>
    </section>
  );
}
