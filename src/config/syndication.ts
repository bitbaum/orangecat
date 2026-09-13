/**
 * Feed syndication — SSOT for which external feeds are pulled onto OrangeCat.
 *
 * The push half of cross-posting already exists (the external publish bus,
 * `src/services/timeline/externalPublish.ts`); this config drives the PULL
 * half: a sweep reads each feed and lands new items through that same bus, so
 * dedup (source + external_id), origin allow-listing, and the wall's "via …"
 * attribution all come for free.
 *
 * Feeds are pinned to a subject project by id — the sweep resolves the
 * project's owner at runtime and publishes on their behalf, which is safe
 * precisely because this list is code-reviewed config, not user input.
 */
import type { ExternalPublishSource, ExternalPublishableEventType } from './external-publish';

export interface SyndicationFeed {
  /** Must be a recognised external-publish source (pins the allowed origins). */
  source: ExternalPublishSource;
  /** RSS 2.0 feed to poll. Must live on the source's allow-listed origin. */
  feedUrl: string;
  /** The OrangeCat project whose wall the items land on. */
  subjectProjectId: string;
  /** How items render in the wall's existing taxonomy. */
  eventType: ExternalPublishableEventType;
}

export const SYNDICATION_FEEDS: readonly SyndicationFeed[] = [
  {
    source: 'loki',
    feedUrl: 'https://loki.orangecat.ch/rss.xml',
    subjectProjectId: '8130c927-114a-45b7-8cc2-99efd5224025',
    eventType: 'project_updated',
  },
] as const;

/** Newest-first cap per feed per sweep — a backfill happens over a few sweeps. */
export const SYNDICATION_MAX_ITEMS_PER_SWEEP = 10;

/**
 * The sweep rides the per-minute reconcile cron (a deploy installs no new
 * timers — see the cron route header), so it throttles itself internally.
 */
export const SYNDICATION_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
