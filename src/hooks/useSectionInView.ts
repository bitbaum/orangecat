'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the element with this id is on screen. A phone's sticky action bar
 * that takes the reader to a section on the page (the payment section, #pay)
 * yields while that section is in view: there the bar is a second copy of the
 * button above it, and it covered the open invoice's "Hide the code"
 * (QA 2026-11-10 on projects, 2026-11-12 on every other entity, 390px).
 * `null` — a bar that leads off the page — is never in view.
 */
export function useSectionInView(id: string | null): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const section = id ? document.getElementById(id) : null;
    if (!section || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(section);
    return () => io.disconnect();
  }, [id]);
  return inView;
}
