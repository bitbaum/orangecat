/**
 * Browser client for the Studio. Same thin-fetch style as the image client:
 * unwrap { success, data } or throw a friendly Error.
 *
 * Created: 2026-09-13
 */

import { API_ROUTES } from '@/config/api-routes';
import { unwrapApiResponse } from '@/lib/api/client-response';
import type { StudioMedium } from '@/config/studio';

export interface StudioMediumAccess {
  medium: StudioMedium;
  provider: string | null;
  available: boolean;
  unlockedBy: string[];
}

export type StudioGenerateResult =
  | { kind: 'job'; medium: StudioMedium; jobId: string; provider: string; model: string }
  | { kind: 'file'; medium: StudioMedium; url: string; provider: string; model: string }
  | { kind: 'text'; medium: StudioMedium; title: string; text: string };

export type StudioJobState =
  | { state: 'pending' }
  | { state: 'ready'; url: string; mimeType: string }
  | { state: 'failed'; error: string };

export async function fetchStudioCapability(): Promise<StudioMediumAccess[]> {
  try {
    const res = await fetch(API_ROUTES.STUDIO.CAPABILITY);
    const value = await unwrapApiResponse<{ media: StudioMediumAccess[] }>(res, 'unavailable');
    return value.media;
  } catch {
    // A failed probe means "we don't know yet", never a blocked UI. The
    // generate call still reports precisely what is missing.
    return [];
  }
}

export function generateInStudio(
  medium: StudioMedium,
  prompt: string
): Promise<StudioGenerateResult> {
  return fetch(API_ROUTES.STUDIO.GENERATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medium, prompt }),
  }).then(res =>
    unwrapApiResponse<StudioGenerateResult>(res, 'Could not start that. Please try again.')
  );
}

export function pollStudioJob(jobId: string, medium: StudioMedium): Promise<StudioJobState> {
  return fetch(API_ROUTES.STUDIO.JOB(jobId, medium)).then(res =>
    unwrapApiResponse<StudioJobState>(res, 'Lost track of that render. Please try again.')
  );
}

export interface ReviseRequest {
  medium: StudioMedium;
  note: string;
  previousPrompt?: string;
  text?: string;
}

/** Video / music / image come back as a new prompt; writing as revised text. */
export function reviseInStudio(
  body: ReviseRequest
): Promise<{ prompt?: string; text?: string; rewritten?: boolean }> {
  return fetch(API_ROUTES.STUDIO.REVISE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(res =>
    unwrapApiResponse<{ prompt?: string; text?: string; rewritten?: boolean }>(
      res,
      'Could not revise that. Please try again.'
    )
  );
}
