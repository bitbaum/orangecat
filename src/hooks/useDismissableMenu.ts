'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A menu that opens from a trigger and closes the three ways a person expects:
 * a click outside, Escape (focus goes back to the trigger), and keyboard
 * focus leaving it. Put `rootRef` and `onBlur` on the element that holds both
 * the trigger and the panel, and `triggerRef` on the trigger.
 */
export function useDismissableMenu<
  Root extends HTMLElement = HTMLDivElement,
  Trigger extends HTMLElement = HTMLButtonElement,
>() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<Root>(null);
  const triggerRef = useRef<Trigger>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function onMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const onBlur = useCallback((event: React.FocusEvent) => {
    if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false);
    }
  }, []);

  return { isOpen, setIsOpen, rootRef, triggerRef, onBlur };
}
