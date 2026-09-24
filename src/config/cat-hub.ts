/**
 * Cat hub — copy and tab SSOT
 *
 * UI strings and tab ids for /dashboard/cat live here only.
 * Do not duplicate "Cat", privacy badges, or tab labels in components.
 *
 * created_date: 2026-01-22
 * last_modified_date: 2026-06-03
 * last_modified_summary: Consolidated Cat UI copy; layout tokens moved to layout-chrome.ts
 */

import { APP_NAME } from '@/config/brand';
import { ROUTES } from '@/config/routes';

export type CatHubTab = 'chat' | 'context' | 'controls';

/** In-product AI persona label (short form of APP_NAME agent) */
export const CAT_AGENT = {
  name: 'Cat',
  productName: APP_NAME,
} as const;

export const CAT_HUB_COPY = {
  title: CAT_AGENT.name,
  /** The personal greeting ("Good evening, Cato") is built in EmptyState. */
  greetingNewUser: 'Tell Cat what you want to do',
  composerPlaceholder: 'Message Cat…',
  contextTitle: 'Context',
  contextDescription: 'Documents and facts your Cat can use for better answers.',
  controlsTitle: 'Controls',
  controlsDescription: 'Model, keys, and permissions for autonomous actions.',
  backToChat: 'Back to chat',
} as const;

export const CAT_HUB_TAB_HREFS: Record<Exclude<CatHubTab, 'chat'>, string> = {
  context: `${ROUTES.DASHBOARD.CAT}?tab=context`,
  controls: `${ROUTES.DASHBOARD.CAT}?tab=controls`,
};

export function isCatHubTab(value: string | null): value is CatHubTab {
  return value === 'chat' || value === 'context' || value === 'controls';
}
