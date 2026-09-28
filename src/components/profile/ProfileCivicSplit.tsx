/**
 * ProfileCivicSplit — a person's declared civic split on their public profile,
 * shown only when they chose to show it (the read is from civic_splits_public,
 * which carries nothing else). Hidden entirely when there is none: a profile
 * without a statement is not a profile with a gap.
 */
import { Landmark } from 'lucide-react';
import { CIVIC_LEVELS, CIVIC_SPLIT_CAVEAT } from '@/config/civic-split';
import type { CivicShares } from '@/domain/civic-split/schema';
import { SplitBar } from '@/components/civic-split/ShareSliders';

export interface PublicCivicSplit {
  country_code: string;
  region: string;
  locality: string;
  shares: CivicShares;
  note: string | null;
}

export default function ProfileCivicSplit({ split }: { split?: PublicCivicSplit | null }) {
  if (!split) {
    return null;
  }
  const placeFor = (id: (typeof CIVIC_LEVELS)[number]['id']) =>
    id === 'locality' ? split.locality : id === 'region' ? split.region : split.country_code;
  return (
    <section
      aria-labelledby="profile-civic-split"
      className="rounded-lg border border-default bg-surface-base p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-fg-secondary" aria-hidden="true" />
        <h2 id="profile-civic-split" className="font-heading text-base text-fg-primary">
          Where their public money should go
        </h2>
      </div>
      <SplitBar shares={split.shares} className="mt-3" />
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        {CIVIC_LEVELS.map(level => (
          <div key={level.id}>
            <dt className="truncate text-fg-tertiary">{placeFor(level.id)}</dt>
            <dd className="font-heading text-lg tabular-nums text-fg-primary">
              {split.shares[level.id]}%
            </dd>
          </div>
        ))}
      </dl>
      {split.note && <p className="mt-3 text-sm text-fg-secondary">&ldquo;{split.note}&rdquo;</p>}
      <p className="mt-3 text-xs text-fg-muted">{CIVIC_SPLIT_CAVEAT}</p>
    </section>
  );
}
