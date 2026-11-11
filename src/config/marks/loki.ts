/**
 * Loki's mark — the rotorelief disc (generators/rotorelief-coil.ts), mirroring
 * bitbaum/loki `src/config/brand-mark.ts`.
 *
 * Replace it with `pnpm run brand:import loki path/to/logo.svg`.
 */

import { ROTORELIEF_COIL, rotoreliefCoilPathD } from './generators/rotorelief-coil';
import type { MarkDefinition } from './types';

const mark: MarkDefinition = {
  slug: 'loki',
  name: 'Loki',
  source: 'generated — generators/rotorelief-coil.ts',
  viewBox: [0, 0, ROTORELIEF_COIL.viewBox, ROTORELIEF_COIL.viewBox],
  strokeWidth: 6,
  motion: 'spin',
  shapes: [{ paint: 'fill', d: rotoreliefCoilPathD(), fillRule: 'evenodd' }],
};

export default mark;
