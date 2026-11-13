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
const listeners = new Set<() => void>();

/**
 * What had focus when the palette opened. The palette is opened from outside
 * state (two triggers, ⌘K, "/"), not from a Radix Dialog.Trigger, so Radix
 * has nothing to return focus to on close and it fell to the top of the page.
 */
let returnFocusTo: HTMLElement | null = null;

function rememberFocus() {
  if (typeof document === 'undefined') {
    return;
  }
  const active = document.activeElement;
  returnFocusTo = active instanceof HTMLElement && active !== document.body ? active : null;
}

function restoreFocus() {
  const target = returnFocusTo;
  returnFocusTo = null;
  if (!target || typeof window === 'undefined') {
    return;
  }
  // After the dialog has unmounted and let go of focus. Only when nothing
  // else has taken it since (a page the palette navigated to may have).
  window.requestAnimationFrame(() => {
    const active = document.activeElement;
    if (target.isConnected && (!active || active === document.body)) {
      target.focus();
    }
  });
}

function emit() {
  listeners.forEach(listener => listener());
}

export function setPaletteOpen(next: boolean | ((current: boolean) => boolean)) {
  const value = typeof next === 'function' ? next(open) : next;
  if (value !== open) {
    if (value) {
      rememberFocus();
    }
    open = value;
    emit();
    if (!value) {
      restoreFocus();
    }
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
