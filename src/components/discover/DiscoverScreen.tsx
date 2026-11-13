import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DiscoverChips, pluralLabel } from './DiscoverChips';
import { DiscoverGrid, DiscoverRail } from './DiscoverRail';
import { kindLabel } from './DiscoverCard';
import EventsNearYou from '@/components/events/EventsNearYou';
import type { PublicHitType } from '@/services/search/public-search';
import { DiscoverSearchBox } from './DiscoverSearchBox';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import { DISCOVER_HERO, DISCOVER_RAIL_VISIBLE } from '@/config/discover-tabs';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { discoverHref, type DiscoverParams } from '@/services/discover/params';
import { presentTypes, type DiscoverView, type TypeCounts } from '@/services/discover/view';

const sum = (counts: TypeCounts) => Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

function ShowMore({ params, hasMore }: { params: DiscoverParams; hasMore: boolean }) {
  if (!hasMore) {
    return null;
  }
  return (
    <div className="mt-8 flex justify-center">
      <Link
        href={discoverHref({ ...params, page: params.page + 1 })}
        scroll={false}
        className="oc-discover-more"
      >
        Show more
      </Link>
    </div>
  );
}

function Shelf({ view }: { view: Extract<DiscoverView, { mode: 'shelf' }> }) {
  const listings = sum(view.counts);
  // An empty shelf means the listings did not load, not that the platform is
  // empty: "That's everything for now" over zero listings read as a verdict.
  if (listings === 0 && view.fresh.length === 0) {
    return (
      <div className="oc-discover-empty">
        <p className="font-heading text-xl font-semibold text-fg-primary">
          Nothing could be loaded.
        </p>
        <p className="mt-2 text-fg-secondary">The listings did not arrive. Try again.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={ROUTES.DISCOVER} className="oc-discover-more">
            Try again
          </Link>
        </div>
      </div>
    );
  }
  return (
    <>
      <DiscoverRail title="Just listed" hits={view.fresh} />
      {view.rails.map(rail => (
        <DiscoverRail
          key={rail.type}
          title={pluralLabel(rail.type)}
          hits={rail.hits}
          seeAll={
            // From sm up a rail shows DISCOVER_RAIL_VISIBLE cards and hides the
            // rest it fetched, so any rail longer than that needs the way on.
            rail.total > DISCOVER_RAIL_VISIBLE
              ? { href: discoverHref({ type: rail.type }), label: `See all ${rail.total}` }
              : undefined
          }
        />
      ))}
      {view.more.length > 0 && (
        <p className="oc-discover-also">
          Also here:{' '}
          {view.more.map((type, i) => (
            <span key={type}>
              {i > 0 && ' · '}
              <Link href={discoverHref({ type })} className="oc-discover-inline-link">
                {pluralLabel(type)} ({view.counts[type]})
              </Link>
            </span>
          ))}
        </p>
      )}
      <div className="oc-discover-end">
        <p className="font-heading text-xl font-semibold text-fg-primary sm:text-2xl">
          That’s everything for now.
        </p>
        <p className="mt-2 text-fg-secondary">
          {listings} listings across {presentTypes(view.counts).length} kinds, each paid to its
          owner directly. Yours could be the next one here.
        </p>
        <Link href={ROUTES.CREATE} className="oc-problem-action">
          <Plus className="h-4 w-4" aria-hidden />
          {DISCOVER_HERO.cta}
        </Link>
      </div>
    </>
  );
}

