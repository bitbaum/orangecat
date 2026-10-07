'use client';

import { useEffect, useState } from 'react';

/** Text-entry elements that bring up a phone's keyboard. */
function isTextEntry(el: Element | null): boolean {
  if (!el) {
    return false;
  }
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly && !el.disabled;
  }
  if (el instanceof HTMLInputElement) {
    const nonText = ['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image', 'hidden'];
    return !nonText.includes(el.type) && !el.readOnly && !el.disabled;
  }
  return (el as HTMLElement).isContentEditable === true;
}

/** The viewport shrank by this much beyond its tallest seen height: a keyboard. */
const SHRINK_THRESHOLD_PX = 150;

/**
 * True while a phone's soft keyboard is (or is about to be) up.
 *
 * The bottom nav used to compare `innerHeight` with `visualViewport.height`.
 * The root layout sets `interactiveWidget: 'resizes-content'`, so on Android
 * Chromium (the founder's Brave) the keyboard shrinks BOTH — the difference
 * stayed ~0 and the nav, and the floating Cat button above it, sat on top of
 * the keyboard covering the field being typed into (2026-10-07).
 *
 * Two signals, either suffices: focus on a text-entry element on a coarse
 * pointer (immediate, before the keyboard animates), and the visual viewport
 * shrinking well below the tallest height seen (works whichever resize mode
 * the browser applies). Desktop never reports true: no coarse pointer.
 */
export function useSoftKeyboard(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    if (!coarse) {
      return;
    }
    const vv = window.visualViewport;
    let tallest = vv?.height ?? window.innerHeight;

    const update = () => {
      const height = vv?.height ?? window.innerHeight;
      // Rotation or browser-chrome changes legitimately grow the viewport.
      tallest = Math.max(tallest, height);
      const shrunk = tallest - height > SHRINK_THRESHOLD_PX;
      setOpen(shrunk || isTextEntry(document.activeElement));
    };
    const onOrientation = () => {
      tallest = 0;
      update();
    };

    document.addEventListener('focusin', update);
    // focusout fires before the next element takes focus — re-check after.
    const onFocusOut = () => setTimeout(update, 0);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', update);
    window.addEventListener('orientationchange', onOrientation);
    update();
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', onOrientation);
    };
  }, []);

  return open;
}
