/**
 * GET /api/ai-assistants/fleet/[slug]/mark — a fleet product's own mark, the
 * SVG its site serves at /icon.svg, carried through here because the products
 * answer with `cross-origin-resource-policy: same-origin`, so a browser on
 * orangecat.ch may not load the picture from them directly (measured
 * 2026-10-30: a broken image in the list). The response is checked to be an
 * SVG; when it is not (down, redirected to a page, missing) the companion
 * face the product's name picks is served instead.
 */

import { faceForName, faceSvg } from '@/config/companion-avatars';
import { fleetBotMarkUrl, isFleetBotSlug } from '@/config/fleet-bots';
import { fleetBot } from '@/services/companions/rooms/fleet';

export const dynamic = 'force-dynamic';

const MARK_TIMEOUT_MS = 5_000;
const MARK_MAX_BYTES = 64 * 1024;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function svgResponse(body: string, maxAge: number): Response {
  return new Response(body, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}`,
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  if (!isFleetBotSlug(slug)) {
    return new Response('Not found', { status: 404 });
  }
  const bot = await fleetBot(slug);
  const fallback = () => {
    const { shape, hue } = faceForName(bot?.name ?? slug);
    return svgResponse(faceSvg(shape, hue), 300);
  };
  if (!bot) {
    return fallback();
  }
  try {
    const res = await fetch(fleetBotMarkUrl(bot.url), {
      headers: { accept: 'image/svg+xml' },
      signal: AbortSignal.timeout(MARK_TIMEOUT_MS),
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.includes('svg')) {
      return fallback();
    }
    const body = await res.text();
    if (body.length > MARK_MAX_BYTES || !/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(body)) {
      return fallback();
    }
    return svgResponse(body, 86_400);
  } catch {
    return fallback();
  }
}
