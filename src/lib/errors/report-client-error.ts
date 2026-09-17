/**
 * Send one browser crash to the server, at most once per distinct error.
 *
 * Deduped because an error boundary can re-render, and a loop that posts on
 * every render would turn one bug into a flood — the reason many apps end up
 * turning client reporting off again. Fire-and-forget: reporting a crash must
 * never be able to cause one.
 */
import { API_ROUTES } from '@/config/api-routes';

const seen = new Set<string>();
const MAX_REPORTS_PER_SESSION = 20;

export interface ClientErrorReport {
  message: string;
  stack?: string;
  digest?: string;
  route?: string;
  component?: string;
  deploySkew?: boolean;
}

export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === 'undefined') {
    return;
  }
  const key = `${report.component ?? ''}|${report.digest ?? ''}|${report.message}`;
  if (seen.has(key) || seen.size >= MAX_REPORTS_PER_SESSION) {
    return;
  }
  seen.add(key);
  try {
    const body = JSON.stringify({ ...report, route: report.route ?? window.location.pathname });
    // keepalive so a report survives the reload a deploy-skew error triggers.
    void fetch(API_ROUTES.CLIENT_ERRORS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let reporting throw */
  }
}

/** Test seam. */
export function resetClientErrorReportsForTests(): void {
  seen.clear();
}
