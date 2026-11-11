'use client';

import { useSyncExternalStore } from 'react';
import { browserSupportsPasskeys } from '@/services/supabase/auth';

// Browser support never changes during a page's life, so there is nothing to
// subscribe to.
const subscribe = () => () => {};

/**
 * Whether this browser can use a passkey — `false` on the server and during
 * hydration, the real answer from the first client render after it.
 *
 * Calling browserSupportsPasskeys() straight in render made the server (no
 * window → false) and the browser (true) render different HTML, and React
 * threw a hydration error (#418) on every load of /auth.
 */
export function usePasskeysSupported(): boolean {
  return useSyncExternalStore(subscribe, browserSupportsPasskeys, () => false);
}
