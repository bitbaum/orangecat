'use client';

import { User, MapPin, Globe, Calendar, Mail, Info, Clock, Phone } from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { SocialLinksDisplay } from './SocialLinksDisplay';
import { SocialLink } from '@/types/social';
import { format } from 'date-fns';
import { isLocationHidden } from '@/lib/location-privacy';
import { getHiddenProfileFields } from '@/config/profile-privacy';
import { ProfileField } from './ProfileField';
import { ROUTES } from '@/config/routes';
import type { Profile as DatabaseProfile } from '@/types/database';

interface ProfileDetailsCardProps {
  profile: DatabaseProfile & { email?: string | null };
  isOwnProfile: boolean;
  userEmail?: string;
  isDashboardView: boolean;
}

export function ProfileDetailsCard({
  profile,
  isOwnProfile,
  userEmail,
  isDashboardView,
}: ProfileDetailsCardProps) {
  const joinDate = profile.created_at ? new Date(profile.created_at) : null;
  const lastActive = profile.updated_at ? new Date(profile.updated_at) : null;
  // Public "Contact Email" is ONLY the opt-in contact_email — never the private
  // account login email. The registration email has its own owner-gated field
  // below. See profile email-leak fix.
  const publicContactEmail = profile.contact_email || null;

  // Owner-only cue: which public fields the owner has hidden from visitors, so
  // the "Hidden" pill can surface their own choice on their own profile view.
  // (Visitors never receive hidden values, so this set is empty-equivalent for
  // them — but we still gate the pill on isOwnProfile in ProfileField.)
  const hiddenFields = new Set(getHiddenProfileFields(profile.privacy_settings));

  const locationValue = (() => {
    if (isLocationHidden(profile.location_context || '')) {
      return <div className="font-medium text-fg-tertiary">Hidden</div>;
    }
    const label = profile.location_search || profile.location;
    return label ? <div className="font-medium text-fg-primary">{label}</div> : undefined;
  })();

  const socialLinks =
    profile.social_links &&
    typeof profile.social_links === 'object' &&
    'links' in profile.social_links &&
    profile.social_links.links &&
    (profile.social_links.links as SocialLink[]).length > 0 ? (
      <SocialLinksDisplay links={profile.social_links.links as SocialLink[]} />
    ) : undefined;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <Info className="w-5 h-5 text-fg-secondary" />
          {isDashboardView ? 'Profile & Account Details' : 'Profile Information'}
        </h3>
      </CardHeader>
      <CardContent className="space-y-8">
        <section aria-labelledby="profile-section-heading">
          <div className="mb-3">
            <h4
              id="profile-section-heading"
              className="text-sm font-semibold text-fg-primary uppercase tracking-wide"
            >
              Profile
            </h4>
            <p className="mt-1 text-xs text-fg-secondary">Basic information about who you are.</p>
          </div>
          <div className="space-y-4">
            <ProfileField
              icon={User}
              label="Username"
              value={
                <div className="font-medium text-fg-primary">@{profile.username || 'Not set'}</div>
              }
              isOwnProfile={isOwnProfile}
            />
            <ProfileField
              icon={User}
              label="Display Name"
              value={
                profile.name ? (
                  <div className="font-medium text-fg-primary">{profile.name}</div>
                ) : undefined
              }
              editHref={`${ROUTES.DASHBOARD.INFO_EDIT}#name`}
              isOwnProfile={isOwnProfile}
            />
            <ProfileField
              icon={Info}
              label="Bio"
              value={
                profile.bio ? (
                  <p className="text-fg-primary whitespace-pre-wrap leading-relaxed">
                    {profile.bio}
                  </p>
                ) : undefined
              }
              editHref={`${ROUTES.DASHBOARD.INFO_EDIT}#bio`}
              isOwnProfile={isOwnProfile}
            />
            <ProfileField
              icon={MapPin}
              label="Location"
              value={locationValue}
              editHref={
                !isLocationHidden(profile.location_context || '')
                  ? `${ROUTES.DASHBOARD.INFO_EDIT}#location`
                  : undefined
              }
              isOwnProfile={isOwnProfile}
            />
          </div>
        </section>

        <section
          aria-labelledby="online-presence-section-heading"
          className="pt-6 border-t border-default"
        >
          <div className="mb-3">
            <h4
              id="online-presence-section-heading"
              className="text-sm font-semibold text-fg-primary uppercase tracking-wide"
            >
              Online Presence
            </h4>
            <p className="mt-1 text-xs text-fg-secondary">Where people can find you on the web.</p>
          </div>
          <div className="space-y-4">
            <ProfileField
              icon={Globe}
              label="Website"
              value={
                profile.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-fg-primary hover:underline underline-offset-4 break-all"
                  >
                    {profile.website}
                  </a>
                ) : undefined
              }
              editHref={`${ROUTES.DASHBOARD.INFO_EDIT}#website`}
              isOwnProfile={isOwnProfile}
              hiddenFromVisitors={hiddenFields.has('website')}
            />
            <ProfileField
              icon={Globe}
              label="Social Media & Links"
              value={socialLinks}
              editHref={`${ROUTES.DASHBOARD.INFO_EDIT}#socialLinks`}
              emptyText="No links added yet"
              isOwnProfile={isOwnProfile}
              hiddenFromVisitors={hiddenFields.has('social_links')}
            />
          </div>
        </section>

        <section aria-labelledby="contact-section-heading" className="pt-6 border-t border-default">
          <div className="mb-3">
            <h4
              id="contact-section-heading"
              className="text-sm font-semibold text-fg-primary uppercase tracking-wide"
            >
              Contact Information
            </h4>
            <p className="mt-1 text-xs text-fg-secondary">How people can reach you.</p>
          </div>
          <div className="space-y-4">
            {isOwnProfile && (
              <ProfileField
                icon={Mail}
                label="Registration Email (private)"
                value={
                  profile.email || userEmail ? (
                    <div>
                      <div className="font-medium text-fg-primary break-all">
                        {profile.email || userEmail}
                      </div>
                      <p className="mb-0 mt-1 text-xs text-fg-secondary">
                        Used for account login. Not shown on public profile.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-fg-primary">None yet</div>
                      <Link
                        href={ROUTES.SETTINGS}
                        className="inline-flex min-h-11 items-center text-sm text-fg-primary underline underline-offset-2"
                      >
                        Add an email
                      </Link>
                    </div>
                  )
                }
                isOwnProfile={isOwnProfile}
              />
            )}
            <ProfileField
              icon={Mail}
              label={`Contact Email${isOwnProfile && !hiddenFields.has('contact_email') ? ' (public)' : ''}`}
              value={
                publicContactEmail ? (
                  <a
                    href={`mailto:${publicContactEmail}`}
                    className="font-medium text-fg-primary hover:underline underline-offset-4 break-all"
                  >
                    {publicContactEmail}
                  </a>
                ) : undefined
              }
              editHref={`${ROUTES.DASHBOARD.INFO_EDIT}#contactEmail`}
              isOwnProfile={isOwnProfile}
              hiddenFromVisitors={hiddenFields.has('contact_email')}
            />
            <ProfileField
              icon={Phone}
              label="Phone"
              value={
                profile.phone ? (
                  <a
                    href={`tel:${profile.phone}`}
                    className="font-medium text-fg-primary hover:underline underline-offset-4"
                  >
                    {profile.phone}
                  </a>
                ) : undefined
              }
              editHref={`${ROUTES.DASHBOARD.INFO_EDIT}#phone`}
              isOwnProfile={isOwnProfile}
              hiddenFromVisitors={hiddenFields.has('phone')}
            />
          </div>
        </section>

        <section aria-labelledby="meta-section-heading" className="pt-6 border-t border-default">
          <div className="mb-3">
            <h4
              id="meta-section-heading"
              className="text-sm font-semibold text-fg-primary uppercase tracking-wide"
            >
              Account Activity
            </h4>
          </div>
          <div className="space-y-3">
            {joinDate && (
              <ProfileField
                icon={Calendar}
                label="Member Since"
                value={
                  <div className="font-medium text-fg-primary">
                    {format(joinDate, 'MMMM d, yyyy')}
                  </div>
                }
              />
            )}
            {lastActive && (
              <ProfileField
                icon={Clock}
                label="Last Active"
                value={
                  <div className="font-medium text-fg-primary">
                    {format(lastActive, 'MMMM d, yyyy')}
                  </div>
                }
              />
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
