/**
 * Presentational sections extracted from ProfileOverviewTab.tsx to keep that
 * component under the 300-line limit. Pure, prop-driven — no state or data
 * fetching; the parent owns visibility conditions.
 */
import Link from 'next/link';
import { ArrowRight, HandHeart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import ProfileProjectCard from './ProfileProjectCard';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { HELP_WANTED_METADATA, type HelpWantedOption } from '@/config/maker-status';

/** Loose project shape — the page passes server-fetched rows; we read defensively. */
export interface OverviewProject {
  id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  thumbnail_url?: string | null;
  goal_amount?: number | null;
  goal_currency?: string | null;
  currency?: string | null;
  raised_amount?: number | null;
  bitcoin_balance_btc?: number | null;
  category?: string | null;
  status?: string | null;
  bitcoin_address?: string | null;
  created_at: string;
}

/**
 * "How you can help" — the owner's concrete asks. Rendered only when there are
 * some (an empty ask is worse than no ask). The maker status that used to share
 * this card is the badge under the name in the header.
 */
export function ProfileHelpWantedCard({ tags }: { tags: HelpWantedOption[] }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4 sm:p-6">
        <HandHeart className="mt-0.5 h-4 w-4 flex-shrink-0 text-fg-secondary sm:h-5 sm:w-5" />
        <div className="flex-1">
          <div className="mb-2 text-sm text-fg-secondary">How you can help</div>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-default bg-surface-raised px-2.5 py-1 text-xs font-medium text-fg-primary"
              >
                {HELP_WANTED_METADATA[tag].label}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Owner's projects preview — explore-and-fund without leaving the profile. */
export function ProfileProjectsSection({
  visibleProjects,
  totalProjects,
  projectsTabHref,
}: {
  visibleProjects: OverviewProject[];
  totalProjects: number;
  projectsTabHref: string;
}) {
  const ProjectIcon = ENTITY_REGISTRY.project.icon;
  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-fg-primary sm:text-lg">
          <ProjectIcon className="h-4 w-4 text-fg-secondary sm:h-5 sm:w-5" />
          {ENTITY_REGISTRY.project.namePlural}
        </h3>
        {totalProjects > visibleProjects.length && (
          <Link
            href={projectsTabHref}
            className="inline-flex items-center gap-1 text-sm text-fg-secondary hover:text-fg-primary"
          >
            View all {totalProjects}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="space-y-4">
        {visibleProjects.map(p => (
          <ProfileProjectCard
            key={p.id}
            project={{
              id: p.id,
              title: p.title,
              description: p.description,
              imageUrl: p.cover_image_url ?? p.thumbnail_url ?? null,
              goalAmount: p.goal_amount,
              raisedAmount: p.raised_amount ?? undefined,
              balanceBtc: p.bitcoin_balance_btc ?? undefined,
              currency: p.goal_currency ?? p.currency ?? undefined,
              category: p.category,
              status: p.status,
              hasWallet: !!p.bitcoin_address,
              createdAt: p.created_at,
            }}
          />
        ))}
      </div>
    </section>
  );
}
