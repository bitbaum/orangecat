/**
 * The investor room of a project (ADR-0012) — what it may hold, and the
 * outline a new room starts from.
 *
 * Plain text in sections, not markdown: a room is read by people the owner
 * hand-picked, and the one thing it must never do is run something they did not
 * write. Paragraphs are split on blank lines; links live in `documents`, where
 * each open is seen.
 */

import { z } from 'zod';
import { webUrl } from '@/lib/validation/base';

export const ROOM_LIMITS = {
  sections: 12,
  sectionTitle: 80,
  sectionBody: 6000,
  documents: 20,
  metrics: 16,
  metricText: 120,
  documentTitle: 120,
  headline: 200,
  label: 120,
} as const;

/** http(s) only via the shared rule, then https only: a room is read on a phone, privately. */
const httpsUrl = webUrl({ max: 2000 }).refine(
  url => url.startsWith('https://'),
  'Use an https:// link'
);

export const roomSectionSchema = z.object({
  title: z.string().trim().min(1).max(ROOM_LIMITS.sectionTitle),
  body: z.string().trim().max(ROOM_LIMITS.sectionBody),
});

export const roomDocumentSchema = z.object({
  title: z.string().trim().min(1).max(ROOM_LIMITS.documentTitle),
  url: httpsUrl,
});

export const roomMetricSchema = z.object({
  label: z.string().trim().min(1).max(ROOM_LIMITS.metricText),
  value: z.string().trim().min(1).max(ROOM_LIMITS.metricText),
  /** How a reader checks it. A figure without this is an assertion. */
  verify: z.string().trim().max(ROOM_LIMITS.metricText),
});

export const roomContentSchema = z.object({
  headline: z.string().trim().max(ROOM_LIMITS.headline).nullable().optional(),
  sections: z.array(roomSectionSchema).max(ROOM_LIMITS.sections),
  metrics: z.array(roomMetricSchema).max(ROOM_LIMITS.metrics),
  metrics_as_of: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  deck_url: httpsUrl.nullable().optional(),
  documents: z.array(roomDocumentSchema).max(ROOM_LIMITS.documents),
  contact_email: z.string().trim().email().max(254).nullable().optional(),
});

export type RoomSection = z.infer<typeof roomSectionSchema>;
export type RoomDocument = z.infer<typeof roomDocumentSchema>;
export type RoomMetric = z.infer<typeof roomMetricSchema>;
export type RoomContent = z.infer<typeof roomContentSchema>;

export const newRoomLinkSchema = z.object({
  label: z.string().trim().min(1).max(ROOM_LIMITS.label),
  email: z.string().trim().email().max(254).nullable().optional(),
  is_shared: z.boolean().optional(),
});

export type NewRoomLink = z.infer<typeof newRoomLinkSchema>;

/**
 * The questions an investor asks, in the order they ask them. A new room starts
 * with these titles and empty bodies; a section left empty is not shown.
 */
export const ROOM_OUTLINE: readonly RoomSection[] = [
  { title: 'The problem', body: '' },
  { title: 'What we built', body: '' },
  { title: 'Proof', body: '' },
  { title: 'Market', body: '' },
  { title: 'Business model', body: '' },
  { title: 'Team', body: '' },
  { title: 'Roadmap', body: '' },
  { title: 'The ask', body: '' },
];

/** Opens of the same link closer together than this are one visit. */
export const ROOM_VISIT_WINDOW_MS = 30 * 60 * 1000;

/** What can be opened inside a room. `room` is the page itself. */
export const ROOM_OPEN_KINDS = ['room', 'deck', 'document', 'build'] as const;
export type RoomOpenKind = (typeof ROOM_OPEN_KINDS)[number];

export const ROOM_COPY = {
  ownerCardTitle: 'Investor room',
  sharedLinkHint:
    'A shared link is for a door rather than a person — a password on your own website. Opens through it are counted together.',
  revokedNotice: 'This link has been switched off. Ask the person who sent it for a new one.',
} as const;

/** Paragraphs of a section body: split on blank lines, empty ones dropped. */
export function roomParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}
