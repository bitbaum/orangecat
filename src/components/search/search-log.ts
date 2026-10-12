import { API_ROUTES } from '@/config/api-routes';

export function logSearch(query: string, resultCount: number) {
  // An aggregate demand signal — 0 results is the sharpest unmet-demand
  // signal. No PII; sendBeacon survives the navigation that follows.
  try {
    const payload = JSON.stringify({ query, resultCount });
    const beacon = navigator.sendBeacon?.bind(navigator);
    if (beacon) {
      beacon(API_ROUTES.SEARCH.LOG, new Blob([payload], { type: 'application/json' }));
    } else {
      void fetch(API_ROUTES.SEARCH.LOG, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* logging must never disrupt search */
  }
}
