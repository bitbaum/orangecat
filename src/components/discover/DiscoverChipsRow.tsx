'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The row of kinds, which scrolls sideways. A chosen kind far along the row
 * ("Research", "Loans") was off screen on a phone, so the page did not show
 * which kind it was on; bring the current chip into view when the row mounts.
 * `block: 'nearest'` keeps the page itself from moving.
 */
export function DiscoverChipsRow({ children }: { children: ReactNode }) {
  const row = useRef<HTMLElement>(null);

  useEffect(() => {
    const current = row.current?.querySelector<HTMLElement>('[aria-current="page"]');
    current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, []);

  return (
    <nav ref={row} aria-label="Kinds of things" className="oc-discover-chips">
      {children}
    </nav>
  );
}
