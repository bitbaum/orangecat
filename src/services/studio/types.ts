/**
 * Studio media types — shared by the job service, the API routes, and the
 * browser client, so the three cannot disagree about what a job looks like.
 *
 * Created: 2026-09-13
 */

import type { StudioMedium } from '@/config/studio';

/** Mediums that go through the job pipeline (video + music). */
export type StudioJobMedium = Extract<StudioMedium, 'video' | 'music'>;

export interface GeneratedMedia {
  bytes: Uint8Array;
  mimeType: string;
}

/** Result of asking a provider to START a render. */
export type StartJobResult = { ok: true; jobId: string } | { ok: false; error: string };

/**
 * Result of asking a provider whether a render is DONE.
 *
 * `pending` is a first-class answer, not an error: a video takes minutes and
 * the browser is expected to come back and ask again.
 */
export type PollJobResult =
  | { state: 'pending' }
  | { state: 'ready'; media: GeneratedMedia }
  | { state: 'failed'; error: string };
