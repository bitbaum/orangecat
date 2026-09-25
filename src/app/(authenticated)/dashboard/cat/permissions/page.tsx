'use client';

/**
 * /dashboard/cat/permissions — now the same section the Cat settings page
 * shows under "What Cat can do" (components/cat-settings/CanDoSection), so
 * deep links from AI error notices keep landing on their category anchor.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { CanDoSection } from '@/components/cat-settings/CanDoSection';

export default function CatPermissionsPage() {
  const { user, isLoading } = useRequireAuth();

  if (isLoading) {
    return <Loading fullScreen message="Loading..." />;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-page p-4 pb-20 sm:p-6 sm:pb-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href={ROUTES.DASHBOARD.CAT_SETTINGS}
          className="inline-flex items-center gap-2 text-fg-secondary hover:text-fg-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Cat settings
        </Link>
        <h1 className="text-2xl font-semibold text-fg-primary">What Cat can do</h1>
        <CanDoSection userId={user.id} />
      </div>
    </div>
  );
}
