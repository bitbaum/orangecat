'use client';

import { Profile as DatabaseProfile, ProfileFormData } from '@/types/database';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Shield } from 'lucide-react';
import { ProfileDetailsCard } from './ProfileDetailsCard';

interface ProfileInfoTabProps {
  profile: DatabaseProfile & { email?: string | null };
  isOwnProfile?: boolean;
  userId?: string;
  userEmail?: string;
  onSave?: (data: ProfileFormData) => Promise<void>;
  /**
   * Context in which the info tab is rendered.
   * - "public": full public profile info (used on public profile pages)
   * - "dashboard": owner-focused view on /dashboard/info with less duplication
   */
  context?: 'public' | 'dashboard';
}

/**
 * Info — the owner's field-by-field view. Editing happens in one place, the
 * profile editor that the header's "Edit profile" opens; this tab used to
 * carry a second Edit button and a second inline editor.
 */
export default function ProfileInfoTab({
  profile,
  isOwnProfile = false,
  userEmail,
  context = 'public',
}: ProfileInfoTabProps) {
  const isDashboardView = context === 'dashboard';

  return (
    <div className="space-y-6">
      <ProfileDetailsCard
        profile={profile}
        isOwnProfile={isOwnProfile}
        userEmail={userEmail}
        isDashboardView={isDashboardView}
      />

      {/* Account Status is owner-only meta (email verification, completeness).
          Not public — and "Email Verified" keys off the now-redacted account
          email, so it must not render for visitors. */}
      {isOwnProfile && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-fg-secondary" />
              Account Status
            </h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* No email at all is not "not verified": the row waits until there is one. */}
            {(profile.email || userEmail) && (
              <div className="flex items-center justify-between">
                <span className="text-fg-secondary">Email Verified</span>
                <span
                  className={
                    profile.email ? 'text-status-positive font-medium' : 'text-fg-tertiary'
                  }
                >
                  {profile.email ? '✓ Verified' : 'Not verified'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-fg-secondary">Profile Complete</span>
              <span
                className={
                  profile.bio && profile.avatar_url
                    ? 'text-status-positive font-medium'
                    : 'text-fg-secondary font-medium'
                }
              >
                {profile.bio && profile.avatar_url ? '✓ Complete' : 'In Progress'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
