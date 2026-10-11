/**
 * OrangeCat's mark — the cat coil (generators/cat-coil.ts).
 *
 * To replace it with a drawn logo:
 *
 *   pnpm run brand:import orangecat path/to/logo.svg
 *
 * That rewrites this file from the SVG and regenerates every static asset
 * (favicon.svg, favicon.ico, apple-icon.png, PWA icons, orange-cat-logo.svg).
 * Commit what it wrote. Nothing else in the codebase needs to change.
 */

import { CAT_COIL, catCoilPathD } from './generators/cat-coil';
import type { MarkDefinition } from './types';

const mark: MarkDefinition = {
  slug: 'orangecat',
  name: 'OrangeCat',
  source: 'generated — generators/cat-coil.ts',
  viewBox: [0, 0, CAT_COIL.viewBox, CAT_COIL.viewBox],
  strokeWidth: CAT_COIL.strokeWidth,
  motion: 'draw',
  shapes: [{ paint: 'stroke', d: catCoilPathD(), linecap: 'round', linejoin: 'round' }],
};

export default mark;
