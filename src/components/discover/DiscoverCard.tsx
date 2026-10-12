import Link from 'next/link';
import { Highlight } from '@/components/search/Highlight';
import { DiscoverCardMedia } from './DiscoverCardMedia';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { FormattedDate } from '@/components/ui/FormattedDate';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { Range } from '@bitbaum/searchkit';
import type { PublicHit } from '@/services/search/public-search';

/** "Project", "Product" … and "Person". */
export function kindLabel(type: PublicHit['type']): string {
  return type === 'profile' ? 'Person' : ENTITY_REGISTRY[type].name;
}

/** The one fact that makes a card worth opening, by kind. */
function Fact({ hit }: { hit: PublicHit }) {
  if (hit.type === 'event' && hit.startsAt) {
    return (
      <span>
        <FormattedDate value={hit.startsAt} />
        {hit.place ? ` · ${hit.place}` : ''}
      </span>
    );
  }
  if (hit.amount && hit.amount > 0 && hit.currency) {
    const lead =
      hit.type === 'project' || hit.type === 'cause' ? 'Goal ' : hit.type === 'loan' ? 'Asks ' : '';
    return (
      <span>
        {lead}
        <CurrencyDisplay amount={hit.amount} currency={hit.currency} size="sm" />
      </span>
    );
  }
  if (hit.handle) {
    return <span>@{hit.handle}</span>;
  }
  return hit.place ? <span>{hit.place}</span> : null;
}

/**
 * One public listing. Every card has the same parts in the same places —
 * picture, kind, title, two lines, one fact — so a row of them scans as a
 * row. Matched words are picked out when the card answers a search.
 */
export function DiscoverCard({
  hit,
  query = '',
}: {
  hit: PublicHit & { marks?: { title: Range[]; snippet: Range[] } };
  query?: string;
}) {
  return (
    <Link href={hit.href} className="oc-discover-card group">
      <DiscoverCardMedia src={hit.imageUrl} title={hit.title} round={hit.type === 'profile'} />
      <div className="oc-discover-body">
        <p className="oc-discover-kind">{kindLabel(hit.type)}</p>
        <h3 className="oc-discover-title">
          <Highlight text={hit.title} query={query} ranges={hit.marks?.title} />
        </h3>
        {hit.snippet && (
          <p className="oc-discover-snippet">
            <Highlight text={hit.snippet} query={query} ranges={hit.marks?.snippet} />
          </p>
        )}
        <p className="oc-discover-fact">
          <Fact hit={hit} />
        </p>
      </div>
    </Link>
  );
}
