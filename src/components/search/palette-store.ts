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

function emit() {
  listeners.forEach(listener => listener());
}

export function setPaletteOpen(next: boolean | ((current: boolean) => boolean)) {
  const value = typeof next === 'function' ? next(open) : next;
  if (value !== open) {
    open = value;
    emit();
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
