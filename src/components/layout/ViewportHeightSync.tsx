'use client';

/**
 * VIEWPORT HEIGHT SYNC
 *
 * Publishes the VISUAL viewport height as `--app-viewport-height` so a
 * full-height surface can be sized against the space the user can actually
 * see.
 *
 * Why this exists: `100dvh` does not shrink when the Android soft keyboard
 * opens. Only `window.visualViewport` does. A chat column sized `100dvh` minus
 * the header therefore keeps its full height while the keyboard covers the
 * bottom third of it — so the composer, which is the last row of that column,
 * ends up somewhere behind the keyboard and the thread appears to float in the
 * middle of the screen with dead space under it.
 *
 * `interactiveWidget: 'resizes-content'` (app/layout.tsx) fixes this on
 * browsers that honour it; this is the fallback for the ones that don't, and
 * it also covers the iOS case where the visual viewport moves without the
 * layout viewport changing at all.
 *
 * The var is only a hint: every consumer keeps a `100dvh` fallback so the
 * first paint — before this effect runs — is still correct.
 */

import { useEffect } from 'react';

export function ViewportHeightSync() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;

    const sync = () => {
      const height = vv?.height ?? window.innerHeight;
      // Sub-pixel heights produce a 1px seam under the composer on some
      // devices; round down so the column never exceeds what is visible.
      root.style.setProperty('--app-viewport-height', `${Math.floor(height)}px`);
    };

    sync();

    if (vv) {
      vv.addEventListener('resize', sync);
      // The visual viewport also SCROLLS (address bar collapse, keyboard
      // pan) without resizing; re-reading on scroll keeps the two in step.
      vv.addEventListener('scroll', sync);
    }
    window.addEventListener('orientationchange', sync);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', sync);
        vv.removeEventListener('scroll', sync);
      }
      window.removeEventListener('orientationchange', sync);
      root.style.removeProperty('--app-viewport-height');
    };
  }, []);

  return null;
}

export default ViewportHeightSync;
