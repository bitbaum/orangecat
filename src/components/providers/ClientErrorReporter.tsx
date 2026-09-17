'use client';

/**
 * Makes browser-side failures visible to the server.
 *
 * Two sources, both previously silent: errors the React tree never catches
 * (window 'error', unhandled promise rejections) and error-level logs from the
 * app's own logger, whose `setErrorSink` hook existed with no caller.
 *
 * Mounted once, at the root. Reporting is fire-and-forget and deduped in
 * report-client-error.ts.
 */
import { useEffect } from 'react';
import { setErrorSink } from '@/utils/logger';
import { reportClientError } from '@/lib/errors/report-client-error';
import { isDeploySkewError } from '@/lib/errors/deploy-skew';

export function ClientErrorReporter() {
  useEffect(() => {
    setErrorSink(entry => {
      reportClientError({
        message: entry.message,
        component: entry.source ?? 'logger',
        route: window.location.pathname,
      });
    });

    const onError = (event: ErrorEvent) => {
      reportClientError({
        message: event.message || 'Uncaught error',
        stack: event.error instanceof Error ? event.error.stack : undefined,
        component: 'window.onerror',
        deploySkew: isDeploySkewError(event.error ?? event.message),
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientError({
        message: reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection'),
        stack: reason instanceof Error ? reason.stack : undefined,
        component: 'unhandledrejection',
        deploySkew: isDeploySkewError(reason),
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      setErrorSink(null);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
