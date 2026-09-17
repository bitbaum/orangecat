/**
 * External publish bus — inbound contract SSOT.
 *
 * OrangeCat is the platform's collaboration + economy backbone; Loki (and
 * future clients) ASYNC-publish publish-worthy build events onto a project's
 * OrangeCat wall. This file is the single source of truth for what that inbound
 * payload may contain — the allow-lists below are the *ceiling*, so a client can
 * never inject an arbitrary event type, subject type, or unknown source onto the
 * wall. The PROMOTE step (which build events are worth publishing, and how they
 * map onto these types) lives on the Loki side, by design.
 *
 * See docs/architecture/PLATFORM_AND_COLLABORATION.md ("Async publish + read-only
 * surfacing") and src/services/timeline/externalPublish.ts.
 */
import { z } from 'zod';
import { webUrl } from '@/lib/validation/base';
import type { TimelineEventType, TimelineSubjectType } from '@/types/timeline';

/** Recognised publishing clients (the `metadata.source` namespace for dedup). */
export const EXTERNAL_PUBLISH_SOURCES = ['loki'] as const;
export type ExternalPublishSource = (typeof EXTERNAL_PUBLISH_SOURCES)[number];

/** Human label per source — drives the wall's "via …" attribution (display SSOT). */
export const EXTERNAL_PUBLISH_SOURCE_LABELS: Record<ExternalPublishSource, string> = {
  loki: 'Loki',
};

/**
 * Allowed deep-link origins per source. A published event's `url` must live on
 * one of these — defence-in-depth so a compromised/buggy client can't surface a
 * link to an arbitrary host on a user's wall. Mirrors the OIDC redirect-uri
 * exact-origin discipline.
 */
export const EXTERNAL_PUBLISH_SOURCE_ORIGINS: Record<ExternalPublishSource, readonly string[]> = {
  loki: ['https://loki.orangecat.ch'],
};

/** True if `url`'s origin is allowed for `source` (used to gate the deep-link). */
export function isAllowedSourceUrl(source: ExternalPublishSource, url: string): boolean {
  try {
    const origin = new URL(url).origin;
    return EXTERNAL_PUBLISH_SOURCE_ORIGINS[source].includes(origin);
  } catch {
    return false;
  }
}

/**
 * Event types an external client may publish. Deliberately a SUBSET of the
 * existing TimelineEventType taxonomy (not new strings) so the wall's formatters,
 * icons, and feeds render them with zero extra work — Loki maps its build
 * events onto these on its side.
 */
export const EXTERNAL_PUBLISHABLE_EVENT_TYPES = [
  'project_updated', // changelog entry / general build update
  'project_milestone', // a milestone was completed
  'project_completed', // the project shipped
  'project_goal_reached', // a funding/build goal was hit
  'project_published', // went live / public
] as const satisfies readonly TimelineEventType[];
export type ExternalPublishableEventType = (typeof EXTERNAL_PUBLISHABLE_EVENT_TYPES)[number];

/** Subjects an external client may attach an update to. Projects only, for now. */
export const EXTERNAL_PUBLISHABLE_SUBJECT_TYPES = [
  'project',
] as const satisfies readonly TimelineSubjectType[];

/** Metadata keys the bus writes. Kept here so the service + dedup index agree. */
export const EXTERNAL_PUBLISH_META = {
  source: 'source',
  externalId: 'external_id',
  sourceUrl: 'source_url', // deep-link back into the originating client
  isExternal: 'is_external_publish',
} as const;

/**
 * Inbound payload schema. snake_case to match the wire/API convention and the
 * DB columns; the route validates against this before the service ever runs.
 */
export const externalPublishSchema = z.object({
  /** Originating client — namespaces external_id and pins the deep-link origin. */
  source: z.enum(EXTERNAL_PUBLISH_SOURCES),
  /** Stable id from the source's own event spine — the idempotency key. */
  external_id: z.string().min(1).max(200),
  event_type: z.enum(EXTERNAL_PUBLISHABLE_EVENT_TYPES),
  subject_type: z.enum(EXTERNAL_PUBLISHABLE_SUBJECT_TYPES).default('project'),
  /** The OrangeCat entity this update is about (must be owned by the caller). */
  subject_id: z.string().guid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** Deep-link back to the source surface (e.g. the Loki changelog entry). */
  url: webUrl().optional(),
  /** Structured payload preserved verbatim under timeline_events.content. */
  content: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  /** When the event happened at the source (defaults to now on the OC side). */
  event_timestamp: z.string().datetime().optional(),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
});

export type ExternalPublishInput = z.infer<typeof externalPublishSchema>;

/** Attribution derived from a timeline event's metadata, for the wall UI. */
export interface ExternalAttribution {
  sourceLabel: string;
  /** Deep-link back to the source surface — already origin-validated at ingest. */
  url?: string;
}

/**
 * Read external-publish attribution off a timeline event's metadata. Returns
 * null for ordinary (non-external) posts so the UI renders nothing extra.
 */
export function getExternalAttribution(
  metadata: Record<string, unknown> | null | undefined
): ExternalAttribution | null {
  if (!metadata || metadata[EXTERNAL_PUBLISH_META.isExternal] !== true) {
    return null;
  }
  const source = metadata[EXTERNAL_PUBLISH_META.source];
  const sourceLabel =
    typeof source === 'string' && source in EXTERNAL_PUBLISH_SOURCE_LABELS
      ? EXTERNAL_PUBLISH_SOURCE_LABELS[source as ExternalPublishSource]
      : 'an external app';
  const rawUrl = metadata[EXTERNAL_PUBLISH_META.sourceUrl];
  const url = typeof rawUrl === 'string' ? rawUrl : undefined;
  return { sourceLabel, url };
}
