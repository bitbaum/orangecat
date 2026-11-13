/**
 * Whether the ⌘K palette is open — one value for the whole page.
 *
 * The header renders a search trigger twice (a pill from md up, an icon below
 * it, the other hidden by CSS). When each trigger owned its own palette and
 * its own ⌘K listener, one keystroke opened two stacked dialogs and fetched
 * twice. Now the triggers only flip this, and CommandPaletteHost renders the
 * one palette.
 */
import { useSyncExternalStore } from 'react';

let open = false;
/** What had focus when the palette opened: it gets focus back on close. */
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function setPaletteOpen(next: boolean | ((current: boolean) => boolean)) {
  const value = typeof next === 'function' ? next(open) : next;
  if (value !== open) {
    if (value && typeof document !== 'undefined') {
      const active = document.activeElement;
      opener = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    open = value;
    emit();
  }
}

/**
 * Hand focus back to whatever opened the palette. Radix returns focus to its
 * own Dialog.Trigger, and the palette has none — it opens from the header
 * triggers and the hotkeys through this store — so on close focus fell to
 * <body> and a keyboard user started again from the top of the page. Call it
 * once the palette has unmounted, or its focus trap pulls focus back in.
 */
export function returnPaletteFocus() {
  const target = opener;
  opener = null;
  if (target?.isConnected) {
    target.focus();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePaletteOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false
  );
}
