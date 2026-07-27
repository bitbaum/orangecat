/**
 * Presentational sections extracted from ProfileOverviewTab.tsx to keep that
 * component under the 300-line limit. Pure, prop-driven — no state or data
 * fetching; the parent owns visibility conditions.
 */
import Link from 'next/link';
import { User, ArrowRight, Activity, HandHeart } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import ProfileProjectCard from './ProfileProjectCard';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import {
  MAKER_STATUS_METADATA,
  HELP_WANTED_METADATA,
  isMakerStatus,
  isHelpWantedOption,
} from '@/config/maker-status';

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

/** "About" card — shows the bio, or an owner-only prompt to add one. */
export function ProfileAboutCard({
  bio,
  isOwnProfile,
  isDashboardView,
}: {
  bio?: string | null;
  isOwnProfile: boolean;
  isDashboardView: boolean;
}) {
  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-fg-secondary" />
          About
        </h3>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        {bio ? (
          <p className="text-sm sm:text-base text-fg-primary whitespace-pre-wrap leading-relaxed">
            {bio}
          </p>
        ) : isOwnProfile && isDashboardView ? (
          <a
            href={`${ROUTES.DASHBOARD.INFO_EDIT}#bio`}
            className="inline-flex items-center gap-2 text-fg-primary hover:text-fg-primary underline-offset-4 hover:underline group text-sm sm:text-base"
          >
            <span className="text-fg-tertiary italic group-hover:text-fg-primary">
              Tell people more about yourself
            </span>
            <span className="text-xs uppercase tracking-wide">Add bio</span>
          </a>
        ) : (
          <p className="text-sm sm:text-base text-fg-tertiary italic">No bio yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * "Status & How to Help" card — the concrete answer to "what stage are they
 * at" and "what do they actually need". Hidden for visitors when the owner
 * hasn't set either field (an empty ask is worse than no ask); the owner
 * always sees it so the gap stays visible and fixable.
 */
export function ProfileStatusCard({
  currentStatus,
  helpWanted,
  isOwnProfile,
  isDashboardView,
}: {
  currentStatus?: string | null;
  helpWanted?: string[] | null;
  isOwnProfile: boolean;
  isDashboardView: boolean;
}) {
  const statusMeta = isMakerStatus(currentStatus) ? MAKER_STATUS_METADATA[currentStatus] : null;
  const helpTags = (helpWanted || []).filter(isHelpWantedOption);

  if (!statusMeta && helpTags.length === 0 && !(isOwnProfile && isDashboardView)) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-fg-secondary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm text-fg-secondary mb-1">Status</div>
            {statusMeta ? (
              <div>
                <span className="inline-flex items-center rounded-full bg-surface-raised border border-default px-2.5 py-1 text-xs font-medium text-fg-primary">
                  {statusMeta.label}
                </span>
                <p className="mt-1 text-sm text-fg-secondary">{statusMeta.description}</p>
              </div>
            ) : isOwnProfile && isDashboardView ? (
              <a
                href={`${ROUTES.DASHBOARD.INFO_EDIT}#currentStatus`}
                className="inline-flex items-center gap-2 text-fg-primary hover:text-fg-primary underline-offset-4 hover:underline text-sm sm:text-base"
              >
                <span className="text-fg-tertiary italic">Share the status of your work</span>
                <span className="text-xs uppercase tracking-wide">Add status</span>
              </a>
            ) : (
              <span className="text-sm sm:text-base text-fg-tertiary italic">
                No status set yet.
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 pt-3 border-t border-default">
          <HandHeart className="w-4 h-4 sm:w-5 sm:h-5 text-fg-secondary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm text-fg-secondary mb-2">How you can help</div>
            {helpTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {helpTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full bg-surface-raised border border-default px-2.5 py-1 text-xs font-medium text-fg-primary"
                  >
                    {HELP_WANTED_METADATA[tag].label}
                  </span>
                ))}
              </div>
            ) : isOwnProfile && isDashboardView ? (
              <a
                href={`${ROUTES.DASHBOARD.INFO_EDIT}#helpWanted`}
                className="inline-flex items-center gap-2 text-fg-primary hover:text-fg-primary underline-offset-4 hover:underline text-sm sm:text-base"
              >
                <span className="text-fg-tertiary italic">Tell people how they can help</span>
                <span className="text-xs uppercase tracking-wide">Add ways to help</span>
              </a>
            ) : (
              <span className="text-sm sm:text-base text-fg-tertiary italic">
                No specific asks yet.
              </span>
            )}
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
