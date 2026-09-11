'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/utils/logger';
import {
  DEPLOY_SKEW_RELOAD_KEY,
  isDeploySkewError,
  shouldReloadForSkew,
} from '@/lib/errors/deploy-skew';
import { reportClientError } from '@/lib/errors/report-client-error';
import { ROUTES, getRouteSurface } from '@/config/routes';
import { useAuth } from '@/hooks/useAuth';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  context: string;
}

export function RouteError({ error, reset, context }: RouteErrorProps) {
  const pathname = usePathname();
  const { user, hydrated } = useAuth();
  // A deploy replaced the build this tab was loaded from. The page is not
  // broken and the person cannot fix it — a reload can, and does. Reload
  // once; if the error survives that, it was never skew, so fall through to
  // the real error UI instead of looping.
  const [recovering, setRecovering] = useState(() => isDeploySkewError(error));

  useEffect(() => {
    const skew = isDeploySkewError(error);
    logger.error(
      `${context} error boundary caught error`,
      { error: error.message, digest: error.digest, deploySkew: skew },
      context
    );
    reportClientError({
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      component: context,
      route: pathname ?? undefined,
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
      /* storage unavailable — treat as "not tried yet" */
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
  }, [error, context, pathname]);

  if (recovering) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <RefreshCw className="h-8 w-8 animate-spin text-fg-tertiary mb-4" />
        <h2 className="text-xl font-semibold mb-2">Updating to the latest version</h2>
        <p className="text-fg-secondary max-w-md">
          OrangeCat was updated while this page was open. Reloading now — nothing is lost.
        </p>
      </div>
    );
  }

  // Route the secondary recovery button at a destination the visitor can
  // actually use. An anonymous user landing on /discover/error doesn't
  // want "Go to Dashboard" — that bounces them through auth. Send them
  // back to the public home instead.
  const surface = getRouteSurface(pathname ?? '/');
  const isAuthedOnAppSurface = hydrated && !!user && surface === 'app';
  const recoveryHref = isAuthedOnAppSurface ? ROUTES.DASHBOARD.HOME : ROUTES.HOME;
  const recoveryLabel = isAuthedOnAppSurface ? 'Go to Dashboard' : 'Go to Home';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-fg-secondary mb-4 max-w-md">
        There was a problem loading this page. It has been reported to us. Please try again.
      </p>
      {error.digest && (
        <p className="mb-4 text-xs text-fg-tertiary">
          Reference <code className="font-mono">{error.digest}</code>
        </p>
      )}

      {/* Error details (development only) */}
      {process.env.NODE_ENV === 'development' && error.message && (
        <div className="oc-error-surface mb-6 max-w-md w-full">
          <p className="text-sm font-mono break-words">{error.message}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-background transition-colors hover:bg-muted-strong"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href={recoveryHref}
          className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface-base px-4 py-2 text-fg-primary transition-colors hover:bg-muted"
        >
          <Home className="h-4 w-4" />
          {recoveryLabel}
        </Link>
      </div>
    </div>
  );
}