function NothingFound({
  params,
  view,
}: {
  params: DiscoverParams;
  view: Extract<DiscoverView, { mode: 'search' }>;
}) {
  const elsewhere = params.type ? sum(view.counts) : 0;
  const create =
    params.type && params.type !== 'profile'
      ? ENTITY_REGISTRY[params.type].createPath
      : ROUTES.CREATE;
  return (
    <>
      <div className="oc-discover-empty">
        <p className="font-heading text-xl font-semibold text-fg-primary">
          Nothing public matches “{params.q}”
          {params.type ? ` in ${pluralLabel(params.type).toLowerCase()}` : ''} yet.
        </p>
        {view.suggestion && (
          <p className="mt-2 text-fg-secondary">
            Did you mean{' '}
            <Link
              href={discoverHref({ q: view.suggestion, type: params.type })}
              className="oc-discover-inline-link"
            >
              {view.suggestion}
            </Link>
            ?
          </p>
        )}
        {elsewhere > 0 ? (
          <p className="mt-2 text-fg-secondary">
            <Link href={discoverHref({ q: params.q })} className="oc-discover-inline-link">
              {elsewhere} other {elsewhere === 1 ? 'result' : 'results'} for “{params.q}”
            </Link>{' '}
            in other kinds.
          </p>
        ) : (
          <p className="mt-2 text-fg-secondary">
            Try a shorter or different word. Or let your Cat look further, or set it up for you.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(params.q)}`}
            className="oc-problem-action mt-0"
          >
            <BrandMarkIcon className="h-4 w-4" aria-hidden />
            Ask your Cat
          </Link>
          <Link href={create} className="oc-discover-more">
            List it yourself
          </Link>
        </div>
      </div>
      <DiscoverRail title="Just listed" hits={view.fallback} />
    </>
  );
}

/** "1 product", "3 products" — the kind's own words from the registry. */
export function countLabel(type: PublicHitType, total: number): string {
  return `${total} ${(total === 1 ? kindLabel(type) : pluralLabel(type)).toLowerCase()}`;
}

/** One kind with nothing public yet: say so, and offer to be the first. */
function NothingListed({
  type,
  fallback,
}: {
  type: PublicHitType;
  fallback: Extract<DiscoverView, { mode: 'browse' }>['fallback'];
}) {
  const create = type === 'profile' ? ROUTES.CREATE : ENTITY_REGISTRY[type].createPath;
  return (
    <>
      <div className="oc-discover-empty">
        <p className="mb-0 font-heading text-xl font-semibold text-fg-primary">
          No {pluralLabel(type).toLowerCase()} listed yet.
        </p>
        <Link href={create} className="oc-problem-action">
          <Plus className="h-4 w-4" aria-hidden />
          List the first one
        </Link>
      </div>
      <DiscoverRail title="Just listed" hits={fallback} />
    </>
  );
}

/** /discover, whichever mode its URL asks for. */
export function DiscoverScreen({ params, view }: { params: DiscoverParams; view: DiscoverView }) {
  const everything = view.mode === 'search' ? view.total : sum(view.counts);
  // A kind's page names the kind; "Discover" over a grid of products did not
  // say which page this was.
  const kind = view.mode === 'browse' ? view.type : null;
  return (
    <div className="oc-discover">
      <header className="oc-discover-head">
        {kind ? (
          <>
            <Link href={ROUTES.DISCOVER} className="oc-discover-up">
              {DISCOVER_HERO.title}
            </Link>
            <h1 className="oc-discover-h1">{pluralLabel(kind)}</h1>
          </>
        ) : (
          <>
            <h1 className="oc-discover-h1">{DISCOVER_HERO.title}</h1>
            <p className="oc-discover-lede">{DISCOVER_HERO.lede}</p>
          </>
        )}
        <DiscoverSearchBox initialQuery={params.q} type={params.type} />
        <DiscoverChips counts={view.counts} active={params.type} q={params.q} total={everything} />
      </header>

      {view.mode === 'shelf' && <Shelf view={view} />}

      {view.mode === 'browse' && (
        <section aria-label={pluralLabel(view.type)}>
          {view.type === 'event' && (
            <div className="mb-10">
              <EventsNearYou />
            </div>
          )}
          {view.hits.length === 0 ? (
            <NothingListed type={view.type} fallback={view.fallback} />
          ) : (
            <>
              <p className="oc-discover-status">
                {countLabel(view.type, view.total)}, newest first
              </p>
              <DiscoverGrid hits={view.hits} />
              <ShowMore params={params} hasMore={view.hasMore} />
            </>
          )}
        </section>
      )}

      {view.mode === 'search' &&
        (view.hits.length === 0 ? (
          <NothingFound params={params} view={view} />
        ) : (
          <section aria-label={`Results for ${params.q}`}>
            <p className="oc-discover-status" aria-live="polite">
              {view.total} {view.total === 1 ? 'result' : 'results'} for “{params.q}”, best match
              first
            </p>
            <DiscoverGrid hits={view.hits} query={params.q} />
            <ShowMore params={params} hasMore={view.hasMore} />
          </section>
        ))}
    </div>
  );
}
