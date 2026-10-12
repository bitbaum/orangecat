import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { discoverHref } from '@/services/discover/params';
import { presentTypes, type TypeCounts } from '@/services/discover/view';
import type { PublicHitType } from '@/services/search/public-search';

export function pluralLabel(type: PublicHitType): string {
  return type === 'profile' ? 'People' : ENTITY_REGISTRY[type].namePlural;
}

/**
 * One row of kinds, each with how many there are — for the query when there
 * is one. Kinds with nothing are left out: a chip that leads to an empty
 * page is a dead end. Scrolls sideways on a phone.
 */
export function DiscoverChips({
  counts,
  active,
  q,
  total,
}: {
  counts: TypeCounts;
  active: PublicHitType | null;
  q: string;
  total: number;
}) {
  const types = presentTypes(counts);
  if (types.length === 0) {
    return null;
  }
  const chip = (label: string, count: number | null, type: PublicHitType | null) => (
    <Link
      key={type ?? 'all'}
      href={discoverHref({ q, type })}
      aria-current={active === type ? 'page' : undefined}
      className={cn('oc-discover-chip', active === type && 'oc-discover-chip-active')}
      scroll={false}
    >
      {label}
      {count !== null && <span className="oc-discover-chip-count">{count}</span>}
    </Link>
  );
  return (
    <nav aria-label="Kinds of things" className="oc-discover-chips no-scrollbar">
      {chip('Everything', total, null)}
      {types.map(type => chip(pluralLabel(type), counts[type] ?? 0, type))}
    </nav>
  );
}
