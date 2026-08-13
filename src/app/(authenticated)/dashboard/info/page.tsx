/**
 * /dashboard/info — redirects to the user's public profile.
 *
 * The dashboard info page was a separate, less complete view of the same
 * profile data shown on /profiles/[username]. Eliminated per SSOT/DRY/KISS:
 * one view of your profile (the public one), with an edit button.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { ROUTES } from '@/config/routes';

export default function DashboardInfoPage() {
  const { profile, isLoading } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && profile) {
      router.replace(
        profile.username
          ? ROUTES.PROFILES.VIEW(profile.username)
          : ROUTES.DASHBOARD.INFO_EDIT
      );
    }
  }, [isLoading, profile, router]);

  return <Loading fullScreen message="Loading your profile..." />;
}
