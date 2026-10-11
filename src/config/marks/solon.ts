/**
 * Solon's mark. Imported from scale.svg on 2026-10-11 by
 * `pnpm run brand:import`. Do not edit the geometry by hand: change the
 * drawing and import it again.
 *
 *   pnpm run brand:import solon path/to/new-mark.svg
 */

import type { MarkDefinition } from './types';

const mark: MarkDefinition = {
  slug: 'solon',
  name: 'Solon',
  source: 'imported — scale.svg',
  viewBox: [0, 0, 24, 24],
  strokeWidth: 2,
  motion: 'none',
  shapes: [
    {
      paint: 'stroke',
      linecap: 'round',
      linejoin: 'round',
      d: 'M12 3v18',
    },
    {
      paint: 'stroke',
      linecap: 'round',
      linejoin: 'round',
      d: 'm19 8 3 8a5 5 0 0 1-6 0zV7',
    },
    {
      paint: 'stroke',
      linecap: 'round',
      linejoin: 'round',
      d: 'M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1',
    },
    {
      paint: 'stroke',
      linecap: 'round',
      linejoin: 'round',
      d: 'm5 8 3 8a5 5 0 0 1-6 0zV7',
    },
    {
      paint: 'stroke',
      linecap: 'round',
      linejoin: 'round',
      d: 'M7 21h10',
    },
  ],
};

export default mark;
