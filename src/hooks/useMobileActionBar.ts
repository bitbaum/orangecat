'use client';

import { useEffect } from 'react';

/**
 * Mark the page as showing a sticky mobile action bar while `active`, so the
 * floating Cat button (globals.css: html[data-mobile-action-bar]) rises above
 * the bar instead of being drawn under it. Counted, so two bars at once — or
 * one unmounting while another mounts — leave the mark right.
 */
let mounted = 0;

export function useMobileActionBar(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    mounted += 1;
    document.documentElement.setAttribute('data-mobile-action-bar', '');
    return () => {
      mounted -= 1;
      if (mounted <= 0) {
        mounted = 0;
        document.documentElement.removeAttribute('data-mobile-action-bar');
      }
    };
  }, [active]);
}
