/**
 * Loki's mark — the Archimedean coil (generators/archimedean-coil.ts), mirroring
 * bitbaum/loki `src/config/brand-mark.ts`.
 *
 * Replace it with `pnpm run brand:import loki path/to/logo.svg`.
 */

import { ARCHIMEDEAN_COIL, archimedeanCoilPathD } from './generators/archimedean-coil';
import type { MarkDefinition } from './types';

const mark: MarkDefinition = {
  slug: 'loki',
  name: 'Loki',
  source: 'generated — generators/archimedean-coil.ts',
  viewBox: [0, 0, ARCHIMEDEAN_COIL.viewBox, ARCHIMEDEAN_COIL.viewBox],
  strokeWidth: ARCHIMEDEAN_COIL.strokeWidth,
  motion: 'spin',
  shapes: [{ paint: 'stroke', d: archimedeanCoilPathD(), linecap: 'round', linejoin: 'round' }],
};

export default mark;
