/**
 * OrangeCat's mark — the cat rotorelief (generators/cat-rotorelief.ts): a
 * cat's head whose face is a Duchamp disc of off-centre rings.
 *
 * To replace it with a drawn logo:
 *
 *   pnpm run brand:import orangecat path/to/logo.svg
 *
 * That rewrites this file from the SVG and regenerates every static asset
 * (favicon.svg, favicon.ico, apple-icon.png, PWA icons, orange-cat-logo.svg).
 * Commit what it wrote. Nothing else in the codebase needs to change.
 */

import { BRAND_ACCENT_HEX } from '../brand';
import { CAT_ROTORELIEF, catHeadPathD, catRingsPathD } from './generators/cat-rotorelief';
import type { MarkDefinition } from './types';

const mark: MarkDefinition = {
  slug: 'orangecat',
  name: 'OrangeCat',
  source: 'generated — generators/cat-rotorelief.ts',
  viewBox: [0, 0, CAT_ROTORELIEF.viewBox, CAT_ROTORELIEF.viewBox],
  strokeWidth: 6,
  motion: 'turn',
  // The one orange: OrangeCat's icon is the cat in its own name's colour.
  iconInk: BRAND_ACCENT_HEX,
  shapes: [
    { paint: 'fill', d: catHeadPathD(), fillRule: 'evenodd' },
    {
      paint: 'fill',
      d: catRingsPathD(),
      fillRule: 'evenodd',
      turnAbout: [CAT_ROTORELIEF.cx, CAT_ROTORELIEF.cy],
    },
  ],
};

export default mark;
