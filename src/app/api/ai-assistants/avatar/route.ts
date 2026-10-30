/**
 * GET /api/ai-assistants/avatar?shape=hex&hue=pink — a companion's face, as SVG.
 *
 * A picture URL like any other, so it sits in `avatar_url` and renders
 * wherever a picture does. Unknown ids fall back to the first shape and
 * colour rather than a broken image. Public and cacheable: a face is not a
 * secret, and the same URL is the same face forever.
 */

import {
  AVATAR_HUES,
  AVATAR_SHAPES,
  faceSvg,
  findHue,
  findShape,
} from '@/config/companion-avatars';

export const dynamic = 'force-static';

export function GET(request: Request) {
  const url = new URL(request.url);
  const shape = findShape(url.searchParams.get('shape')) ?? AVATAR_SHAPES[0];
  const hue = findHue(url.searchParams.get('hue')) ?? AVATAR_HUES[0];
  return new Response(faceSvg(shape, hue), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
