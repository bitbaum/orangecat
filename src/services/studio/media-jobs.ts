/**
 * Server-side video + music generation against a user's OWN provider key.
 *
 * Two provider shapes, both job-based (see MediaJobApi in ai-provider-runtime):
 * OpenAI's /videos, and Replicate's /models/{model}/predictions. BYOK-only —
 * this is never called with a platform key, exactly like image generation.
 *
 * WHY JOBS AND NOT ONE REQUEST
 * A render takes minutes. Holding an HTTP request open that long breaks behind
 * any proxy and gives the user a spinner with no way back. So `startJob` returns
 * the PROVIDER'S own job id and `pollJob` re-asks with the same key. Nothing is
 * stored server-side: there is no job table, and a user can only ever poll jobs
 * their own key created.
 *
 * Created: 2026-09-13
 */

import { logger } from '@/utils/logger';
import type { MediaJobApi } from '@/config/ai-provider-runtime';
import type { PollJobResult, StartJobResult, StudioJobMedium } from './types';

/** Starting a job is a small POST; only the render itself is slow. */
const REQUEST_TIMEOUT_MS = 60_000;
/** Downloading the finished artefact — a minute of video is tens of megabytes. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/**
 * Hosts a finished artefact may be downloaded from, by provider.
 *
 * The URL is provider-supplied rather than user-supplied, but it is still a
 * server-side fetch of an address this app did not choose. An allowlist keeps a
 * surprising response from turning into a request at an internal host, and is
 * cheaper and tighter here than a DNS-resolving SSRF check because the set of
 * legitimate hosts is small and known.
 */
const ALLOWED_DOWNLOAD_HOSTS: Record<string, readonly string[]> = {
  replicate: ['replicate.delivery', 'replicate.com'],
  openai: ['api.openai.com', 'openai.com'],
};

function isAllowedDownload(rawUrl: string, providerId: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') {
    return false;
  }
  const allowed = ALLOWED_DOWNLOAD_HOSTS[providerId] ?? [];
  return allowed.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

/**
 * Sniff the container from magic bytes. Providers are inconsistent about
 * Content-Type, and the extension we store under has to match the real format
 * or the browser refuses to play it.
 */
function sniffMimeType(bytes: Uint8Array, medium: StudioJobMedium): string {
  const ascii = (from: number, length: number) =>
    String.fromCharCode(...Array.from(bytes.slice(from, from + length)));

  if (ascii(4, 4) === 'ftyp') {
    return 'video/mp4';
  }
  if (ascii(0, 4) === 'OggS') {
    return 'audio/ogg';
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') {
    return 'audio/wav';
  }
  if (ascii(0, 4) === 'fLaC') {
    return 'audio/flac';
  }
  if (ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return 'audio/mpeg';
  }
  if (ascii(0, 4) === '\x1aE\xdf\xa3') {
    return 'video/webm';
  }
  return medium === 'video' ? 'video/mp4' : 'audio/mpeg';
}

/** File extension per mime type, for the storage path. */
export const STUDIO_MIME_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
};

interface JobContext {
  apiKey: string;
  baseUrl: string;
  model: string;
  api: MediaJobApi;
  providerId: string;
  medium: StudioJobMedium;
}

/** Read a provider's error message without assuming a shape. */
async function providerMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string } | string;
    detail?: string;
  } | null;
  if (typeof body?.error === 'string') {
    return body.error;
  }
  return body?.error?.message || body?.detail || `provider returned ${response.status}`;
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function startJob(
  ctx: JobContext,
  prompt: string,
  durationSeconds?: number
): Promise<StartJobResult> {
  const url =
    ctx.api === 'openai-videos'
      ? `${ctx.baseUrl}/videos`
      : `${ctx.baseUrl}/models/${ctx.model}/predictions`;

  const body =
    ctx.api === 'openai-videos'
      ? { model: ctx.model, prompt }
      : {
          input: {
            prompt,
            ...(durationSeconds ? { duration: durationSeconds } : {}),
          },
        };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ctx.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const message = await providerMessage(response);
      logger.warn(
        'Studio job failed to start',
        { status: response.status, model: ctx.model, medium: ctx.medium, message },
        'Studio'
      );
      return { ok: false, error: message };
    }

    const json = (await response.json().catch(() => null)) as { id?: string } | null;
    if (!json?.id) {
      return { ok: false, error: 'provider accepted the request but returned no job id' };
    }
    return { ok: true, jobId: json.id };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    logger.warn('Studio job start request failed', { error: String(error) }, 'Studio');
    return {
      ok: false,
      error: timedOut ? 'the provider did not respond in time' : 'request failed',
    };
  }
}

// ---------------------------------------------------------------------------
// Poll
// ---------------------------------------------------------------------------

/** Replicate's terminal failure states. */
const REPLICATE_FAILED = new Set(['failed', 'canceled']);

export async function pollJob(ctx: JobContext, jobId: string): Promise<PollJobResult> {
  const statusUrl =
    ctx.api === 'openai-videos'
      ? `${ctx.baseUrl}/videos/${encodeURIComponent(jobId)}`
      : `${ctx.baseUrl}/predictions/${encodeURIComponent(jobId)}`;

  let json: {
    status?: string;
    error?: string | { message?: string };
    output?: unknown;
  } | null;

  try {
    const response = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${ctx.apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { state: 'failed', error: await providerMessage(response) };
    }
    json = (await response.json().catch(() => null)) as typeof json;
  } catch (error) {
    logger.warn('Studio job poll failed', { error: String(error) }, 'Studio');
    return { state: 'failed', error: 'could not reach the provider' };
  }

  const status = json?.status ?? '';
  const errorText =
    typeof json?.error === 'string' ? json.error : json?.error?.message || 'the render failed';

  if (ctx.api === 'openai-videos') {
    if (status === 'failed') {
      return { state: 'failed', error: errorText };
    }
    if (status !== 'completed') {
      return { state: 'pending' };
    }
    return downloadInto(ctx, `${ctx.baseUrl}/videos/${encodeURIComponent(jobId)}/content`, true);
  }

  if (REPLICATE_FAILED.has(status)) {
    return { state: 'failed', error: errorText };
  }
  if (status !== 'succeeded') {
    return { state: 'pending' };
  }

  const output = Array.isArray(json?.output) ? json.output[0] : json?.output;
  if (typeof output !== 'string' || !output) {
    return { state: 'failed', error: 'the model finished but returned nothing playable' };
  }
  if (!isAllowedDownload(output, ctx.providerId)) {
    logger.warn(
      'Studio refused an unexpected output host',
      { providerId: ctx.providerId },
      'Studio'
    );
    return { state: 'failed', error: 'the provider returned an unexpected download location' };
  }
  return downloadInto(ctx, output, false);
}

/**
 * Fetch the finished artefact. `authenticated` is true for OpenAI, whose
 * content endpoint sits behind the same key; Replicate hands back a signed URL
 * that must NOT carry our Authorization header.
 */
async function downloadInto(
  ctx: JobContext,
  url: string,
  authenticated: boolean
): Promise<PollJobResult> {
  try {
    const response = await fetch(url, {
      headers: authenticated ? { Authorization: `Bearer ${ctx.apiKey}` } : {},
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { state: 'failed', error: 'could not download the finished file' };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) {
      return { state: 'failed', error: 'the provider returned an empty file' };
    }
    return { state: 'ready', media: { bytes, mimeType: sniffMimeType(bytes, ctx.medium) } };
  } catch (error) {
    logger.warn('Studio download failed', { error: String(error) }, 'Studio');
    return { state: 'failed', error: 'could not download the finished file' };
  }
}
