import Link from 'next/link';
import { User, CalendarDays, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { APP_NAME } from '@/config/brand';
import type { EntityOwner } from '@/lib/entities/fetchEntityOwner';

interface PublicEntityOwnerCardProps {
  owner: EntityOwner;
  label: string;
  /**
   * The owner's publicly visible listing count (fetchProfileListingCounts).
   * Rendered only when > 0 — real numbers only, zero adds no trust.
   */
  activeListingCount?: number;
}

/**
 * Provider trust block on public entity pages: who is this, how long have
 * they been here, what else do they offer. Every line is grounded in real
 * data (profiles.created_at, live listing counts) — never a fake metric.
 */
export default function PublicEntityOwnerCard({
  owner,
  label,
  activeListingCount,
}: PublicEntityOwnerCardProps) {
  const profileHref = owner.username
    ? ROUTES.PROFILES.VIEW(owner.username)
    : null;
  const memberSince = owner.created_at
    ? new Date(owner.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  const showListings = typeof activeListingCount === 'number' && activeListingCount > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {profileHref ? (
          <Link
            href={profileHref}
            className="-m-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-raised"
          >
            <OwnerIdentity owner={owner} label={label} />
          </Link>
        ) : (
          <div className="-m-2 flex items-center gap-3 rounded-lg p-2">
            <OwnerIdentity owner={owner} label={label} />
          </div>
        )}

        {(memberSince || showListings) && (
          <div className="mt-3 space-y-1.5 border-t border-default pt-3">
            {memberSince && (
              <div className="flex items-center gap-2 text-sm text-fg-secondary">
                <CalendarDays className="h-4 w-4 shrink-0 text-fg-tertiary" />
                <span>
                  On {APP_NAME} since {memberSince}
                </span>
              </div>
            )}
            {showListings && (
              <div className="flex items-center gap-2 text-sm text-fg-secondary">
                <LayoutGrid className="h-4 w-4 shrink-0 text-fg-tertiary" />
                <span>
                  {activeListingCount} active {activeListingCount === 1 ? 'listing' : 'listings'}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OwnerIdentity({ owner, label }: Pick<PublicEntityOwnerCardProps, 'owner' | 'label'>) {
  return (
    <>
      {owner.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar_url is a free-form user URL (any host); next/image would throw for hosts outside images.remotePatterns
        <img
          src={owner.avatar_url}
          alt={owner.name || owner.username || label}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 bg-surface-raised rounded-full flex items-center justify-center">
          <User className="w-6 h-6 text-fg-secondary" />
        </div>
      )}
      <div>
        <div className="font-medium text-fg-primary">
          {owner.name || owner.username || 'Anonymous'}
        </div>
        {owner.username && <div className="text-sm text-fg-secondary">@{owner.username}</div>}
      </div>
    </>
  );
}
