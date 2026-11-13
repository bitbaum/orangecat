/**
 * Small, pure pieces every share card needs: who made the thing (a name a
 * person chose, never a minted `user_<hex>` handle), the drawing of a lucide
 * icon without React, and the image a card may show.
 */

import type { LucideIcon } from 'lucide-react';
import { isMintedHandle } from '@/config/usernames';

/**
 * The maker's name as a card prints it: their chosen name, else their chosen
 * @handle, else nothing. A handle the platform minted (`user_df091395b2ca`)
 * is not a name; a card that said "by user_df091395b2ca" read as a bot's.
 */
export function makerName(
  person: { name?: string | null; username?: string | null } | null | undefined
): string | null {
  const name = person?.name?.trim();
  if (name && !isMintedHandle(name)) {
    return name;
  }
  const handle = person?.username?.trim();
  return handle && !isMintedHandle(handle) ? `@${handle}` : null;
}

/** One element of a lucide icon: a tag (`path`, `circle`, …) and its attributes. */
export type IconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;

/**
 * The shapes a lucide icon draws, read without rendering it. A lucide icon is
 * a forwardRef whose render returns `<Icon iconNode={…}>`; calling that one
 * render runs no hook, so it works outside React (satori calls components
 * itself, and lucide's inner Icon reads a context it cannot have there).
 */
export function iconNodeOf(icon: LucideIcon | null | undefined): IconNode | null {
  const render = (icon as unknown as { render?: (props: object, ref: null) => unknown })?.render;
  if (typeof render !== 'function') {
    return null;
  }
  try {
    const element = render({}, null) as { props?: { iconNode?: unknown } } | null;
    const node = element?.props?.iconNode;
    return Array.isArray(node) ? (node as unknown as IconNode) : null;
  } catch {
    return null;
  }
}

/** Formats satori can draw. WebP and AVIF are not among them. */
const DRAWABLE = /^image\/(png|jpe?g|gif)\b/i;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 3000;

/**
 * An image a card can draw, as a data URI — or null. Fetched here rather than
 * handed to satori as a URL: a missing file, a slow host or a WebP would make
 * the renderer fail mid-stream and the previewer would get a broken image
 * instead of a card. With null the card draws the kind's icon instead.
 */
export async function loadCardImage(
  url: string | null | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  if (!url || !/^https:\/\//i.test(url)) {
    return null;
  }
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !DRAWABLE.test(type)) {
      return null;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      return null;
    }
    return `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/** The first of a row's candidate image URLs that is a usable https URL. */
export function firstImage(...candidates: unknown[]): string | null {
  for (const candidate of candidates.flat()) {
    if (typeof candidate === 'string' && /^https:\/\//i.test(candidate.trim())) {
      return candidate.trim();
    }
  }
  return null;
}
