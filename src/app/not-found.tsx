'use client';

import Link from 'next/link';
import { ArrowLeft, Home, Search } from 'lucide-react';
import { NotFoundView, type NotFoundAction } from '@/components/ui/NotFoundView';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/hooks/useAuth';

export default function NotFound() {
  // Same pattern as RouteError — the primary CTA needs to be reachable
  // by the visitor. Anonymous users clicking "Go to Dashboard" get
  // bounced through /auth?from=/dashboard, which is friction for someone
  // who just typed a wrong URL. Surface Dashboard only when the user
  // can actually use it; everyone else gets Home as the primary.
  const { user, hydrated } = useAuth();
  const showDashboardPrimary = hydrated && !!user;

  const actions: NotFoundAction[] = showDashboardPrimary
    ? [
        { href: ROUTES.DASHBOARD.HOME, label: 'Go to Dashboard', icon: Home, primary: true },
        { href: ROUTES.DISCOVER, label: 'Discover Projects', icon: Search },
        { href: ROUTES.HOME, label: 'Go to Homepage', icon: ArrowLeft },
      ]
    : [
        { href: ROUTES.HOME, label: 'Go to Homepage', icon: Home, primary: true },
        { href: ROUTES.DISCOVER, label: 'Discover Projects', icon: Search },
      ];

  return (
    <NotFoundView
      icon={Search}
      title="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved."
      actions={actions}
    >
      <div className="border-t border-default pt-4 text-center">
        <p className="mb-0 text-sm text-fg-secondary">
          Looking for something specific?{' '}
          <Link
            href={ROUTES.FAQ}
            className="inline-flex min-h-11 items-center font-medium text-fg-primary underline underline-offset-4"
          >
            Visit our FAQ
          </Link>
        </p>
      </div>
    </NotFoundView>
  );
}
