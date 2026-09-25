'use client';

/**
 * /settings/ai — how Cat runs. The same section the Cat settings page shows
 * under "How Cat runs" (components/cat-settings/RunsOnSection); everything
 * else about Cat lives on that page.
 */

import Link from 'next/link';
import { ROUTES } from '@/config/routes';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { RunsOnSection } from '@/components/cat-settings/RunsOnSection';

export default function AISettingsPage() {
  const { user, hydrated, isLoading } = useRequireAuth();

  if (!hydrated || isLoading) {
    return <Loading fullScreen />;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-secondary">
        What powers Cat.{' '}
        <Link
          href={ROUTES.DASHBOARD.CAT_SETTINGS}
          className="underline underline-offset-2 hover:no-underline"
        >
          Cat settings
        </Link>{' '}
        has everything else — what Cat knows, sees and may do.
      </p>
      <RunsOnSection />
    </div>
  );
}
