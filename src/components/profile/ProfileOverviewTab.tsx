'use client';

import type { ScalableProfile } from '@/services/profile/types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Mail, Phone } from 'lucide-react';
import { SocialLinksDisplay } from './SocialLinksDisplay';
import { ProfileSupportSection } from './ProfileSupportSection';
import {
  ProfileHelpWantedCard,
  ProfileProjectsSection,
  type OverviewProject,
} from './ProfileOverviewSections';
import { SocialLink } from '@/types/social';
import { ROUTES } from '@/config/routes';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { isHelpWantedOption } from '@/config/maker-status';

interface ProfileOverviewTabProps {
  profile: ScalableProfile;
  /** Owner's projects, surfaced as an explore-and-fund section. */
  projects?: OverviewProject[];
  stats?: {
    projectCount: number;
    totalRaised: number;
  };
  isOwnProfile?: boolean;
}

const PROJECTS_PREVIEW = 3;

/**
 * Overview — what the header card above it does NOT already say.
 *
 * It used to open with an "About" card repeating the bio, a lone "9 Projects"
 * card repeating the tab badge, an "Online presence" card repeating the website
 * link, and a "Contact" card whose only row for most visitors was the joined
 * date — also in the header. Every section here now appears only when it has
 * something of its own to show.
 */
export default function ProfileOverviewTab({
  profile,
  projects,
  stats,
  isOwnProfile = false,
}: ProfileOverviewTabProps) {
  const visibleProjects = (projects ?? []).slice(0, PROJECTS_PREVIEW);
  const projectsTabHref = `${ROUTES.PROFILES.VIEW(profile.username || profile.id)}?tab=projects`;
  // Public contact email is ONLY the opt-in contact_email field — never the
  // private account login email (profile.email). See profile email-leak fix.
  const publicContactEmail = profile.contact_email;
  const { formatAmountBtc } = useDisplayCurrency();

  const socialLinks =
    !!profile.social_links &&
    typeof profile.social_links === 'object' &&
    'links' in profile.social_links &&
    Array.isArray(profile.social_links.links)
      ? (profile.social_links.links as SocialLink[])
      : [];
  const hasContact = !!publicContactEmail || !!profile.phone;
  const hasRaised = !!stats && stats.totalRaised > 0;
  const helpTags = (profile.help_wanted || []).filter(isHelpWantedOption);

  const sections = [
    helpTags.length > 0 && <ProfileHelpWantedCard key="help" tags={helpTags} />,
    visibleProjects.length > 0 && (
      <ProfileProjectsSection
        key="projects"
        visibleProjects={visibleProjects}
        totalProjects={projects?.length ?? 0}
        projectsTabHref={projectsTabHref}
      />
    ),
    hasRaised && (
      <Card key="raised">
        <CardContent className="flex items-baseline justify-between gap-3 p-4 sm:p-6">
          <span className="text-sm text-fg-secondary">Total raised</span>
          <span className="text-xl font-bold text-status-positive sm:text-2xl">
            {formatAmountBtc(stats.totalRaised)}
          </span>
        </CardContent>
      </Card>
    ),
    socialLinks.length > 0 && (
      <Card key="links">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
          <h3 className="text-base font-semibold sm:text-lg">Links</h3>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <SocialLinksDisplay links={socialLinks} compact={true} />
        </CardContent>
      </Card>
    ),
    hasContact && (
      <Card key="contact">
        <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
          <h3 className="text-base font-semibold sm:text-lg">Contact</h3>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
          {publicContactEmail && (
            <a
              href={`mailto:${publicContactEmail}`}
              className="flex items-center gap-3 break-all text-sm text-fg-primary underline-offset-4 hover:underline sm:text-base"
            >
              <Mail className="h-4 w-4 flex-shrink-0 text-fg-tertiary" aria-hidden />
              {publicContactEmail}
            </a>
          )}
          {profile.phone && (
            <a
              href={`tel:${profile.phone}`}
              className="flex items-center gap-3 text-sm text-fg-primary underline-offset-4 hover:underline sm:text-base"
            >
              <Phone className="h-4 w-4 flex-shrink-0 text-fg-tertiary" aria-hidden />
              {profile.phone}
            </a>
          )}
        </CardContent>
      </Card>
    ),
    // The owner's share-your-pay-link tool. A visitor's way to pay is the Pay
    // button in the header; a second "Pay <name>" card here repeated it.
    isOwnProfile && profile.username && (
      <ProfileSupportSection
        key="support"
        username={profile.username}
        displayName={profile.name || profile.username}
        isOwner
      />
    ),
  ].filter(Boolean);

  if (sections.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-fg-secondary">
        {isOwnProfile
          ? 'Nothing here yet. Projects, links and ways to help show up here once you add them.'
          : 'Nothing more to show yet.'}
      </p>
    );
  }

  return <div className="space-y-4 sm:space-y-6">{sections}</div>;
}
