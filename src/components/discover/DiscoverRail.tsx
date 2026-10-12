import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DiscoverCard } from './DiscoverCard';
import type { Range } from '@bitbaum/searchkit';
import type { PublicHit } from '@/services/search/public-search';

/**
 * A titled row of cards. On a phone it scrolls sideways with the next card
 * peeking, so the row reads as "there is more" without a second screen of
 * headings; from sm up it is a grid.
 */
export function DiscoverRail({
  title,
  hits,
  seeAll,
}: {
  title: string;
  hits: PublicHit[];
  seeAll?: { href: string; label: string };
}) {
  if (hits.length === 0) {
    return null;
  }
  return (
    <section className="oc-discover-rail" aria-label={title}>
      <div className="oc-discover-rail-head">
        <h2 className="oc-discover-rail-title">{title}</h2>
        {seeAll && (
          <Link href={seeAll.href} className="oc-discover-see-all">
            {seeAll.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      <ul className="oc-discover-rail-track">
        {hits.map(hit => (
          <li key={`${hit.type}-${hit.id}`} className="oc-discover-rail-item">
            <DiscoverCard hit={hit} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Cards in a plain grid — one kind, or search results. */
export function DiscoverGrid({
  hits,
  query = '',
}: {
  hits: Array<PublicHit & { marks?: { title: Range[]; snippet: Range[] } }>;
  query?: string;
}) {
  return (
    <ul className="oc-discover-grid">
      {hits.map(hit => (
        <li key={`${hit.type}-${hit.id}`}>
          <DiscoverCard hit={hit} query={query} />
        </li>
      ))}
    </ul>
  );
}
