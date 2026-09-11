'use client';

import { logger } from '@/utils/logger';

import { useEffect, useState } from 'react';
import {
  DEPLOY_SKEW_RELOAD_KEY,
  isDeploySkewError,
  shouldReloadForSkew,
} from '@/lib/errors/deploy-skew';
import { reportClientError } from '@/lib/errors/report-client-error';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Home, RefreshCw, ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  // See RouteError: a build swap under an open tab is not a fault in the page,
  // and the person cannot fix it. Reload once, then stop.
  const [recovering, setRecovering] = useState(() => isDeploySkewError(error));

  useEffect(() => {
    const skew = isDeploySkewError(error);
    logger.error('Application error:', {
      message: error.message,
      digest: error.digest,
      deploySkew: skew,
    });
    reportClientError({
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      component: 'app/error',
      deploySkew: skew,
    });
    if (!skew) {
      setRecovering(false);
      return;
    }
    let lastReloadAt: number | null = null;
    try {
      const stored = window.sessionStorage.getItem(DEPLOY_SKEW_RELOAD_KEY);
      lastReloadAt = stored ? Number(stored) : null;
    } catch {
      /* storage unavailable */
    }
    if (!shouldReloadForSkew(error, lastReloadAt)) {
      setRecovering(false);
      return;
    }
    try {
      window.sessionStorage.setItem(DEPLOY_SKEW_RELOAD_KEY, String(Date.now()));
    } catch {
      /* best effort */
    }
    window.location.reload();
  }, [error]);

  if (recovering) {
    return (
      <div className="oc-page flex items-center justify-center px-4">
        <div className="oc-surface max-w-md w-full space-y-4 p-6 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-fg-tertiary" />
          <h2 className="text-xl font-semibold text-fg-primary">Updating to the latest version</h2>
          <p className="text-sm text-fg-secondary">
            OrangeCat was updated while this page was open. Reloading now — nothing is lost.
          </p>
        </div>
      </div>
    );
  }

  // Check if it's an authentication error
  const isAuthError =
    error.message?.toLowerCase().includes('auth') ||
    error.message?.toLowerCase().includes('login') ||
    error.message?.toLowerCase().includes('unauthorized');

  return (
    <div className="oc-page flex items-center justify-center px-4">
      <div className="oc-surface max-w-lg w-full space-y-8 p-6">
        {/* Icon */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md border border-status-negative/20 bg-status-negative/10 text-status-negative">
            <AlertTriangle className="h-8 w-8" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-fg-primary">Oops! Something went wrong</h2>
          {isAuthError ? (
            <p className="mt-3 text-base text-fg-secondary">
              It looks like you need to be logged in to access this page.
            </p>
          ) : (
            <p className="mt-3 text-base text-fg-secondary">
              We encountered an unexpected error. Don't worry, your data is safe.
            </p>
          )}
        </div>

        {/* Error details (only in development) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="oc-error-surface">
            <p className="text-sm font-mono break-words">{error.message}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {isAuthError ? (
            <Link
              href={ROUTES.AUTH}
              className="group relative flex w-full items-center justify-center gap-2 rounded-md bg-fg-primary px-4 py-3 text-sm font-medium text-fg-inverted transition-colors hover:bg-muted-strong focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              Sign In
            </Link>
          ) : (
            <button
              onClick={reset}
              className="group relative flex w-full items-center justify-center gap-2 rounded-md bg-fg-primary px-4 py-3 text-sm font-medium text-fg-inverted transition-colors hover:bg-muted-strong focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          )}

          <button
            onClick={() => router.back()}
            className="group relative flex w-full items-center justify-center gap-2 rounded-md border border-strong bg-surface-base px-4 py-3 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>

          <Link
            href={ROUTES.HOME}
            className="group relative flex w-full items-center justify-center gap-2 rounded-md border border-strong bg-surface-base px-4 py-3 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            <Home className="h-4 w-4" />
            Go to Homepage
          </Link>
        </div>

        {/* Help text */}
        <div className="text-center pt-4 border-t border-default">
          <p className="text-sm text-fg-secondary">
            Still having issues?{' '}
            <Link
              href={ROUTES.FAQ}
              className="font-medium text-fg-primary hover:text-fg-primary dark:text-fg-primary"
            >
              Visit our FAQ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
